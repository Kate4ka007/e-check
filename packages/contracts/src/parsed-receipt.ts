import { z } from 'zod'
import { CATEGORY_SLUGS, CategorySlugSchema } from './category.js'
import { LINE_TYPE, LineTypeSchema, ITEM_UNIT, ItemUnitSchema } from './enums.js'

/**
 * Денежная величина как напечатана на чеке. Перевод в минорные единицы — в money.ts.
 */
const MoneyString = z
  .string()
  .regex(/^-?[\d\s]{1,12}([.,]\d{1,3})?$/, 'Ожидается число как напечатано на чеке')

const nullish = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value
    const text = value.trim()
    return text === '' || text.toLowerCase() === 'null' ? null : text
  }, inner)

export const ParsedItemSchema = z.object({
  name: z.string().min(1).max(300),
  lineType: LineTypeSchema,
  quantity: nullish(z.string().regex(/^\d+([.,]\d{1,3})?$/).nullable()),
  unit: ItemUnitSchema,
  unitPrice: nullish(MoneyString.nullable()),
  totalPrice: MoneyString,
  categorySlug: CategorySlugSchema,
})

const pad2 = (v: string) => v.padStart(2, '0')

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

/** JSON Schema для structured output OpenRouter. */
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
      merchantName: { type: ['string', 'null'] },
      purchasedAt: { type: ['string', 'null'] },
      purchasedTime: { type: ['string', 'null'] },
      currency: { type: ['string', 'null'] },
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
            name: { type: 'string' },
            lineType: { type: 'string', enum: [...LINE_TYPE] },
            quantity: { type: ['string', 'null'] },
            unit: { type: 'string', enum: [...ITEM_UNIT] },
            unitPrice: { type: ['string', 'null'] },
            totalPrice: { type: 'string' },
            categorySlug: { type: 'string', enum: [...CATEGORY_SLUGS] },
          },
        },
      },
      subtotal: { type: ['string', 'null'] },
      taxTotal: { type: ['string', 'null'] },
      discountTotal: { type: ['string', 'null'] },
      total: { type: ['string', 'null'] },
    },
  },
} as const
