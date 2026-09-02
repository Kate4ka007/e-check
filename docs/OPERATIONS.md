# Эксплуатация

Локальная разработка, окружения, конфигурация, деплой, наблюдаемость.

---

## 1. Локальная разработка

### Требования

Node.js 22, pnpm 10, Docker. На Windows — Docker Desktop с WSL2.

### Запуск

```bash
pnpm install
docker compose up -d          # postgres, redis, minio
pnpm db:migrate
pnpm db:seed                  # категории и один аккаунт
pnpm dev                      # api, worker, web
```

Инфраструктура в Docker, приложения — процессами на хосте. Так быстрее
цикл правки: пересборка контейнера ради изменения одной строки съедает
несоразмерно много времени.

### docker compose

```text
postgres      5432    основная база
postgres-test 5433    база для тестов
redis         6379    очередь и ограничение частоты
minio         9000    хранилище, консоль на 9001
```

Тестовая база — отдельным сервисом, чтобы прогон тестов не затирал
данные разработки. Подробности в [TESTING.md](TESTING.md).

Тома в `.docker-data/`, каталог в `.gitignore`. Полный сброс —
`docker compose down -v`.

### Особенности Windows

`.gitattributes` задаёт `eol=lf`. Без этого CRLF попадает в скрипты
и файлы, которые читаются внутри контейнеров, и они ломаются
с невнятными ошибками.

Проект стоит держать в файловой системе Windows и запускать Node
на хосте. Вариант с исходниками на диске Windows и Node внутри WSL
даёт заметно медленное чтение файлов.

---

## 2. Окружения

Два: `local` и `production`.

Staging не заводится до появления внешних пользователей. Для соло-проекта
это третья копия инфраструктуры, которую нужно поддерживать, ради
проверок, которые пока делаются локально.

|               | local              | production           |
| ------------- | ------------------ | -------------------- |
| База          | Postgres в Docker  | управляемый Postgres |
| Redis         | Docker             | управляемый Redis    |
| Хранилище     | MinIO              | Cloudflare R2        |
| Фронтенд      | dev-сервер Nuxt    | статика на CDN       |
| API и worker  | процессы на хосте  | контейнеры           |
| Распознавание | мок или OpenRouter | OpenRouter           |
| Регистрация   | открыта            | закрыта              |

Закрытая регистрация в production — см.
[SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md), раздел 7.

---

## 3. Конфигурация

Только переменные окружения. При старте они проверяются Zod-схемой:
приложение падает, если обязательная переменная отсутствует или
имеет неверный формат. Отказ при запуске лучше, чем непонятная ошибка
на первом чеке.

### API и worker

```bash
NODE_ENV=development
PORT=3001
APP_URL=http://localhost:3000            # для CORS и ссылок

DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=
JWT_ACCESS_TTL=15m
REFRESH_TTL=30d
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false                      # true в production

S3_ENDPOINT=http://localhost:9000
S3_REGION=auto
S3_BUCKET=receipts
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_FORCE_PATH_STYLE=true                 # требуется для MinIO

EXTRACTOR_KIND=mock                      # mock | vision | two-stage
EXTRACTOR_BASE_URL=https://openrouter.ai/api/v1
EXTRACTOR_API_KEY=
EXTRACTOR_MODELS=model-a:free,model-b:free
EXTRACTOR_TIMEOUT_MS=60000
EXTRACTOR_MAX_ATTEMPTS=3
EXTRACTOR_DATA_COLLECTION=allow          # deny перед внешними пользователями

UPLOAD_MAX_BYTES=15728640
UPLOAD_RATE_PER_HOUR=30

REGISTRATION_ENABLED=true                # false в production
SENTRY_DSN=
LOG_LEVEL=debug
```

### Фронтенд

```bash
NUXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
NUXT_PUBLIC_SENTRY_DSN=
NUXT_PUBLIC_SITE_URL=http://localhost:3000
```

