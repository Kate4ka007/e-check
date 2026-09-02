# Receipt Tracker — Detailed Project Plan

## 1. Project Overview

**Receipt Tracker** — веб-приложение для сканирования чеков, автоматического распознавания покупок и анализа расходов.

### Core value proposition

Пользователь должен иметь возможность:

1. Сфотографировать или загрузить чек.
2. Получить автоматически распознанные данные.
3. Проверить и исправить результат.
4. Сохранить чек.
5. Видеть расходы по периодам, категориям и магазинам.
6. Накапливать историю покупок и использовать её для аналитики.

### Primary user flow

```text
Open application
      ↓
Scan / Upload receipt
      ↓
Image validation
      ↓
OCR
      ↓
Receipt parsing
      ↓
Normalization + validation
      ↓
User review
      ↓
Save receipt
      ↓
Expense analytics
```

---

# 2. Goals and Non-Goals

## 2.1 Goals for MVP

- Быстрое добавление чека.
- Распознавание основных полей.
- Редактирование распознанных данных.
- Сохранение чека и его изображения.
- Категоризация покупок.
- История чеков.
- Базовая статистика расходов.
- Поддержка нескольких валют на уровне модели данных.
- Надёжная обработка ошибок OCR/AI.
- Возможность повторной обработки чека.

## 2.2 Non-goals for MVP

Следующие функции не входят в первую версию:

- Банковская синхронизация.
- Open Banking.
- Совместные семейные счета.
- Автоматические платежи.
- Инвестиционная аналитика.
- Полноценный бухгалтерский учёт.
- Нативные iOS/Android приложения.
- Сложный offline-first режим.
- Распознавание банковских выписок.
- Продвинутая прогнозная аналитика.

---

# 3. Product Scope

## 3.1 MVP modules

```text
Authentication
Receipts
Receipt Processing
Receipt Editor
Expenses
Categories
Dashboard
Analytics
Profile / Settings
```

## 3.2 Future modules

```text
Budgets
Recurring expenses
Shared households
Notifications
Smart category suggestions
Merchant recognition
Price history
Shopping statistics
AI spending assistant
Export / import
Bank integrations
```

---

# 4. User Roles

На MVP существует только один основной пользовательский тип:

```text
User
```

Будущий вариант:

```text
User
 └── Household
      ├── Owner
      ├── Member
      └── Viewer
```

Поддержку нескольких пользователей в одном household пока не реализуем, но схему данных не следует строить так, чтобы это было невозможно позже.

---

# 5. Functional Requirements

## 5.1 Authentication

Пользователь должен иметь возможность:

- зарегистрироваться;
- войти;
- выйти;
- обновить access session;
- восстановить пароль в будущем;
- изменить профиль.

### MVP auth flow

```text
Login
  ↓
HttpOnly refresh token
  ↓
Short-lived access token / session
```

Рекомендуемый вариант для браузера:

- refresh token хранится в `HttpOnly`, `Secure` cookie;
- access token не хранится в `localStorage`;
- API защищает ресурсы через guard.

---

## 5.2 Receipt Upload

Поддерживаемые способы добавления:

```text
Camera
File upload
Drag & drop
```

### Supported formats

На MVP:

- JPEG
- PNG
- WEBP
- PDF — можно добавить после стабилизации image pipeline

### Validation

Проверяем:

- MIME type;
- размер файла;
- разрешение изображения;
- отсутствие повреждений;
- допустимое соотношение сторон.

Пример ограничений MVP:

```text
Max file size: 15 MB
Recommended resolution: 1200+ px on long side
```

Фактические лимиты должны задаваться конфигурацией backend.

---

# 6. Receipt Processing Pipeline

Это центральная часть приложения.

## 6.1 Pipeline

```text
Uploaded image
      ↓
Storage
      ↓
Receipt created
      ↓
Processing job created
      ↓
Image preprocessing
      ↓
OCR provider
      ↓
Raw OCR result
      ↓
Receipt parser / AI
      ↓
Structured receipt data
      ↓
Validation / normalization
      ↓
Confidence calculation
      ↓
Ready for review
```

## 6.2 Processing statuses

```text
UPLOADED
PROCESSING
OCR_COMPLETED
PARSING
READY_FOR_REVIEW
CONFIRMED
FAILED
```

### Important rule

Processing должно быть асинхронным.

Нельзя держать HTTP request открытым до окончания OCR и AI processing.

Frontend должен получать состояние обработки через polling на MVP или через SSE/WebSocket позднее.

---

# 7. OCR Layer

## 7.1 Abstraction

NestJS не должен зависеть напрямую от конкретного OCR provider.

Используем абстракцию:

```ts
export interface OcrProvider {
  recognize(input: OcrInput): Promise<OcrResult>
}
```

Пример архитектуры:

```text
OcrService
    ↓
OcrProvider interface
    ↓
Google Vision / AWS Textract / Azure OCR / other provider
```

