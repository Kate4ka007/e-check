import { z } from 'zod'

/**
 * Закрытый список категорий. Передаётся модели в промпте и в JSON Schema.
 * Совпадает с DATA_MODEL.md, раздел Category.
 */
export const CATEGORY_SLUGS = [
  'groceries',
  'restaurants',
  'household',
  'transport',
  'health',
  'personal_care',
  'clothing',
  'electronics',
  'entertainment',
  'services',
  'other',
] as const

export const LINE_TYPES = ['ITEM', 'DISCOUNT', 'DEPOSIT', 'DEPOSIT_RETURN', 'FEE'] as const
export const UNITS = ['PCS', 'KG', 'G', 'L', 'ML', 'M'] as const

/**
 * Денежная величина запрашивается строкой ровно в том виде, как напечатана
 * на чеке: "2,78", "-0.25", "1 234,50". Перевод в минорные единицы делает
 * код — см. money.ts.
 *
 * Модель не просят умножать на 100. Умножение — это арифметика, а
 * арифметику в этом проекте выполняет код, а не модель.
 */
const MoneyString = z
  .string()
  .regex(/^-?[\d\s]{1,12}([.,]\d{1,3})?$/, 'Ожидается число как напечатано на чеке')

/**
 * Некоторые модели присылают отсутствующее значение строкой "null"
 * вместо JSON-значения null. Это артефакт сериализации, а не содержимое
 * чека, поэтому приводим к null, а не браковать из-за него весь чек.
 */
const nullish = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value
    const text = value.trim()
    return text === '' || text.toLowerCase() === 'null' ? null : text
  }, inner)

export const ParsedItemSchema = z.object({
  name: z.string().min(1).max(300),
  lineType: z.enum(LINE_TYPES),
  // null означает «количество на чеке не напечатано»
  quantity: nullish(z.string().regex(/^\d+([.,]\d{1,3})?$/).nullable()),
  unit: z.enum(UNITS),
  unitPrice: nullish(MoneyString.nullable()),
  totalPrice: MoneyString,
  categorySlug: z.enum(CATEGORY_SLUGS),
})

const pad2 = (v: string) => v.padStart(2, '0')

/**
 * Приводит дату к YYYY-MM-DD, но только там, где это перестановка формата,
 * а не догадка о содержимом.
 *
 * "2026-08-29T22:27:00" → "2026-08-29": модель прочитала дату правильно,
 * забраковать чек из-за лишнего хвоста было бы придиркой.
 *
 * "29.08.2026" → "2026-08-29": 29 не может быть месяцем, порядок однозначен.
 * "05.08.2026" остаётся как есть и не проходит проверку: день это или
 * месяц — неизвестно, а молча угадать в замере точности значит испортить
 * замер. Пусть лучше видно, что модель не выполнила формат.
 */
const DateString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (text === '') return null

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/)
  if (iso) return `${iso[1]}-${pad2(iso[2]!)}-${pad2(iso[3]!)}`

  const dmy = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/)
  if (dmy && Number(dmy[1]) > 12) return `${dmy[3]}-${pad2(dmy[2]!)}-${pad2(dmy[1]!)}`

  return text
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable())

/** "19:24:04" → "19:24", "9:05" → "09:05". Секунды в проекте не используются. */
const TimeString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (text === '') return null

  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/)
  return match ? `${pad2(match[1]!)}:${match[2]}` : text
}, z.string().regex(/^\d{2}:\d{2}$/).nullable())

const CurrencyString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const text = value.trim().toUpperCase()
  return text === '' ? null : text
}, z.string().length(3).nullable())

export const ParsedReceiptSchema = z.object({
  merchantName: z.string().min(1).max(200).nullable(),
  purchasedAt: DateString,
  purchasedTime: TimeString,
  currency: CurrencyString,
  items: z.array(ParsedItemSchema).max(200),
  subtotal: MoneyString.nullable(),
  taxTotal: MoneyString.nullable(),
  discountTotal: MoneyString.nullable(),
  total: MoneyString.nullable(),
})

export type ParsedItem = z.infer<typeof ParsedItemSchema>
export type ParsedReceipt = z.infer<typeof ParsedReceiptSchema>

/**
 * JSON Schema для structured output. Строится вручную, а не через
 * zod-to-json-schema: OpenRouter требует, чтобы у каждого объекта было
 * "additionalProperties": false и чтобы все поля были в "required"
 * (nullable выражается через тип-объединение с "null").
 */
export const RECEIPT_JSON_SCHEMA = {
  name: 'receipt',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'merchantName',
      'purchasedAt',
      'purchasedTime',
      'currency',
      'items',
      'subtotal',
      'taxTotal',
      'discountTotal',
      'total',
    ],
    properties: {
      merchantName: {
        type: ['string', 'null'],
        description: 'Название магазина как напечатано вверху чека',
      },
      purchasedAt: {
        type: ['string', 'null'],
        description:
          'Дата покупки, ровно 10 символов YYYY-MM-DD. Только дата, без времени и без буквы T',
      },
      purchasedTime: {
        type: ['string', 'null'],
        description:
          'Время покупки, ровно 5 символов HH:MM. Без секунд. null, если время не напечатано',
      },
      currency: {
        type: ['string', 'null'],
        description: 'Код валюты ISO 4217, три буквы: EUR, PLN, USD',
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'name',
            'lineType',
            'quantity',
            'unit',
            'unitPrice',
            'totalPrice',
            'categorySlug',
          ],
          properties: {
            name: {
              type: 'string',
              description: 'Название товара как напечатано, без изменений',
            },
            lineType: {
              type: 'string',
              enum: [...LINE_TYPES],
              description:
                'ITEM — покупка, DISCOUNT — скидка отдельной строкой, DEPOSIT — залог за тару, DEPOSIT_RETURN — возврат залога, FEE — сбор или доставка',
            },
            quantity: {
              type: ['string', 'null'],
              description:
                'Количество как напечатано, например "1" или "0,532". null, если не напечатано',
            },
            unit: { type: 'string', enum: [...UNITS] },
            unitPrice: {
              type: ['string', 'null'],
              description: 'Цена за единицу как напечатана, или null если не указана',
            },
            totalPrice: {
              type: 'string',
              description:
                'Сумма по строке как напечатана. Для скидок и возвратов залога — с минусом',
            },
            categorySlug: { type: 'string', enum: [...CATEGORY_SLUGS] },
          },
        },
      },
      subtotal: { type: ['string', 'null'], description: 'Сумма до скидок и налогов' },
      taxTotal: { type: ['string', 'null'], description: 'Сумма налога, обычно MwSt или VAT' },
      discountTotal: { type: ['string', 'null'], description: 'Общая сумма скидок' },
      total: {
        type: ['string', 'null'],
        description: 'Итоговая сумма к оплате как напечатана на чеке',
      },
    },
  },
} as const