`NUXT_PUBLIC_SITE_URL` — абсолютный origin для `sitemap.xml`. В production
на Vercel ставьте канонический URL сайта; если не задан, берётся `VERCEL_URL`.

Только эти. Всё остальное — на бэкенде. Переменные с префиксом
`NUXT_PUBLIC_` попадают в бандл и видны всем; ключи провайдеров туда
попасть не должны никогда.

`EXTRACTOR_DATA_COLLECTION` вынесена в конфигурацию отдельно именно
затем, чтобы переключение перед приходом внешних пользователей было
изменением одной переменной, а не поиском по коду
([ADR-0012](adr/0012-deferred-privacy-posture.md)).

---

## 4. Деплой

### Принцип

Пустое приложение выкатывается в production в M0, до написания
функциональности. Не чтобы что-то показать, а чтобы деплой не оказался
сюрпризом на последнем месяце — обычно именно там обнаруживается,
что переменные не заданы, миграции не применяются, а домен не настроен.

### Выбранная схема (free tier, без карты где возможно)

| Компонент    | Площадка                                     | Карта                                        |
| ------------ | -------------------------------------------- | -------------------------------------------- |
| Фронтенд     | **Vercel** Hobby                             | не нужна                                     |
| API + worker | **Render** Free Web Service (один контейнер) | не нужна                                     |
| PostgreSQL   | **Neon**                                     | не нужна                                     |
| Redis        | **Upstash**                                  | не нужна                                     |
| Файлы чеков  | **Cloudflare R2** или **Supabase Storage**   | R2: PayPal/карта; Supabase: обычно без карты |

Отдельный Background Worker на Render free **недоступен** (от ~$7/мес).
На бесплатном тарифе API и worker запускаются вместе через
`apps/api/scripts/start-production.cjs` (см. `Dockerfile`, `render.yaml`).

Render Postgres на free живёт 30 дней — используй Neon, не Render DB.

```text
Браузер
  → Vercel (Nuxt: HTML для `/` и `/demo`, SPA за сессией)
      → /api/* проксируется на Render (vercel.json)
  → Render (API + worker в Docker)
      → Neon, Upstash, R2/Supabase
```

Cookies: фронт и API на разных доменах (`*.vercel.app` и `*.onrender.com`).
Прокси через Vercel держит запросы на одном origin — авторизация работает
без своего домена. `NUXT_PUBLIC_API_BASE_URL=/api/v1` (относительный путь).

### Файлы деплоя в репозитории

| Файл                                    | Назначение                     |
| --------------------------------------- | ------------------------------ |
| `Dockerfile`                            | образ API + worker             |
| `render.yaml`                           | Blueprint для Render           |
| `apps/web/vercel.json`                  | прокси `/api/*` → Render       |
| `apps/api/scripts/start-production.cjs` | миграции + запуск API и worker |

Локально production-режим API+worker:

```bash
pnpm build
cd apps/api && pnpm start:production
```

### Пошаговый деплой

#### 0. Репозиторий на GitHub

Vercel и Render деплоят из git. Код должен быть в публичном или приватном
репозитории на GitHub.

#### 1. Neon (PostgreSQL)