## 7.2 OCR result

OCR возвращает не только текст, но желательно bounding boxes и confidence.

```ts
interface OcrResult {
  text: string
  blocks: OcrBlock[]
}

interface OcrBlock {
  text: string
  confidence?: number
  boundingBox?: BoundingBox
}
```

Bounding boxes позволят в будущем показывать связь между распознанными значениями и изображением чека.

---

# 8. AI Receipt Parsing

OCR и parsing должны быть отдельными этапами.

OCR отвечает на вопрос:

> Что написано на изображении?

Parser отвечает на вопрос:

> Какие поля чека соответствуют этому тексту?

## 8.1 Input

```json
{
  "rawText": "LIDL\n28.08.2026\nMILCH 1.29\nBROT 1.49\nSUMME 2.78 EUR"
}
```

## 8.2 Output

```json
{
  "merchant": {
    "name": "LIDL"
  },
  "date": "2026-08-28",
  "currency": "EUR",
  "items": [
    {
      "name": "MILCH",
      "quantity": 1,
      "unitPrice": 1.29,
      "totalPrice": 1.29,
      "category": "GROCERIES"
    },
    {
      "name": "BROT",
      "quantity": 1,
      "unitPrice": 1.49,
      "totalPrice": 1.49,
      "category": "GROCERIES"
    }
  ],
  "subtotal": 2.78,
  "discountTotal": 0,
  "total": 2.78
}
```

## 8.3 Provider abstraction

Используем:

```ts
export interface ReceiptParser {
  parse(input: ReceiptParserInput): Promise<ParsedReceipt>
}
```

Такой подход позволит заменить AI provider без изменения бизнес-логики.

---

# 9. Receipt Data Model

## 9.1 Receipt

```text
Receipt
├── id
├── userId
├── merchantId?
├── receiptNumber?
├── purchasedAt
├── currency
├── subtotal?
├── taxTotal?
├── discountTotal?
├── total
├── imageUrl
├── status
├── processingStatus
├── ocrConfidence?
├── parsingConfidence?
├── createdAt
├── updatedAt
└── deletedAt?
```

## 9.2 Receipt Item

```text
ReceiptItem
├── id
├── receiptId
├── productName
├── quantity
├── unitPrice?
├── totalPrice
├── discount?
├── categoryId?
├── rawText?
├── confidence?
├── createdAt
└── updatedAt
```

## 9.3 Merchant

```text
Merchant
├── id
├── name
├── normalizedName
├── country?
├── defaultCategoryId?
├── createdAt
└── updatedAt
```

---

# 10. Categories

## 10.1 Default categories

```text
FOOD
RESTAURANTS
HOUSEHOLD
TRANSPORT
HEALTH
PERSONAL_CARE
ELECTRONICS
CLOTHING
ENTERTAINMENT
SERVICES
OTHER
```

## 10.2 Category model

```text
Category
├── id
├── userId?
├── name
├── slug
├── parentId?
├── isSystem
├── createdAt
└── updatedAt
```

`userId = null` может означать системную категорию.

---

# 11. Expenses

На уровне модели данных расход лучше не дублировать полностью, если он уже является частью receipt item.

Основная связь:

```text
Receipt
  └── ReceiptItem
        └── Category
```

Для агрегированной аналитики расходы вычисляются из receipt items.

Если в будущем понадобится manual expense без чека, добавляется отдельная сущность:

```text
Expense
├── id
├── userId
├── amount
├── currency
├── categoryId
├── merchantId?
├── occurredAt
├── note?
├── receiptId?
└── createdAt
```

На MVP эту сущность можно не вводить, если manual expenses не входят в scope.

---

# 12. Database

## 12.1 Recommended stack

```text
PostgreSQL
Prisma
```

## 12.2 Main tables

```text
users
refresh_tokens / sessions
receipts
receipt_items
merchants
categories
receipt_processing_jobs
ocr_results
```

AI/OCR raw payloads желательно хранить отдельно или в object storage, если provider response большой.

## 12.3 Important indexes

Обязательно предусмотреть индексы на:

```text
users.email
receipts.user_id
receipts.purchased_at
receipts.user_id + purchased_at
receipt_items.receipt_id
receipt_items.category_id
merchants.normalized_name
processing_jobs.status
```

---

# 13. Receipt Processing Jobs

Для асинхронной обработки нужен job layer.

Recommended:

```text
BullMQ
Redis
```

Архитектура:

```text
NestJS API
   ↓
Queue
   ↓
Redis
   ↓
Worker
   ├── image processing
   ├── OCR
   ├── AI parsing
   └── validation
```

## 13.1 Job states

```text
WAITING
ACTIVE
COMPLETED
FAILED
RETRYING
```

## 13.2 Retry strategy

Ретраи необходимы для временных ошибок provider/API.

Например:

