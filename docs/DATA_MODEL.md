# Модель данных

Схема базы, правила работы с деньгами и датами, состояния чека, индексы.

Связанные решения: [ADR-0002](adr/0002-postgresql-prisma.md) (PostgreSQL + Prisma),
[ADR-0006](adr/0006-money-minor-units.md) (деньги), [ADR-0013](adr/0013-dedup-by-file-hash.md) (дедупликация).

---

## 1. Деньги

Все денежные величины — целое число минорных единиц плюс код валюты.
Поля обязаны иметь суффикс `Minor`, чтобы ошибка размерности была видна при чтении кода.

```prisma
totalMinor    Int      // 278 = 2,78 EUR
currency      String   @db.Char(3)   // ISO 4217
```

### Правила

Количество знаков после запятой берётся из метаданных ISO 4217, а не из деления
на 100. У JPY знаков нет, у BHD их три, у EUR два.

Форматирование только через `Intl.NumberFormat` — он знает и дробность, и локальные
разделители, и позицию символа валюты.

Арифметика только над целыми. Дробных промежуточных значений не возникает нигде.

Валюта хранится на уровне чека. Позиции валюту не имеют — на одном чеке она всегда одна.

### Разделение суммы с округлением

При пропорциональном распределении (например, скидки на весь чек по позициям)
округление выполняется методом наибольших остатков: сначала целые части, затем
недостающие минорные единицы раздаются позициям с наибольшей дробной частью.
Так сумма частей всегда точно равна целому.

Реализация — единственная функция в доменном слое, покрытая тестами.

---

## 2. Даты и время

Разные поля имеют принципиально разную природу, и путать их нельзя.

| Поле                     | Тип                        | Природа                              |
| ------------------------ | -------------------------- | ------------------------------------ |
| `purchasedAt`            | `Date` (без времени)       | дата на чеке, локальная для магазина |
| `purchasedTime`          | `String?` `HH:mm`          | время на чеке, если распознано       |
| `createdAt`, `updatedAt` | `DateTime` (`timestamptz`) | момент события в системе             |

### Почему дата покупки хранится без времени и без зоны

На чеке напечатана настенная дата магазина. Если сохранить её как момент времени
в UTC, то покупка 1 марта в 00:30 в Берлине станет 28 февраля в UTC — и попадёт
в аналитику предыдущего месяца. Пользователь увидит расход не в том месяце
и будет прав, считая это ошибкой.

Поэтому дата покупки — календарная дата, без приведения к зоне. Время хранится
отдельно и только справочно.

### Группировка в аналитике

Группировка по дням, неделям и месяцам выполняется по `purchasedAt` напрямую,
без преобразования зон. Границы периодов («этот месяц», «прошлая неделя»)
вычисляются в таймзоне пользователя из `users.timezone`, а затем сравниваются
с `purchasedAt` как с датой.

`users.timezone` заполняется при регистрации из `Intl.DateTimeFormat().resolvedOptions().timeZone`
и меняется в настройках.

---

## 3. Схема

Приведена в нотации Prisma. Это описание намерения, не готовый `schema.prisma`.

### User

```prisma
model User {
  id            String    @id @default(uuid()) @db.Uuid
  email         String    @unique
  passwordHash  String
  displayName   String?
  timezone      String    @default("UTC")
  locale        String    @default("en")
  baseCurrency  String    @default("EUR") @db.Char(3)
  emailVerifiedAt DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  sessions      Session[]
  receipts      Receipt[]
  merchants     Merchant[]
  categories    Category[]
}
```

`baseCurrency` — валюта отображения агрегатов. Конвертации в MVP нет: если чеки
в разных валютах, аналитика показывает их раздельно, а не складывает.

### Session

Хранит refresh-токены. Подробности ротации — в [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md).

