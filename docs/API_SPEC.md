# Спецификация API

Контракты между Nuxt SPA и NestJS API.

Формы данных определяются Zod-схемами в `packages/contracts` — они источник истины,
этот документ описывает поведение. OpenAPI генерируется из тех же схем.

Связанные решения: [ADR-0001](adr/0001-rest-api.md), [ADR-0009](adr/0009-zod-first-contracts.md),
[ADR-0013](adr/0013-dedup-by-file-hash.md).

---

## 1. Общие правила

Базовый путь `/api/v1`. Тело — JSON, кроме загрузки файла.

Аутентификация — cookie-сессия. Access-токен в короткоживущей HttpOnly-cookie,
refresh — в HttpOnly-cookie с ограниченным путём. Токены не передаются в заголовках
и не хранятся в JavaScript. Подробности — в [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md).

Каждый ответ содержит `X-Request-Id`. Он же попадает в логи и в тело ошибки.

Денежные значения — целые числа минорных единиц ([ADR-0006](adr/0006-money-minor-units.md)).
Даты покупки — строка `YYYY-MM-DD`. Метки времени системы — ISO 8601 в UTC.

### Формат ошибки

Единый для всех эндпоинтов:

```json
{
  "code": "RECEIPT_VALIDATION_FAILED",
  "message": "Receipt data is invalid",
  "details": {
    "totalMinor": ["Must be a non-negative integer"]
  },
  "requestId": "b4d0b8ef-7c71-4a4e-bc89-d1a0c4f7d38e"
}
```

Клиент реагирует на `code`, а не на `message`. Текст предназначен для логов
и отладки; пользователю показывается сообщение, подобранное фронтендом по коду
на языке интерфейса.

HTTP-статус отражает класс ошибки, `code` — конкретную причину. Одному статусу
может соответствовать несколько кодов.

### Пагинация

Курсорная, а не по номеру страницы: список чеков пополняется сверху, и при
нумерации страниц записи начали бы дублироваться между страницами.

```http
GET /api/v1/receipts?limit=20&cursor=eyJpZCI6...
```

```json
{
  "items": [],
  "nextCursor": "eyJpZCI6...",
  "hasMore": true
}
```

---

## 2. Аутентификация