```text
Attempt 1
   ↓
wait
   ↓
Attempt 2
   ↓
wait longer
   ↓
Attempt 3
   ↓
Failed
```

Для не-retryable ошибок job сразу переводится в `FAILED`.

---

# 14. Object Storage

Изображения чеков не следует хранить в PostgreSQL.

Использовать S3-compatible storage:

```text
AWS S3
Cloudflare R2
MinIO
Hetzner Object Storage
```

Database хранит только metadata и object key.

```text
receipts.image_key
```

Для frontend выдаются временные signed URLs.

---

# 15. Backend Architecture — NestJS

## 15.1 Project structure

```text
backend/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   │
│   ├── auth/
│   ├── users/
│   ├── receipts/
│   ├── receipt-processing/
│   ├── ocr/
│   ├── receipt-parser/
│   ├── merchants/
│   ├── categories/
│   ├── analytics/
│   ├── storage/
│   ├── jobs/
│   │
│   ├── common/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── filters/
│   │   ├── pipes/
│   │   ├── decorators/
│   │   └── utils/
│   │
│   └── config/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── test/
└── package.json
```

## 15.2 Module responsibilities

### AuthModule

Отвечает за:

- registration;
- login;
- logout;
- refresh session;
- password hashing;
- guards.

### ReceiptsModule

Отвечает за:

- создание receipt;
- получение receipt;
- обновление receipt;
- удаление receipt;
- list/filter/sort.

### ReceiptProcessingModule

Оркестрирует:

```text
upload → queue → OCR → parser → validation
```

### OcrModule

Предоставляет provider abstraction.

### ReceiptParserModule

Преобразует OCR result в structured receipt.

### CategoriesModule

Отвечает за категории и пользовательские категории.

### AnalyticsModule

Готовит агрегаты для dashboard.

---

# 16. Backend API

API versioning:

```text
/api/v1
```

## 16.1 Auth

```http
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

## 16.2 Receipts

```http
POST   /api/v1/receipts
GET    /api/v1/receipts
GET    /api/v1/receipts/:id
PATCH  /api/v1/receipts/:id
DELETE /api/v1/receipts/:id
```

## 16.3 Receipt upload

Вариант API:

```http
POST /api/v1/receipts/upload
```

Response:

```json
{
  "receiptId": "c7e3f4b0-0b0a-4bdb-8af7-6f85b2219d90",
  "status": "PROCESSING"
}
```

## 16.4 Processing

```http
GET /api/v1/receipts/:id/processing
POST /api/v1/receipts/:id/reprocess
```

## 16.5 Categories

```http
GET    /api/v1/categories
POST   /api/v1/categories
PATCH  /api/v1/categories/:id
DELETE /api/v1/categories/:id
```

## 16.6 Analytics

```http
GET /api/v1/analytics/summary
GET /api/v1/analytics/by-category
GET /api/v1/analytics/by-merchant
GET /api/v1/analytics/timeline
```

---

# 17. API Contract Principles

Все DTO должны валидироваться на backend.

Используем:

- `class-validator`;
- `class-transformer`;
- DTO per endpoint;
- consistent error format.

Пример error response:

```json
{
  "statusCode": 422,
  "code": "RECEIPT_VALIDATION_ERROR",
  "message": "Receipt data is invalid",
  "details": {
    "total": ["Total must be greater than or equal to 0"]
  },
  "requestId": "b4d0b8ef-7c71-4a4e-bc89-d1a0c4f7d38e"
}
```

---

# 18. Frontend Architecture — Vue / Nuxt

## 18.1 Stack

```text
Vue 3
Nuxt 3
TypeScript
Composition API
<script setup>
Pinia
SCSS
```

Data fetching/cache layer может быть реализован через Nuxt `useFetch` / `useAsyncData`, либо отдельный query layer при росте приложения.

Pinia не должна использоваться как глобальный cache для каждого API response.

---

# 19. Frontend Structure

```text
frontend/
├── app/
│   ├── pages/
│   │   ├── index.vue
│   │   ├── login.vue
│   │   ├── register.vue
│   │   ├── receipts/
│   │   │   ├── index.vue
│   │   │   ├── create.vue
│   │   │   └── [id].vue
│   │   ├── expenses/
│   │   │   └── index.vue
│   │   ├── analytics/
│   │   │   └── index.vue
│   │   └── settings/
│   │       └── index.vue
│   │
│   ├── components/
│   │   ├── receipt/
│   │   ├── expense/
│   │   ├── analytics/
│   │   ├── dashboard/
│   │   └── ui/
│   │
│   ├── composables/
│   ├── stores/
│   ├── middleware/
│   ├── services/
│   ├── types/
│   ├── utils/
│   └── assets/
│
├── public/
└── package.json
```

---

# 20. Frontend Pages

## 20.1 Dashboard

Показывает:

```text
Current month total
Previous month comparison
Top categories
Recent receipts
Spending timeline
Quick scan action
```

## 20.2 Receipt list

Возможности:

- поиск;
- фильтр по датам;
- фильтр по категории;
- фильтр по merchant;
- сортировка;
- pagination.

## 20.3 Receipt scanner

Flow:

```text
Choose source
  ↓