```prisma
model Session {
  id            String    @id @default(uuid()) @db.Uuid
  userId        String    @db.Uuid
  tokenHash     String    @unique          // sha256 от refresh-токена
  family        String    @db.Uuid         // цепочка ротации
  rotatedFrom   String?   @db.Uuid
  userAgent     String?
  ipHash        String?                     // хеш, не сам адрес
  expiresAt     DateTime
  revokedAt     DateTime?
  createdAt     DateTime  @default(now())

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Сам токен не хранится, только его хеш. IP хранится в виде хеша — он нужен
для обнаружения аномалий, но не как персональные данные.

### Receipt

```prisma
model Receipt {
  id               String    @id @default(uuid()) @db.Uuid
  userId           String    @db.Uuid
  merchantId       String?   @db.Uuid

  purchasedAt      DateTime? @db.Date
  purchasedTime    String?                    // "HH:mm"
  currency         String    @db.Char(3)

  subtotalMinor    Int?
  taxTotalMinor    Int?
  discountTotalMinor Int?
  totalMinor       Int?

  receiptNumber    String?
  note             String?

  status           ReceiptStatus     @default(DRAFT)
  processingStatus ProcessingStatus  @default(PENDING)

  imageKey         String                     // ключ объекта в хранилище
  thumbnailKey     String?
  fileSha256       String    @db.Char(64)
  fileSizeBytes    Int
  mimeType         String

  confidence       ConfidenceLevel?
  fieldSources     Json      @default("{}")   // { "totalMinor": "USER", ... }
  entryMode        EntryMode @default(SCAN)

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  confirmedAt      DateTime?
  deletedAt        DateTime?

  user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  merchant         Merchant?     @relation(fields: [merchantId], references: [id], onDelete: SetNull)
  items            ReceiptItem[]
  jobs             ProcessingJob[]
}
```

Заметки по полям:

`totalMinor` допускает `null`, потому что чек существует с момента загрузки —
до того, как что-либо распознано.

`purchasedAt` допускает `null` по той же причине. Перед подтверждением
это поле обязательно.

`fieldSources` — объект, отображающий имя поля в `OCR | AI | USER`. Он решает
две задачи: при повторной обработке не затирать правки пользователя, и по
накопленным данным видеть, какие поля исправляют чаще всего. Полноценный
журнал изменений в MVP не нужен, а это — почти бесплатно.

`entryMode` различает `SCAN` и `MANUAL` — см. [ADR-0014](adr/0014-manual-entry-fallback.md).

### ReceiptItem

```prisma
model ReceiptItem {
  id             String    @id @default(uuid()) @db.Uuid
  receiptId      String    @db.Uuid
  categoryId     String?   @db.Uuid

  position       Int                          // порядок на чеке
  name           String
  rawText        String?                      // исходная строка распознавания

  lineType       LineType  @default(ITEM)
  quantity       Decimal   @db.Decimal(10, 3) @default(1)
  unit           ItemUnit  @default(PCS)

  unitPriceMinor Int?
  totalPriceMinor Int
  discountMinor  Int?

  confidence     ConfidenceLevel?

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  receipt        Receipt   @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  category       Category? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
}
```

`quantity` — обязательно дробное. На чеках ЕС весовые товары обычная вещь:
`0,532 kg × 2,99 €/kg`. Целое количество здесь округлило бы до единицы
и сломало сверку сумм.

`lineType` отличает покупку от служебных строк:

| Значение         | Что это                                                   |
| ---------------- | --------------------------------------------------------- |
| `ITEM`           | обычная покупка                                           |
| `DISCOUNT`       | скидка отдельной строкой, `totalPriceMinor` отрицательный |
| `DEPOSIT`        | депозит за тару (Pfand в Германии, kaucja в Польше)       |
| `DEPOSIT_RETURN` | возврат депозита, отрицательный                           |
| `FEE`            | сбор, доставка, упаковка                                  |

Различение нужно для аналитики: депозит за бутылку — не расход на продукты,
а возврат депозита вообще не расход. Смешивать их с покупками значит искажать
разбивку по категориям.

`totalPriceMinor` обязателен, `unitPriceMinor` — нет. На многих чеках цена
за единицу не печатается, а `total / quantity` даёт бесконечную дробь.

### Merchant

```prisma
model Merchant {
  id                String    @id @default(uuid()) @db.Uuid
  userId            String    @db.Uuid
  name              String                     // как на чеке
  normalizedName    String                     // для сопоставления
  defaultCategoryId String?   @db.Uuid
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  receipts          Receipt[]

  @@unique([userId, normalizedName])
}
```

Магазины принадлежат пользователю, а не общие. Общий справочник потребовал бы
модерации, разрешения конфликтов нормализации и создал бы канал утечки:
по общему справочнику видно, что кто-то покупал в конкретном магазине.
Дублирование записей между пользователями — приемлемая цена.

Нормализация в MVP простая: верхний регистр, схлопывание пробелов, удаление
организационно-правовых форм (GmbH, Sp. z o.o., S.A.) и хвостовых номеров
филиалов. Умное сопоставление — после MVP.

### Category

```prisma
model Category {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String?   @db.Uuid              // null = системная
  slug        String
  nameKey     String                          // ключ перевода
  icon        String?
  color       String?
  parentId    String?   @db.Uuid
  isSystem    Boolean   @default(true)
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user        User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  items       ReceiptItem[]

  @@unique([userId, slug])
}
```

В MVP только системные категории (`userId = null`). Поле `userId` присутствует
заранее, чтобы пользовательские категории не потребовали миграции.

Фиксированный набор — он же передаётся модели распознавания как закрытый список:

```text
groceries          продукты
restaurants        кафе, рестораны, доставка
household          бытовая химия, товары для дома
transport          топливо, билеты, такси
health             аптека, врачи
personal_care      косметика, гигиена, парикмахерская
clothing           одежда, обувь
electronics        техника, комплектующие
entertainment      развлечения, книги, подписки
services           услуги, ремонт, связь
other              всё остальное
uncategorized      служебная: расхождение итога и суммы позиций
```

`uncategorized` — псевдокатегория из [ADR-0007](adr/0007-analytics-source-of-truth.md).
Модель её никогда не выбирает, она вычисляется в аналитике.

Названия хранятся как ключи перевода, а не готовым текстом: интерфейс на английском,
но перевод добавится, и переименовывать записи в базе будет поздно.

### ProcessingJob

```prisma
model ProcessingJob {
  id              String    @id @default(uuid()) @db.Uuid
  receiptId       String    @db.Uuid
  requestId       String    @db.Uuid           // сквозной идентификатор

  status          JobStatus @default(WAITING)
  attempt         Int       @default(0)
  maxAttempts     Int       @default(3)

  extractorKind   String                       // "vision" | "two-stage" | "mock"
  providerModel   String?                      // фактически сработавшая модель

  startedAt       DateTime?
  finishedAt      DateTime?
  durationMs      Int?
  costMicros      Int?                         // стоимость в 1/1_000_000 USD

  errorCode       String?
  errorMessage    String?

  rawResultKey    String?                      // сырой ответ в хранилище
  rawResultExpiresAt DateTime?

  createdAt       DateTime  @default(now())

  receipt         Receipt   @relation(fields: [receiptId], references: [id], onDelete: Cascade)
}
```

Сырой ответ провайдера не хранится в базе — он большой и содержит весь текст чека.
Он кладётся в хранилище, а `rawResultExpiresAt` задаёт срок удаления (30 дней,
см. [ADR-0012](adr/0012-deferred-privacy-posture.md)).

`costMicros` заполняется даже на бесплатном тарифе — там он равен нулю.
Поле нужно, чтобы при переходе на платный провайдер стоимость была видна сразу,
а не выяснялась из счёта.

`providerModel` записывает фактически ответившую модель: при переборе кандидатов
это может быть не первая из списка.

### IdempotencyKey

```prisma
model IdempotencyKey {
  key         String    @id
  userId      String    @db.Uuid
  endpoint    String
  requestHash String    @db.Char(64)
  responseBody Json
  statusCode  Int
  createdAt   DateTime  @default(now())
  expiresAt   DateTime

  @@index([expiresAt])
}
```

Живут 24 часа, удаляются регулярной задачей.

---

## 4. Перечисления

```prisma
enum ReceiptStatus {
  DRAFT        // создан, ещё не подтверждён пользователем
  CONFIRMED    // пользователь проверил и сохранил
  ARCHIVED     // скрыт из истории, остаётся в аналитике
}