1. [neon.tech](https://neon.tech) → регистрация (без карты).
2. Create project, регион ближе к EU (Frankfurt).
3. Скопировать **pooled connection string**:
   `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`

#### 2. Upstash (Redis)

1. [upstash.com](https://upstash.com) → регистрация (без карты).
2. Create Redis database, регион EU.
3. Скопировать **Redis URL**:
   `rediss://default:xxx@xxx.upstash.io:6379`

#### 3. Хранилище файлов

**Cloudflare R2** (нужен PayPal или карта для активации, в free tier не списывает):

1. R2 → bucket `receipts`.
2. S3 API credentials.
3. `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_FORCE_PATH_STYLE=false`.

**Supabase Storage** (альтернатива без карты, ~1 GB free):
[S3-compatible endpoint](https://supabase.com/docs/guides/storage/s3/compatibility).

```bash
S3_ENDPOINT=https://<project_ref>.storage.supabase.co/storage/v1/s3
S3_REGION=<регион из Supabase Dashboard>
S3_FORCE_PATH_STYLE=true   # обязательно; без этого TLS handshake падает с EPROTO
```

Для R2 оставь `S3_FORCE_PATH_STYLE=false`. Если endpoint содержит `supabase.co`,
API принудительно включает path style даже при `false` в env.

#### 4. Render (API + worker)

1. [render.com](https://render.com) → Sign up через GitHub (без карты).
2. **New → Blueprint** → репозиторий `e-check` → Render прочитает `render.yaml`.
   Либо **New → Web Service** вручную: Runtime **Docker**, Dockerfile `./Dockerfile`, Plan **Free**, Region **Frankfurt**.
3. Задать секреты (`sync: false` в Blueprint):

```bash
APP_URL=https://<project>.vercel.app          # после деплоя Vercel, см. шаг 5
DATABASE_URL=postgresql://...neon...
REDIS_URL=rediss://...upstash...
JWT_ACCESS_SECRET=<случайная строка 32+ символов>
S3_ENDPOINT=...
S3_BUCKET=receipts
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
EXTRACTOR_API_KEY=sk-or-v1-...
```

`PORT` Render задаёт сам — в env не указывать.

4. Deploy → проверка (первый запрос после простоя может занять 30–60 с):

```text
https://e-check-api.onrender.com/api/v1/health
```

5. Seed (один раз), локально с Neon `DATABASE_URL`:

```bash
pnpm db:seed
```

Если имя сервиса на Render не `e-check-api`, обнови `destination` в
`apps/web/vercel.json`.

#### 5. Vercel (фронтенд)

1. [vercel.com](https://vercel.com) → Import GitHub repo.
2. Настройки проекта:

| Поле             | Значение                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| Framework Preset | Nuxt.js                                                                                                  |
| Root Directory   | `apps/web`                                                                                               |
| Install Command  | `cd ../.. && pnpm install`                                                                               |
| Build Command    | `cd ../.. && pnpm --filter @receipt-tracker/contracts build && pnpm --filter @receipt-tracker/web build` |

3. Environment Variables:

```bash
NUXT_PUBLIC_API_BASE_URL=/api/v1
NUXT_PUBLIC_SITE_URL=https://scan-cheki.vercel.app
```

4. Deploy → URL вида `https://scan-cheki.vercel.app`.

5. В Render обновить `APP_URL` на этот URL → **Manual Deploy** API.

#### 6. Проверка

1. Открыть URL Vercel.
2. Войти (если делал seed: пароль из `SEED_DEV_PASSWORD` в local `.env`).
3. Загрузить чек → дождаться распознавания.
4. Проверить и подтвердить.

### Ограничения free tier

| Что                                   | Эффект                                                 |
| ------------------------------------- | ------------------------------------------------------ |
| Render засыпает через ~15 мин простоя | холодный старт 30–60 с; worker тоже спит               |
| Vision 30–120 с                       | длинные задачи могут упираться в таймауты платформы    |
| Upstash                               | 500K команд/мес — для личного использования достаточно |
| Neon                                  | 0.5 GB — достаточно для начала                         |

### Порядок выкладки

```text
1. Neon + Upstash + хранилище
2. Render (API + worker; миграции в start-production)
3. Vercel (фронтенд)
4. APP_URL на Render = URL Vercel
```

Миграции выполняются при каждом старте контейнера (`prisma migrate deploy`).
Фронтенд последним, чтобы не обращаться к API до его готовности.

### Откат

Фронтенд — возврат к предыдущей сборке в Vercel. API — предыдущий образ
в Render. База назад не откатывается: миграции пишутся так, чтобы предыдущая
версия кода работала с новой схемой.

---

## 5. Наблюдаемость

Подключается в M1, а не в конце. Отлаживать асинхронную обработку
без логов и трассировки ошибок — гадание.

### Логи

`pino`, структурные, JSON. Каждая запись содержит `requestId`,
проходящий через HTTP-запрос, задачу в очереди и все вызовы провайдера.
Идентификатор хранится в `AsyncLocalStorage` и не передаётся параметром.

Уровни: `debug` локально, `info` в production.

Что не логируется — перечислено в
[SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md), раздел 6.

### Ошибки

Sentry на бэкенде и фронтенде, с общим `requestId` — по одной ошибке
в интерфейсе находится соответствующая цепочка на сервере.

Фильтрация тел запросов и cookie обязательна: иначе в Sentry уедут
данные чеков и токены.

### Метрики

Пока пользователь один, отдельная система метрик избыточна. Данные
берутся запросами к базе: таблица `processing_jobs` содержит длительность,
стоимость, модель и код ошибки по каждой задаче.

Простая страница в настройках показывает за последние 30 дней:

```text
загружено чеков
доля успешных обработок
p50 и p95 длительности
суммарная стоимость
manual_correction_rate
```

Последняя метрика — главная, см. [PROJECT_PLAN.md](PROJECT_PLAN.md), раздел 11.

Полноценные Prometheus и OpenTelemetry — когда появятся внешние пользователи
и один экземпляр перестанет быть единственным.

---

## 6. Регулярные задачи

Отдельные задачи BullMQ по расписанию.

| Задача                         | Период        | Что делает                                   |
| ------------------------------ | ------------- | -------------------------------------------- |
| Удаление просроченных сессий   | ежедневно     | `expiresAt < now`                            |
| Очистка ключей идемпотентности | ежечасно      | `expiresAt < now`                            |
| Окончательное удаление чеков   | ежедневно     | `deletedAt` старше 30 дней, вместе с файлами |
| Удаление сырых ответов         | ежедневно     | `rawResultExpiresAt < now`                   |
| Поиск осиротевших объектов     | еженедельно   | объекты в хранилище без записи в базе        |
| Разблокировка зависших задач   | каждые 10 мин | `ACTIVE` дольше 5 минут → `FAILED`           |

Последняя нужна из-за того, что worker может умереть посреди задачи.
Без неё чек навсегда останется в состоянии «обрабатывается», и пользователь
не сможет ни дождаться, ни повторить.

Поиск осиротевших объектов необходим, потому что хранилище не участвует
в транзакции базы: при сбое между удалением записи и удалением файла
объект остаётся навсегда.

---

## 7. Резервное копирование

До внешних пользователей — автоматические резервные копии управляемого
Postgres на стороне провайдера, этого достаточно.

С появлением внешних пользователей: ежедневная выгрузка базы в отдельный
бакет с хранением 30 дней и — главное — регулярная проверка восстановления.
Резервная копия, из которой ни разу не восстанавливались, резервной копией
не является.

Изображения в R2 версионируются самим хранилищем.

---

## 8. Диагностика частых проблем

**Чек навис в `PROCESSING`.** Смотреть `processing_jobs` по `receiptId`:
там `attempt`, `errorCode` и `providerModel`. Если worker не запущен,
задача останется в `WAITING`. Регулярная задача разблокировки переведёт
её в `FAILED` через 5 минут.

**Распознавание отдаёт `404`.** Бесплатная модель исчезла из OpenRouter.
Проверить список доступных и обновить `EXTRACTOR_MODELS`. Ожидаемое
поведение, см. [ADR-0011](adr/0011-free-tier-first.md).

**Распознавание отдаёт `429`.** Исчерпан дневной лимит. До сброса
работать с `EXTRACTOR_KIND=mock` либо на кэшированных результатах.

**Изображение не открывается.** Подписанная ссылка живёт 15 минут.
Обновить страницу. Если не помогло — проверить `S3_FORCE_PATH_STYLE`:
для MinIO он обязан быть `true`.

**Тесты падают на уникальном индексе.** Забыт откат транзакции между
тестами либо тестовая база смешалась с базой разработки — проверить порт.