Camera / Upload
  ↓
Preview
  ↓
Crop / rotate (optional)
  ↓
Upload
  ↓
Processing state
```

## 20.4 Receipt review

Ключевой UI экрана.

```text
┌────────────────────────────────────┐
│ Receipt image     Parsed data      │
│                                    │
│ [image]           Merchant         │
│                    Date             │
│                    Currency         │
│                                    │
│                    Items            │
│                    ┌─────────────┐  │
│                    │ Product     │  │
│                    │ Qty         │  │
│                    │ Price       │  │
│                    │ Category    │  │
│                    └─────────────┘  │
│                                    │
│                    Total            │
│                                    │
│              [Save receipt]        │
└────────────────────────────────────┘
```

На mobile layout должен становиться вертикальным.

---

# 21. Receipt Editor UX

Каждое распознанное поле должно быть editable.

Особое внимание:

- merchant;
- date;
- currency;
- item name;
- quantity;
- unit price;
- total price;
- category;
- total.

### Confidence UI

Если confidence низкий, поле можно визуально маркировать как требующее проверки.

Например:

```text
High confidence
Medium confidence
Low confidence → review required
```

Но confidence не должен блокировать пользователя от сохранения.

---

# 22. State Management

## Pinia stores

Минимально:

```text
authStore
uiStore
```

Receipt data и analytics лучше получать через server-state layer.

Pinia нужен для:

- authenticated user;
- global UI state;
- persistent client preferences.

Не следует создавать:

```text
receiptsStore
expensesStore
analyticsStore
```

только ради хранения обычных API responses.

---

# 23. API Client

Нужен единый HTTP слой.

```text
services/api/
├── client.ts
├── auth.api.ts
├── receipts.api.ts
├── categories.api.ts
└── analytics.api.ts
```

Требования:

- typed requests;
- typed responses;
- centralized error handling;
- request ID;
- auth handling;
- abort support.

---

# 24. Loading and Error UX

Каждый asynchronous flow должен иметь состояния:

```text
idle
loading
success
error
```

Для OCR pipeline:

```text
Uploading...
Processing image...
Reading receipt...
Extracting products...
Almost ready...
```

Ошибки должны быть понятными пользователю.

Плохой вариант:

```text
Internal Server Error
```

Хороший вариант:

```text
We couldn't read this receipt.
Please check the image and try again.
```

---

# 25. Analytics

## MVP metrics

### Total spending

```text
sum(receipt.total)
```

### Spending by category

```text
category → total
```

### Spending by merchant

```text
merchant → total
```

### Spending over time

```text
date → total
```

## Filters

```text
Today
This week
This month
Previous month
Custom range
```

---

# 26. Currency Handling

Money нельзя хранить как floating-point number.

Нельзя делать:

```ts
number = 12.99
```

как финансовое значение без дополнительной модели.

Рекомендуемый вариант:

```text
amountMinor = 1299
currency = EUR
```

То есть деньги хранятся в минимальных единицах валюты.

Пример:

```json
{
  "amount": 1299,
  "currency": "EUR"
}
```

Для валют без двух знаков после запятой правила должны зависеть от ISO currency metadata.

На MVP не выполняем автоматический currency conversion, если пользователь явно этого не запросил.

---

# 27. Internationalization

Так как приложение потенциально ориентировано на европейский рынок, архитектура должна быть готова к i18n.

Язык интерфейса:

```text
English
```

на MVP.

Следующий этап:

```text
English
German
Polish
Russian
```

Данные чеков не переводятся автоматически. Названия продуктов желательно сохранять в оригинальном распознанном виде.

---

# 28. Security

## Backend

- Helmet.
- CORS allowlist.
- Rate limiting.
- Input validation.
- SQL injection protection через ORM.
- Secure cookies.
- Password hashing with Argon2 или bcrypt.
- Request size limits.
- File type validation.
- Signed object-storage URLs.

## Receipt privacy

Чеки содержат потенциально чувствительные данные.

Необходимо:

- ограничивать доступ по `userId`;
- проверять ownership каждого receipt;
- не выдавать публичные image URLs;
- удалять связанные файлы при окончательном удалении receipt согласно retention policy.

---

# 29. Observability

Каждый processing request/job должен иметь correlation ID.

Минимум логируем:

```text
requestId
userId
receiptId
jobId
provider
status
duration
errorCode
```

Не логируем:

- access tokens;
- refresh tokens;
- полные изображения чеков;
- секреты provider APIs.

---

# 30. Error Taxonomy

Нужны стабильные application error codes.

Примеры:

```text
AUTH_INVALID_CREDENTIALS
AUTH_SESSION_EXPIRED
RECEIPT_NOT_FOUND
RECEIPT_ACCESS_DENIED
RECEIPT_INVALID_FILE
RECEIPT_PROCESSING_FAILED
OCR_PROVIDER_ERROR
PARSER_PROVIDER_ERROR
RECEIPT_PARSE_INVALID
CATEGORY_NOT_FOUND
```

Frontend должен работать с `code`, а не пытаться анализировать human-readable message.

---

# 31. Testing Strategy

Используем testing pyramid.

```text
             E2E
            /   \
           /     \
      Integration
        /       \
       /         \
      Unit tests