enum ProcessingStatus {
  PENDING      // файл загружен, задача не начата
  PROCESSING   // задача выполняется
  COMPLETED    // данные распознаны
  FAILED       // все попытки исчерпаны
  SKIPPED      // ручной ввод, распознавание не запускалось
}

enum JobStatus {
  WAITING
  ACTIVE
  COMPLETED
  FAILED
  RETRYING
}

enum ConfidenceLevel { HIGH  MEDIUM  LOW }

enum FieldSource { OCR  AI  USER }

enum EntryMode { SCAN  MANUAL }

enum LineType { ITEM  DISCOUNT  DEPOSIT  DEPOSIT_RETURN  FEE }

enum ItemUnit { PCS  KG  G  L  ML  M }
```

### Почему два перечисления статуса

Первая версия плана смешивала в одном списке бизнес-состояние (`CONFIRMED`)
и техническое (`OCR_COMPLETED`). Это разные оси: чек может быть подтверждён
пользователем и одновременно повторно обрабатываться.

`ReceiptStatus` отвечает на вопрос «что с чеком с точки зрения пользователя»,
`ProcessingStatus` — «что с распознаванием».

---

## 5. Переходы состояний

### ProcessingStatus

```text
                    ┌──────────────────────────────┐
                    ▼                              │
   [загрузка] → PENDING → PROCESSING → COMPLETED   │
                    │          │                   │
                    │          └──→ FAILED ────────┘
                    │                   │      reprocess
                    └──→ SKIPPED ◄──────┘
                          ручной ввод