```http
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

### POST /auth/register

```json
{
  "email": "user@example.com",
  "password": "...",
  "timezone": "Europe/Berlin",
  "baseCurrency": "EUR"
}
```

`timezone` берётся фронтендом из `Intl.DateTimeFormat().resolvedOptions().timeZone`.
Это не косметика: от неё зависит, в какой месяц попадёт покупка, сделанная
поздно вечером — см. [DATA_MODEL.md](DATA_MODEL.md).

Ответ `201`, cookie установлены, тело — профиль пользователя.

При занятом email возвращается `409 AUTH_EMAIL_TAKEN`. Скрывать факт
существования аккаунта здесь бессмысленно: форма регистрации всё равно
его раскрывает, а неинформативная ошибка только запутает.

### POST /auth/login

При неверных данных — `401 AUTH_INVALID_CREDENTIALS`, одинаково для
несуществующего email и неверного пароля.

### POST /auth/refresh

Обменивает refresh-cookie на новую пару. Старый токен инвалидируется —
ротация обязательна.

Повторное использование уже израсходованного токена означает кражу:
вся цепочка сессий отзывается, возвращается `401 AUTH_SESSION_REVOKED`.

### GET /auth/me

```json
{
  "id": "...",
  "email": "user@example.com",
  "displayName": null,
  "timezone": "Europe/Berlin",
  "baseCurrency": "EUR",
  "locale": "en",
  "emailVerified": false
}
```

---

## 3. Загрузка чека

```http
POST /api/v1/receipts/upload
Content-Type: multipart/form-data
Idempotency-Key: 9f2b1c40-...
```

Поле `file`. Опционально `entryMode` со значением `MANUAL`, если пользователь
сразу хочет вводить данные руками — тогда распознавание не запускается.

Ответ `202`:

```json
{
  "receiptId": "c7e3f4b0-...",
  "processingStatus": "PENDING",
  "duplicate": false
}
```

### Идемпотентность

Заголовок `Idempotency-Key` обязателен. Клиент генерирует UUID при начале
загрузки и повторяет его при всех ретраях этой же загрузки.

Повтор с тем же ключом возвращает исходный ответ, не создавая новый чек.
Ключ живёт 24 часа. Тот же ключ с другим содержимым — `409 IDEMPOTENCY_KEY_REUSED`.

### Дубликаты

Если файл с таким SHA-256 у пользователя уже есть, новый чек не создаётся.
Возвращается `200` с идентификатором существующего:

```json
{
  "receiptId": "существующий-id",
  "processingStatus": "COMPLETED",
  "duplicate": true
}
```

Это не ошибка. Пользователю показывается уже загруженный чек с пояснением —
попытка загрузить дубль обычно означает, что человек забыл, что уже загружал.

### Ошибки

| Статус | Код | Когда |
|---|---|---|
| `400` | `RECEIPT_FILE_MISSING` | нет поля `file` |
| `413` | `RECEIPT_FILE_TOO_LARGE` | больше лимита |
| `415` | `RECEIPT_FILE_TYPE_UNSUPPORTED` | тип по сигнатуре не поддерживается |
| `422` | `RECEIPT_IMAGE_INVALID` | повреждён, слишком мал, неверные пропорции |
| `429` | `RATE_LIMIT_EXCEEDED` | превышена частота загрузок |

Отдельно про `415`: тип определяется по сигнатуре файла, а не по заголовку
`Content-Type` и не по расширению — оба задаются клиентом.

---

## 4. Статус обработки

```http
GET /api/v1/receipts/:id/processing
```

```json
{
  "receiptId": "...",
  "processingStatus": "PROCESSING",
  "stage": "EXTRACTING",
  "startedAt": "2026-08-30T10:15:00Z",
  "estimatedSeconds": 12,
  "error": null
}
```

`stage` — для человекочитаемого прогресса: `PREPARING`, `EXTRACTING`,
`NORMALIZING`. Внутренние повторные попытки и перебор моделей не отражаются:
пока попытки не исчерпаны, состояние остаётся `PROCESSING`.

При отказе:

```json
{
  "processingStatus": "FAILED",
  "error": {
    "code": "EXTRACTION_FAILED",
    "retryable": true
  }
}
```

`retryable` подсказывает интерфейсу, предлагать ли повтор. Ручной ввод
предлагается всегда.

### Опрос

Интервал 2 секунды первые 20 секунд, затем 5 секунд. Прекращать через
5 минут с показом `PROCESSING_TIMEOUT` — но задача при этом продолжает
выполняться, и результат появится при следующем открытии чека.

Клиент останавливает опрос при уходе со страницы и возобновляет при возврате.

---

## 5. Чеки

```http
GET    /api/v1/receipts
GET    /api/v1/receipts/:id
PATCH  /api/v1/receipts/:id
POST   /api/v1/receipts/:id/confirm
POST   /api/v1/receipts/:id/reprocess
DELETE /api/v1/receipts/:id
```

### GET /receipts

Параметры:

```text
limit, cursor
from, to              YYYY-MM-DD, по дате покупки
status                DRAFT | CONFIRMED | ARCHIVED
processingStatus      для фильтра «в обработке»
merchantId
categoryId            чеки, содержащие позицию этой категории
search                по названию магазина и названиям позиций
sort                  purchasedAt | totalMinor | createdAt
order                 asc | desc
```

В элементе списка — только необходимое для отображения строки, включая
`thumbnailUrl`. Позиции не передаются: чек на сорок позиций в списке
из двадцати чеков — это лишние мегабайты.

### GET /receipts/:id

Полное представление с позициями, магазином, уверенностью и `fieldSources`.

```json
{
  "id": "...",
  "purchasedAt": "2026-08-28",
  "purchasedTime": "18:42",
  "currency": "EUR",
  "subtotalMinor": 278,
  "taxTotalMinor": null,
  "discountTotalMinor": 0,
  "totalMinor": 278,
  "status": "DRAFT",
  "processingStatus": "COMPLETED",
  "entryMode": "SCAN",
  "confidence": "MEDIUM",
  "imageUrl": "https://...?signature=...",
  "thumbnailUrl": "https://...?signature=...",
  "merchant": { "id": "...", "name": "LIDL" },
  "items": [
    {
      "id": "...",
      "position": 1,
      "name": "MILCH",
      "lineType": "ITEM",
      "quantity": "1",
      "unit": "PCS",
      "unitPriceMinor": 129,
      "totalPriceMinor": 129,
      "categoryId": "...",
      "confidence": "HIGH"
    }
  ],
  "fieldSources": { "totalMinor": "AI", "purchasedAt": "USER" },
  "validation": {
    "itemsSumMinor": 278,
    "matchesTotal": true
  }
}
```

`imageUrl` — подписанная ссылка со сроком жизни 15 минут. Она вычисляется
при каждом запросе и не хранится.

`validation` считается сервером, чтобы фронтенд не дублировал бизнес-правило
о допуске расхождения.

`quantity` передаётся строкой: это дробное значение, и представление
в виде числа с плавающей точкой исказило бы `0.532`.

### PATCH /receipts/:id

Частичное обновление. Позиции передаются полным массивом — отсутствующие
удаляются, новые создаются, порядок берётся из массива. Пооперационные
изменения списка позиций усложнили бы клиент без пользы.

Каждое изменённое поле получает `source = USER` в `fieldSources`.
Это происходит на сервере автоматически, клиент об этом не заботится.

Работает и для чеков в статусе `CONFIRMED` — правка после подтверждения разрешена.

### POST /receipts/:id/confirm

Переводит `DRAFT` в `CONFIRMED`. Проверяет обязательные поля:
`purchasedAt`, `currency`, `totalMinor`.

Позиции не обязательны — ручной ввод только итоговой суммы законен,
см. [ADR-0014](adr/0014-manual-entry-fallback.md).

Мягкие проверки (сходимость сумм) подтверждению не мешают, но возвращаются
в ответе как предупреждения:

```json
{
  "status": "CONFIRMED",
  "warnings": [
    { "code": "ITEMS_SUM_MISMATCH", "differenceMinor": -50 }
  ]
}
```

При невыполненных обязательных полях — `422 RECEIPT_INCOMPLETE` с перечислением.

### POST /receipts/:id/reprocess

Ставит чек в очередь повторно. **Всегда изменяет существующий чек**,
никогда не создаёт новый.

Поля с `source = USER` сохраняются: пользователь уже потратил время на правку,
терять её нельзя. Остальные перезаписываются, позиции заменяются целиком —
кроме случая, когда позиции редактировались вручную.

`CONFIRMED` при этом не сбрасывается.

Ответ `202`. Если обработка уже идёт — `409 PROCESSING_ALREADY_RUNNING`.

### DELETE /receipts/:id

Мягкое удаление. Чек исчезает из истории и аналитики, `deletedAt` проставляется.
Окончательное удаление вместе с файлами — через 30 дней регулярной задачей.

Ответ `204`.

---

## 6. Категории

```http
GET /api/v1/categories
```

Только чтение. В MVP категории системные — см. [ADR-0007](adr/0007-analytics-source-of-truth.md)
и раздел о категориях в [DATA_MODEL.md](DATA_MODEL.md).

```json
[
  { "id": "...", "slug": "groceries", "nameKey": "category.groceries",
    "icon": "shopping-cart", "color": "#4ade80", "isSystem": true }
]
```

Название приходит ключом перевода, а не готовым текстом — интерфейс
подставляет его сам. Иначе добавление второго языка потребовало бы
менять данные в базе.

Создание, изменение и удаление появятся вместе с пользовательскими
категориями после MVP.

---

## 7. Аналитика

```http
GET /api/v1/analytics/summary
GET /api/v1/analytics/by-category
GET /api/v1/analytics/by-merchant
GET /api/v1/analytics/timeline
```

Общие параметры: `from`, `to` в формате `YYYY-MM-DD`, либо `period` со значением
`today | week | month | prev_month | year`.

Границы периодов вычисляются в таймзоне пользователя. Учитываются только чеки
в статусе `CONFIRMED` и `ARCHIVED`.

### GET /analytics/summary

```json
{
  "period": { "from": "2026-08-01", "to": "2026-08-31" },
  "currency": "EUR",
  "totalMinor": 48350,
  "receiptCount": 23,
  "averageReceiptMinor": 2102,
  "previousPeriod": {
    "totalMinor": 51200,
    "changePercent": -5.6
  }
}
```

### GET /analytics/by-category

```json
{
  "currency": "EUR",
  "totalMinor": 48350,
  "items": [
    { "categoryId": "...", "slug": "groceries", "amountMinor": 31200, "share": 0.645 },
    { "categoryId": null, "slug": "uncategorized", "amountMinor": 2150, "share": 0.044 }
  ]
}
```

Сумма `amountMinor` по всем элементам **всегда точно равна** `totalMinor`.
Расхождение между итогами чеков и суммой их позиций попадает в `uncategorized`.
Это инвариант из [ADR-0007](adr/0007-analytics-source-of-truth.md), проверяемый тестом.

`uncategorized` может быть отрицательным — при скидке на весь чек.

### GET /analytics/timeline

Дополнительный параметр `granularity`: `day | week | month`.

```json
{
  "currency": "EUR",
  "points": [
    { "date": "2026-08-01", "amountMinor": 1250, "receiptCount": 1 },
    { "date": "2026-08-02", "amountMinor": 0, "receiptCount": 0 }
  ]
}
```

Периоды без расходов возвращаются нулями, а не пропускаются — иначе график
исказит масштаб времени.

### Несколько валют

Конвертации в MVP нет. Если у пользователя есть чеки в разных валютах,
агрегаты считаются по `baseCurrency`, а наличие остальных отмечается:

```json
{
  "currency": "EUR",
  "totalMinor": 48350,
  "excludedCurrencies": [{ "currency": "PLN", "receiptCount": 3 }]
}
```

Складывать разные валюты по выдуманному курсу нельзя — это молча
неверные цифры, худший вид ошибки в приложении о деньгах.

---

## 8. Профиль и данные

```http
GET    /api/v1/me
PATCH  /api/v1/me
GET    /api/v1/me/export
DELETE /api/v1/me
```

### GET /me/export

Все данные пользователя одним JSON: профиль, чеки, позиции, магазины.
Изображения — подписанными ссылками со сроком жизни 24 часа.

Нужен и как право на переносимость данных, и как удобный инструмент отладки.

### DELETE /me

Требует подтверждения паролем. Удаляет немедленно и полностью: пользователя,
чеки, позиции, магазины, сессии и все объекты в хранилище.

Ответ `204`, cookie очищаются.

---

## 9. Коды ошибок

Стабильный перечень. Фронтенд сопоставляет их с текстами интерфейса.

### Аутентификация

```text
AUTH_INVALID_CREDENTIALS      401
AUTH_EMAIL_TAKEN              409
AUTH_SESSION_EXPIRED          401
AUTH_SESSION_REVOKED          401   обнаружено повторное использование токена
AUTH_UNAUTHENTICATED          401
AUTH_PASSWORD_TOO_WEAK        422
```

### Чеки

```text
RECEIPT_NOT_FOUND             404
RECEIPT_FILE_MISSING          400
RECEIPT_FILE_TOO_LARGE        413
RECEIPT_FILE_TYPE_UNSUPPORTED 415
RECEIPT_IMAGE_INVALID         422
RECEIPT_VALIDATION_FAILED     422
RECEIPT_INCOMPLETE            422   не хватает полей для подтверждения
RECEIPT_ALREADY_DELETED       410
```

### Обработка

```text
PROCESSING_ALREADY_RUNNING    409
PROCESSING_TIMEOUT            504
EXTRACTION_FAILED             502
EXTRACTION_INVALID_RESPONSE   502   ответ модели не прошёл схему
PROVIDER_UNAVAILABLE          503
```

### Общие

```text
VALIDATION_FAILED             422
RATE_LIMIT_EXCEEDED           429
IDEMPOTENCY_KEY_REUSED        409
INTERNAL_ERROR                500
```

Обратите внимание: кода `RECEIPT_ACCESS_DENIED` нет намеренно. Обращение
к чужому чеку возвращает `404 RECEIPT_NOT_FOUND`, а не `403`. Различие
между «не существует» и «существует, но не ваш» — это утечка информации
о чужих данных.