```

## 31.1 Frontend

### Unit

- composables;
- utils;
- formatters;
- validation;
- state logic.

### Component

- ReceiptEditor;
- ReceiptItemEditor;
- UploadZone;
- ProcessingStatus;
- Dashboard widgets.

### E2E

Основные сценарии:

```text
Register
Login
Upload receipt
Wait for processing
Edit receipt
Save receipt
Open analytics
```

Recommended:

```text
Vitest
Vue Test Utils
Playwright
```

## 31.2 Backend

### Unit

- services;
- parsers;
- validators;
- calculations.

### Integration

- repositories;
- PostgreSQL;
- Redis jobs;
- API modules.

### E2E

Проверить полный receipt processing flow.

Recommended:

```text
Jest
Supertest
Testcontainers
```

---

# 32. Mocking External Providers

OCR и AI providers нельзя вызывать в каждом тесте.

Должны быть:

```text
RealOcrProvider
MockOcrProvider

RealReceiptParser
MockReceiptParser
```

Это позволит тестировать pipeline детерминированно.

---

# 33. CI/CD

## Pipeline

```text
Install
  ↓
Lint
  ↓
Typecheck
  ↓
Unit tests
  ↓
Integration tests
  ↓
Build
  ↓
E2E
  ↓
Deploy
```

## Frontend checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Backend checks

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

---

# 34. Environments

Минимум:

```text
local
staging
production
```

Каждое окружение должно иметь отдельные:

- database;
- Redis;
- object storage bucket;
- API keys;
- secrets.

---

# 35. Configuration

Использовать environment variables.

Frontend:

```text
NUXT_PUBLIC_API_BASE_URL
```

Backend:

```text
NODE_ENV
PORT
DATABASE_URL
REDIS_URL
JWT_SECRET
JWT_REFRESH_SECRET
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY
S3_SECRET_KEY
OCR_PROVIDER
OCR_API_KEY
AI_PROVIDER
AI_API_KEY
```

Секреты никогда не должны попадать во frontend bundle.

---

# 36. Docker

Local development:

```text
frontend
backend
postgres
redis
minio
```

можно запускать через Docker Compose.

Пример:

```text
docker-compose.yml
├── postgres
├── redis
└── minio
```

Frontend/backend можно запускать локально через pnpm для быстрого development feedback.

---

# 37. Git Strategy

Используем trunk-based development или короткоживущие feature branches.

Пример:

```text
main
 ├── feature/receipt-upload
 ├── feature/ocr-pipeline
 ├── feature/receipt-editor
 └── feature/analytics