```

| Переход                            | Кто инициирует | Условие                                    |
| ---------------------------------- | -------------- | ------------------------------------------ |
| — → `PENDING`                      | система        | файл загружен, задача поставлена           |
| `PENDING` → `PROCESSING`           | worker         | задача взята в работу                      |
| `PROCESSING` → `COMPLETED`         | worker         | ответ получен и прошёл валидацию схемой    |
| `PROCESSING` → `PENDING`           | worker         | повторяемая ошибка, попытки не исчерпаны   |
| `PROCESSING` → `FAILED`            | worker         | неповторяемая ошибка или попытки исчерпаны |
| `FAILED` / `COMPLETED` → `PENDING` | пользователь   | повторная обработка                        |
| любой → `SKIPPED`                  | пользователь   | выбран ручной ввод                         |

### ReceiptStatus

```text
   DRAFT ──confirm──→ CONFIRMED ──archive──→ ARCHIVED
     │                    ▲    │                 │
     │                    └────┘                 │
     │                  правка разрешена         │
     └──────── delete ──────────────────────────┘
                    (soft delete)
```

Правка после подтверждения разрешена — пользователь может заметить ошибку позже.
Изменённые поля получают `source = USER` в `fieldSources`.

### Инварианты

Проверяются на бэкенде при подтверждении:

- `CONFIRMED` требует непустых `purchasedAt`, `currency`, `totalMinor`;
- `CONFIRMED` не требует наличия позиций — ручной ввод только итоговой суммы законен;
- в аналитику попадают только `CONFIRMED` и `ARCHIVED`;
- повторная обработка чека в статусе `CONFIRMED` не сбрасывает подтверждение
  и не затирает поля с `source = USER`.

---

## 6. Проверки целостности

Выполняются на бэкенде перед сохранением.

**Жёсткие** — нарушение возвращает ошибку:

```text
quantity > 0
totalPriceMinor      — целое, для ITEM/DEPOSIT/FEE >= 0
unitPriceMinor       — целое >= 0, если задано
totalMinor >= 0
currency             — существующий код ISO 4217
purchasedAt          — не в будущем, не старше 10 лет
чек принадлежит текущему пользователю
```

**Мягкие** — показываются как предупреждение, сохранение не блокируют:

```text
sum(items.totalPriceMinor) ≈ subtotalMinor
subtotalMinor - discountTotalMinor + taxTotalMinor ≈ totalMinor
```

Допуск — большее из двух: 2 минорные единицы или 1% от итога. Первое покрывает
округление на чеке, второе — крупные чеки с множеством позиций.

Именно мягкость здесь принципиальна. На реальных чеках суммы не сходятся регулярно:
скидка на весь чек, залог, нераспознанная строка, округление кассы. Жёсткая проверка
превратила бы обычный чек в неустранимую ошибку и заблокировала бы пользователя.
Расхождение — это сигнал в интерфейсе и понижение уверенности, но не запрет.

---

## 7. Индексы

```prisma
@@index([userId, purchasedAt(sort: Desc)])          // Receipt: история и аналитика
@@index([userId, status, purchasedAt])              // Receipt: аналитика по подтверждённым
@@index([userId, processingStatus])                 // Receipt: «в обработке»
@@unique([userId, fileSha256])                      // Receipt: дедупликация
@@index([merchantId])                               // Receipt

