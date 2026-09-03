import { z } from 'zod'
import { CATEGORY_SLUGS, CategorySlugSchema } from './category.js'
import { LINE_TYPE, LineTypeSchema, ITEM_UNIT, ItemUnitSchema } from './enums.js'

/**
 * Денежная величина как напечатана на чеке. Перевод в минорные единицы — в money.ts.
 */
const MoneyString = z
  .string()
  .regex(/^-?[\d\s]{1,12}([.,]\d{1,3})?$/, 'Ожидается число как напечатано на чеке')

function stripTrailingZeros(money: string): string {
  return money.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function formatMoneyAmount(value: number): string {
  const negative = value < 0
  const abs = Math.abs(value)
  const trimmed = abs.toFixed(3).replace(/\.?0+$/, '')
  return `${negative ? '-' : ''}${trimmed || '0'}`
}

/** Модель часто возвращает число, "3.4900", "3.49 BYN" или "15.69 x 0.596". */
export function normalizeMoney(value: unknown): unknown {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return formatMoneyAmount(value)
  }

  if (typeof value !== 'string') return value

  const text = value.trim()
  if (text === '' || text.toLowerCase() === 'null') return null

  const negative = /^[-−]/.test(text)
  const match = text.match(/[\d\s]{1,15}(?:[.,]\d+)?/)
  if (!match) return text

  const raw = match[0].replace(/\s/g, '')
  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')
  const sepAt = Math.max(lastComma, lastDot)

  let result: string
  if (sepAt === -1) {
    result = raw.replace(/[^\d]/g, '')
  } else {
    const intPart = raw.slice(0, sepAt).replace(/[^\d]/g, '')
    const fracPart = raw
      .slice(sepAt + 1)
      .replace(/[^\d]/g, '')
      .slice(0, 3)
    result = fracPart ? `${intPart}.${fracPart}` : intPart
  }

  if (!result) return text

  const normalized = negative ? `-${result.replace(/^-/, '')}` : result
  return stripTrailingZeros(normalized)
}

const NullableMoneyString = z.preprocess((value) => {
  if (typeof value === 'string') {
    const text = value.trim()
    if (text === '' || text.toLowerCase() === 'null') return null
  }
  return normalizeMoney(value)
}, MoneyString.nullable())

const RequiredMoneyString = z.preprocess((value) => {
  const normalized = normalizeMoney(value)
  if (normalized === null && value !== null && value !== undefined) {
    return typeof value === 'string' ? value.trim() : value
  }
  return normalized ?? value
}, MoneyString)

const nullish = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value
    const text = value.trim()
    return text === '' || text.toLowerCase() === 'null' ? null : text
  }, inner)

const QuantityString = z.string().regex(/^\d+([.,]\d{1,3})?$/)

/** Модель часто возвращает "1.0000", число или "1 шт" — нормализуем до формата схемы. */
function normalizeQuantity(value: unknown): unknown {
  if (value === null || value === undefined) return null

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    return formatQuantity(value)
  }

  if (typeof value !== 'string') return value

  const text = value.trim()
  if (text === '' || text.toLowerCase() === 'null') return null

  const match = text.match(/(\d+(?:[.,]\d+)?)/)
  if (!match) return text

  const parsed = Number(match[1]!.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) return text

  return formatQuantity(parsed)
}

function formatQuantity(value: number): string {
  const trimmed = value.toFixed(3).replace(/\.?0+$/, '')
  return trimmed === '' ? '0' : trimmed
}

export const ParsedItemSchema = z.object({
  name: z.string().min(1).max(300),
  lineType: LineTypeSchema,
  quantity: z.preprocess(normalizeQuantity, QuantityString.nullable()),
  unit: ItemUnitSchema,
  unitPrice: nullish(NullableMoneyString),
  totalPrice: RequiredMoneyString,
  categorySlug: CategorySlugSchema,
})

const pad2 = (v: string) => v.padStart(2, '0')

const DateString = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value
    const text = value.trim()
    if (text === '') return null

    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/)
    if (iso) return `${iso[1]}-${pad2(iso[2]!)}-${pad2(iso[3]!)}`

    const dmy = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/)
    if (dmy && Number(dmy[1]) > 12) return `${dmy[3]}-${pad2(dmy[2]!)}-${pad2(dmy[1]!)}`

    return text
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
)

const TimeString = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value
    const text = value.trim()
    if (text === '') return null

    const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/)
    return match ? `${pad2(match[1]!)}:${match[2]}` : text
  },
  z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
)

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
  subtotal: NullableMoneyString,
  taxTotal: NullableMoneyString,
  discountTotal: NullableMoneyString,
  total: NullableMoneyString,
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