```

Commit convention:

```text
feat:
fix:
refactor:
test:
docs:
chore:
```

Примеры:

```text
feat: add receipt upload flow
feat: add OCR processing pipeline
feat: add receipt review editor
fix: validate receipt total before save
```

---

# 38. MVP Milestones

## Milestone 0 — Foundation

### Tasks

- Create monorepo or separate repositories.
- Configure pnpm.
- Configure TypeScript.
- Configure ESLint.
- Configure Prettier.
- Configure Git hooks.
- Configure Docker Compose.
- Start PostgreSQL.
- Start Redis.
- Start MinIO.
- Configure CI.

### Result

Рабочее development environment.

---

## Milestone 1 — Backend foundation

### Tasks

- NestJS project.
- Config module.
- Prisma.
- PostgreSQL.
- User model.
- Auth module.
- Session/refresh token mechanism.
- Global validation.
- Global exception filter.
- API versioning.
- Request ID.

### Result

Рабочий authenticated API.

---

## Milestone 2 — Frontend foundation

### Tasks

- Nuxt project.
- Global layout.
- Authentication pages.
- API client.
- Auth composable/store.
- Route middleware.
- Base UI components.
- Error handling.
- Loading states.

### Result

Frontend может авторизоваться и работать с API.

---

## Milestone 3 — Receipt upload

### Backend

- Receipt model.
- Upload endpoint.
- Object storage.
- File validation.
- Receipt ownership.
- Processing job.

### Frontend

- Upload page.
- Camera input.
- File input.
- Image preview.
- Upload progress.
- Processing status.

### Result

Пользователь может загрузить чек и создать processing job.

---

## Milestone 4 — OCR

### Tasks

- OcrProvider interface.
- First real OCR provider.
- Mock OCR provider.
- Worker.
- OCR result persistence.
- Retry handling.
- Failure states.

### Result

Изображение превращается в raw OCR data.

---

## Milestone 5 — AI Parsing

### Tasks

- Parser interface.
- Provider implementation.
- Structured schema.
- Validation.
- Confidence.
- Normalization.
- Invalid response handling.

### Result

Raw OCR превращается в structured receipt.

---

## Milestone 6 — Receipt Review

### Frontend

- Receipt details page.
- Receipt editor.
- Item editor.
- Category selector.
- Total validation.
- Save flow.
- Low-confidence indicators.

### Result

Пользователь может проверить и исправить автоматическое распознавание.

---

## Milestone 7 — Receipt history

### Tasks

- Receipt list.
- Pagination.
- Search.
- Date filters.
- Category filters.
- Merchant filters.
- Delete receipt.

### Result

Полноценная история покупок.

---

## Milestone 8 — Analytics

### Tasks

- Dashboard summary.
- Monthly total.
- Category breakdown.
- Merchant breakdown.
- Timeline.
- Date range filtering.

### Result

Пользователь видит структуру своих расходов.

---

## Milestone 9 — Production hardening

### Tasks

- Rate limiting.
- Security headers.
- Audit logging.
- Monitoring.
- Error tracking.
- Performance optimization.
- Storage lifecycle.
- Backup policy.
- Database migration process.

### Result

MVP готов к production usage.

---

# 39. Future Roadmap

## Phase 2

```text
Manual expenses
Custom categories
Recurring expenses
Budgets
Exports CSV/JSON
Advanced filters
Merchant normalization
```

## Phase 3

```text
AI category suggestions
Duplicate receipt detection
Automatic merchant recognition
Price history
Spending insights
```

## Phase 4

```text
Households
Shared expenses
Multiple accounts
Notifications
Mobile PWA improvements
```

## Phase 5

```text
Bank integrations
Open Banking
AI financial assistant
Predictive spending analysis
```

---

# 40. Potential AI Features

После MVP AI можно использовать не только для OCR parsing.

### Smart category assignment

```text
"Oatly Oat Drink"
        ↓
Groceries / Food
```

### Merchant normalization

```text
LIDL GMBH
LIDL-123
LIDL MARKET
        ↓
LIDL
```

### Duplicate detection

Пример:

```text
same merchant
same date
same amount
same items
```

→ possible duplicate receipt.

### Spending assistant

Пользователь может задавать вопросы:

```text
How much did I spend on groceries this month?

Which stores are the most expensive for me?

How did my food spending change compared to last month?
```

AI при этом не должен самостоятельно вычислять суммы. Он должен использовать проверенные агрегаты analytics layer.

---

# 41. Important Architectural Decisions

## ADR-001 — REST API

На первом этапе REST является предпочтительным вариантом из-за простоты, зрелости tooling и понятных контрактов.

## ADR-002 — PostgreSQL

Выбран как основная relational database из-за:

- сильной поддержки relations;
- aggregation queries;
- transactional guarantees;
- Prisma support.

## ADR-003 — Async processing

OCR/AI processing выполняется асинхронно через queue.

Причины:

- provider latency;
- retries;
- scalability;
- user experience;
- отсутствие long-running HTTP requests.

## ADR-004 — Provider abstraction

OCR и AI интеграции скрыты за interfaces.

Причины:

- возможность замены provider;
- тестируемость;
- fallback strategy;
- контроль vendor lock-in.

## ADR-005 — Object storage

Images не хранятся в PostgreSQL.

## ADR-006 — Integer money representation

Money хранится в minor units для предотвращения floating-point errors.

---

# 42. Performance Goals

## Frontend

Target:

```text
LCP < 2.5s
CLS < 0.1
INP < 200ms
```

При этом конкретные показатели зависят от устройства, сети и архитектуры страниц.

## Backend

Обычные CRUD endpoints должны стремиться к:

```text
p95 < 300 ms
```

без учёта внешнего OCR/AI processing.

OCR processing latency не должна блокировать API request.

---

# 43. Scalability Strategy

Начальный вариант:

```text
1 API
1 worker
1 PostgreSQL
1 Redis
1 object storage
```

При росте:

```text
            Load Balancer
                  ↓
        ┌─────────┴─────────┐
        ↓                   ↓
     API #1              API #2
        │                   │
        └─────────┬─────────┘
                  ↓
                 Redis
                  ↓
          ┌───────┴───────┐
          ↓               ↓
      Worker #1       Worker #2
                  ↓
             PostgreSQL
                  ↓
             Object Storage
