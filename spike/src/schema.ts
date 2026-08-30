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

export const ParsedItemSchema = z.object({
  name: z.string().min(1).max(300),
  lineType: z.enum(LINE_TYPES),
  quantity: z.string().regex(/^\d+([.,]\d{1,3})?$/),
  unit: z.enum(UNITS),
  unitPrice: MoneyString.nullable(),
  totalPrice: MoneyString,
  categorySlug: z.enum(CATEGORY_SLUGS),
})

export const ParsedReceiptSchema = z.object({
  merchantName: z.string().min(1).max(200).nullable(),
  purchasedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  purchasedTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  currency: z.string().length(3).nullable(),
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
        description: 'Дата покупки в формате YYYY-MM-DD',
      },
      purchasedTime: {
        type: ['string', 'null'],
        description: 'Время покупки в формате HH:mm, если напечатано',
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
              type: 'string',
              description: 'Количество как напечатано, например "1" или "0,532"',
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