@@index([receiptId, position])                      // ReceiptItem
@@index([categoryId])                               // ReceiptItem: разбивка по категориям

@@unique([userId, normalizedName])                  // Merchant
@@index([receiptId, createdAt(sort: Desc)])         // ProcessingJob
@@index([status, createdAt])                        // ProcessingJob: зависшие задачи
@@index([expiresAt])                                // Session, IdempotencyKey: очистка
```

### Мягкое удаление и уникальность

Уникальный индекс `(userId, fileSha256)` конфликтует с мягким удалением: удалив
чек, пользователь не сможет загрузить тот же файл снова, потому что запись
осталась в базе.

Решается частичным индексом, который Prisma не умеет выразить декларативно —
он создаётся вручную в миграции:

```sql
CREATE UNIQUE INDEX receipts_user_file_active_idx
  ON receipts (user_id, file_sha256)
  WHERE deleted_at IS NULL;
```

Тот же приём применяется к `(userId, normalizedName)` у магазинов.

Все обычные выборки обязаны фильтровать `deletedAt IS NULL`. Это обеспечивается
не дисциплиной, а расширением Prisma-клиента — см. [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md).

---

## 8. Миграции

Prisma Migrate. Файлы миграций коммитятся, применяются командой при деплое.

Для изменений, ломающих совместимость, — схема «расширить, потом сузить»:
сначала добавить новое поле и писать в оба, затем перевести чтение, затем удалить
старое. В соло-проекте с одним экземпляром приложения это избыточно, но
переименование колонки в один шаг всё равно теряет данные при откате.

Правило: миграция, удаляющая колонку или таблицу, идёт отдельным коммитом
после того, как код перестал их использовать.

---

## 9. Что удаляется вместе с чеком

Удаление чека — мягкое: проставляется `deletedAt`, запись остаётся.

Окончательное удаление выполняется регулярной задачей через 30 дней после
мягкого и затрагивает:

```text
receipt_items       каскадом
processing_jobs     каскадом
объект изображения       в хранилище
объект уменьшенной копии в хранилище
сырые ответы распознавания в хранилище
```

Удаление аккаунта удаляет всё перечисленное немедленно, без отсрочки,
плюс сессии, магазины и пользовательские категории.

Объекты в хранилище удаляются в той же операции, что и записи в базе, но
хранилище не участвует в транзакции. Поэтому нужна регулярная сверка: объекты,
на которые не ссылается ни одна запись, удаляются как осиротевшие.