```

---

# 44. Data Integrity Rules

Backend должен проверять:

```text
quantity > 0
unitPrice >= 0
totalPrice >= 0
total >= 0
currency is valid
purchasedAt is valid
receipt belongs to current user
```

Дополнительно можно проверять:

```text
sum(receipt items) ≈ subtotal
subtotal - discounts + taxes ≈ total
```

Но из-за округлений на чеках допустимо задавать small tolerance.

---

# 45. Receipt Editing Rules

После подтверждения пользователем:

```text
READY_FOR_REVIEW
      ↓
CONFIRMED
```

Изменение данных после `CONFIRMED` разрешено.

При ручном изменении желательно сохранять provenance:

```text
source = OCR
source = AI
source = USER
```

В будущем это позволит видеть, какие поля чаще всего требуют ручного исправления.

---

# 46. Audit Trail

Для критически важных изменений можно добавить:

```text
ReceiptAuditLog
├── id
├── receiptId
├── userId
├── field
├── oldValue
├── newValue
├── source
└── createdAt
```

Для MVP достаточно хранить metadata о manual correction, а полный audit trail можно добавить позже.

---

# 47. Observability Metrics

Основные backend metrics:

```text
receipts_uploaded_total
receipts_processed_total
receipts_failed_total
ocr_duration_ms
parser_duration_ms
receipt_processing_duration_ms
ocr_failure_rate
parser_failure_rate
manual_correction_rate
```

Особенно полезный product metric:

```text
manual_correction_rate
```

Он покажет качество OCR/AI pipeline.

---

# 48. Product Metrics

После запуска отслеживать:

```text
Registration → first receipt
First receipt → confirmed receipt
Receipts per active user
Processing success rate
Average processing time
Average corrections per receipt
Weekly active users
Monthly active users
```

Ключевой north-star metric для ранней версии:

```text
Confirmed receipts per active user
```

---

# 49. Definition of Done for Receipt Feature

Receipt feature считается завершённой, когда:

- пользователь может загрузить изображение;
- файл валидируется;
- receipt создаётся;
- processing job создаётся;
- OCR запускается асинхронно;
- parser формирует structured data;
- frontend получает статус обработки;
- пользователь видит результат;
- пользователь может редактировать поля;
- backend валидирует изменения;
- receipt сохраняется;
- receipt появляется в history;
- данные участвуют в analytics;
- есть unit/integration/e2e coverage критического flow;
- ошибки provider корректно обрабатываются.

---

# 50. Initial Repository Strategy

Рекомендуется monorepo:

```text
receipt-tracker/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── types/
│   ├── eslint-config/
│   └── tsconfig/
│
├── infrastructure/
│   ├── docker/
│   └── scripts/
│
├── docs/
│   ├── PROJECT_PLAN.md
│   └── architecture/
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

Для orchestration можно использовать Turborepo. Если проект небольшой, можно начать без него и добавить позже.

---

# 51. Shared Types

Shared package допустимо использовать для:

- enums;
- API contracts;
- primitive domain types;
- validation schemas.

Но нельзя превращать shared package в место, где смешаны frontend и backend implementation details.

Предпочтительно:

```text
packages/types
```

с чистыми domain/API контрактами.

---

# 52. Suggested Development Order

Оптимальный порядок реализации:

```text
1. Repository + tooling
2. Docker infrastructure
3. Database schema
4. Auth API
5. Auth frontend
6. Receipt CRUD
7. Object storage
8. Receipt upload UI
9. Queue + worker
10. OCR provider
11. Receipt parser
12. Processing status UI
13. Receipt editor
14. Receipt history
15. Categories
16. Analytics
17. Testing hardening
18. Security hardening
19. Monitoring
20. Production deployment
```

Не рекомендуется начинать с dashboard. Основная ценность продукта появляется только после стабильного receipt processing flow.

---

# 53. MVP Definition

MVP считается готовым, когда пользователь может пройти полный сценарий:

```text
Register
   ↓
Login
   ↓
Upload receipt
   ↓
Wait for processing
   ↓
Review parsed data
   ↓
Correct data if needed
   ↓
Save
   ↓
See receipt in history
   ↓
See expense in analytics
```

Это основной vertical slice проекта.

---

# 54. First Vertical Slice

Первую feature рекомендуется реализовать end-to-end, а не делать сначала весь frontend или весь backend.

### Slice #1

```text
POST /auth/register
        ↓
Frontend login
        ↓
POST /receipts/upload
        ↓
S3/MinIO
        ↓
BullMQ
        ↓
Mock OCR
        ↓
Mock parser
        ↓
READY_FOR_REVIEW
        ↓
Receipt Editor
        ↓
PATCH /receipts/:id
        ↓
Receipt saved
```

После этого заменить mocks реальными OCR/AI providers.

Такой подход позволяет проверить архитектуру до того, как будут потрачены ресурсы на внешние интеграции.

---

# 55. First Implementation Tasks

## Repository

```text
[ ] Initialize git repository
[ ] Initialize pnpm workspace
[ ] Create apps/web
[ ] Create apps/api
[ ] Configure TypeScript
[ ] Configure ESLint
[ ] Configure Prettier
[ ] Configure Husky / lint-staged
```

## Infrastructure

```text
[ ] Docker Compose
[ ] PostgreSQL
[ ] Redis
[ ] MinIO
```

## Backend

```text
[ ] NestJS bootstrap
[ ] ConfigModule
[ ] Prisma
[ ] Health endpoint
[ ] User model
[ ] Auth module
[ ] Receipt model
```

## Frontend

```text
[ ] Nuxt bootstrap
[ ] Layout
[ ] Auth pages
[ ] API client
[ ] Route middleware
[ ] Upload page
```

## Testing

```text
[ ] Vitest
[ ] Vue Test Utils
[ ] Jest
[ ] Supertest
[ ] Playwright
```

---

# 56. Final Architecture

```text
                           ┌──────────────────┐
                           │    Nuxt / Vue    │
                           │                  │
                           │ Scanner          │
                           │ Receipt Editor   │
                           │ History          │
                           │ Analytics        │
                           └────────┬─────────┘
                                    │
                                  REST
                                    │
                           ┌────────▼─────────┐
                           │      NestJS      │
                           │                  │
                           │ Auth             │
                           │ Receipts         │
                           │ Categories       │
                           │ Analytics        │
                           │ Processing       │
                           └───────┬───┬──────┘
                                   │   │
                         ┌─────────┘   └─────────┐
                         ▼                       ▼
                 ┌─────────────┐         ┌─────────────┐
                 │ PostgreSQL  │         │    Redis    │
                 └─────────────┘         └──────┬──────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │   Worker    │
                                         └───┬─────┬───┘
                                             │     │
                                  ┌──────────┘     └──────────┐
                                  ▼                           ▼
                           ┌────────────┐              ┌────────────┐
                           │ OCR        │              │ AI Parser  │
                           │ Provider   │              │ Provider   │
                           └────────────┘              └────────────┘

                           ┌──────────────────┐
                           │ Object Storage   │
                           │ S3 / R2 / MinIO  │
                           └──────────────────┘
```

---

# 57. Recommended MVP Stack

| Layer                     | Technology              |
| ------------------------- | ----------------------- |
| Frontend                  | Vue 3 + Nuxt 3          |
| Language                  | TypeScript              |
| Frontend state            | Pinia                   |
| Styling                   | SCSS                    |
| Backend                   | NestJS                  |
| Database                  | PostgreSQL              |
| ORM                       | Prisma                  |
| Queue                     | BullMQ                  |
| Queue backend             | Redis                   |
| Object storage            | S3-compatible storage   |
| API                       | REST                    |
| Validation                | class-validator / DTOs  |
| Frontend tests            | Vitest + Vue Test Utils |
| E2E                       | Playwright              |
| Backend tests             | Jest + Supertest        |
| Local infrastructure      | Docker Compose          |
| Monorepo                  | pnpm workspace          |
| Optional monorepo tooling | Turborepo               |

---

# 58. Guiding Principles

## Principle 1 — Receipt processing is asynchronous

OCR и AI не должны блокировать HTTP request.

## Principle 2 — AI is not the source of truth

AI предлагает структурированные данные, но backend валидирует их, а пользователь подтверждает результат.

## Principle 3 — Money is deterministic

Финансовые расчёты выполняются backend/domain logic, а не LLM.

## Principle 4 — External providers are replaceable

OCR и AI интеграции скрываются за интерфейсами.

## Principle 5 — Frontend owns presentation, backend owns business rules

Не дублировать критические бизнес-правила только во frontend.

## Principle 6 — Build vertical slices

Каждая крупная feature должна проходить через весь stack.

## Principle 7 — Optimize after measuring

Сначала observability и метрики, затем performance optimizations.

---

# 59. Project Success Criteria

Проект можно считать успешно реализованным на MVP, когда:

1. Большинство обычных чеков успешно проходят полный pipeline.
2. Пользователь быстро исправляет ошибки OCR/AI.
3. Все подтверждённые чеки корректно отражаются в аналитике.
4. Повторная обработка возможна без создания дубликатов.
5. Система сохраняет данные безопасно.
6. Критические сценарии покрыты automated tests.
7. Система готова к масштабированию worker layer независимо от API.

---

# 60. Next Technical Documents

После этого файла рекомендуется создать отдельные документы:

```text
docs/
├── PROJECT_PLAN.md
├── DATABASE_SCHEMA.md
├── API_SPECIFICATION.md
├── FRONTEND_ARCHITECTURE.md
├── BACKEND_ARCHITECTURE.md
├── OCR_PIPELINE.md
├── AI_RECEIPT_PARSING.md
├── TESTING_STRATEGY.md
├── SECURITY.md
└── DEPLOYMENT.md
```

`PROJECT_PLAN.md` остаётся главным документом, а остальные документы детализируют отдельные технические области.
