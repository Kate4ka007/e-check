import { z } from 'zod'
import {
  ConfidenceLevelSchema,
  EntryModeSchema,
  FieldSourceSchema,
  ItemUnitSchema,
  LineTypeSchema,
  ProcessingStageSchema,
  ProcessingStatusSchema,
  ReceiptStatusSchema,
} from './enums.js'

/** Дата покупки без времени и часового пояса: чек куплен в календарный день. */
export const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ожидается YYYY-MM-DD')

export const TimeOnlySchema = z.string().regex(/^\d{2}:\d{2}$/, 'Ожидается HH:MM')

/** Количество строкой — см. money.ts, дробное значение нельзя терять. */
export const QuantitySchema = z.string().regex(/^\d+([.,]\d{1,3})?$/, 'Ожидается число')

export const MerchantRefSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const ReceiptItemSchema = z.object({
  id: z.string(),
  position: z.number().int().nonnegative(),
  name: z.string().min(1).max(300),
  lineType: LineTypeSchema,
  quantity: QuantitySchema,
  unit: ItemUnitSchema,
  unitPriceMinor: z.number().int().nullable(),
  totalPriceMinor: z.number().int(),
  categoryId: z.string().nullable(),
  confidence: ConfidenceLevelSchema.nullable(),
})

export type ReceiptItem = z.infer<typeof ReceiptItemSchema>

/**
 * Сверка сумм считается сервером, а не клиентом: правило о допустимом
 * расхождении — бизнес-логика, и дублировать её во фронтенде значит
 * получить два разных ответа на один вопрос.
 */
export const ReceiptValidationSchema = z.object({
  itemsSumMinor: z.number().int(),
  matchesTotal: z.boolean(),
  differenceMinor: z.number().int(),
})

export type ReceiptValidation = z.infer<typeof ReceiptValidationSchema>

export const ReceiptDetailSchema = z.object({
  id: z.string(),
  purchasedAt: DateOnlySchema.nullable(),
  purchasedTime: TimeOnlySchema.nullable(),
  currency: z.string().length(3).nullable(),

  subtotalMinor: z.number().int().nullable(),
  taxTotalMinor: z.number().int().nullable(),
  discountTotalMinor: z.number().int().nullable(),
  totalMinor: z.number().int().nullable(),

  receiptNumber: z.string().nullable(),
  note: z.string().nullable(),

  status: ReceiptStatusSchema,
  processingStatus: ProcessingStatusSchema,
  entryMode: EntryModeSchema,
  confidence: ConfidenceLevelSchema.nullable(),

  imageUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),

  merchant: MerchantRefSchema.nullable(),
  items: z.array(ReceiptItemSchema),

  /** Какое поле откуда взялось. Правки пользователя не затираются повторной обработкой. */
  fieldSources: z.record(z.string(), FieldSourceSchema),

  validation: ReceiptValidationSchema,

  createdAt: z.string(),
  updatedAt: z.string(),
  confirmedAt: z.string().nullable(),
})

export type ReceiptDetail = z.infer<typeof ReceiptDetailSchema>

/**
 * Позиции передаются полным массивом: отсутствующие удаляются, новые
 * создаются, порядок берётся из массива. Пооперационные изменения списка
 * усложнили бы клиент без пользы.
 */
export const ReceiptItemInputSchema = ReceiptItemSchema.omit({
  id: true,
  position: true,
  confidence: true,
}).extend({
  id: z.string().optional(),
})

export type ReceiptItemInput = z.infer<typeof ReceiptItemInputSchema>

export const ReceiptPatchSchema = z
  .object({
    merchantName: z.string().min(1).max(200).nullable(),
    purchasedAt: DateOnlySchema.nullable(),
    purchasedTime: TimeOnlySchema.nullable(),
    currency: z.string().length(3).nullable(),
    subtotalMinor: z.number().int().nullable(),
    taxTotalMinor: z.number().int().nullable(),
    discountTotalMinor: z.number().int().nullable(),
    totalMinor: z.number().int().nullable(),
    note: z.string().max(2000).nullable(),
    items: z.array(ReceiptItemInputSchema).max(200),
  })
  .partial()

export type ReceiptPatch = z.infer<typeof ReceiptPatchSchema>

/** Элемент списка: без позиций, чтобы двадцать чеков не весили мегабайты. */
export const ReceiptListItemSchema = ReceiptDetailSchema.pick({
  id: true,
  purchasedAt: true,
  currency: true,
  totalMinor: true,
  status: true,
  processingStatus: true,
  confidence: true,
  thumbnailUrl: true,
  merchant: true,
}).extend({
  itemCount: z.number().int().nonnegative(),
})

export type ReceiptListItem = z.infer<typeof ReceiptListItemSchema>

export const ReceiptListResponseSchema = z.object({
  items: z.array(ReceiptListItemSchema),
})

export type ReceiptListResponse = z.infer<typeof ReceiptListResponseSchema>

export const ReceiptUploadResponseSchema = z.object({
  receiptId: z.uuid(),
  processingStatus: ProcessingStatusSchema,
  duplicate: z.boolean(),
})

export type ReceiptUploadResponse = z.infer<typeof ReceiptUploadResponseSchema>

export const ProcessingErrorSchema = z.object({
  code: z.enum(['EXTRACTION_FAILED', 'EXTRACTION_INVALID_RESPONSE', 'PROCESSING_TIMEOUT']),
  retryable: z.boolean(),
})

export type ProcessingError = z.infer<typeof ProcessingErrorSchema>

export const ReceiptProcessingResponseSchema = z.object({
  receiptId: z.uuid(),
  processingStatus: ProcessingStatusSchema,
  stage: ProcessingStageSchema.nullable(),
  startedAt: z.string().nullable(),
  estimatedSeconds: z.number().int().nonnegative().nullable(),
  error: ProcessingErrorSchema.nullable(),
})

export type ReceiptProcessingResponse = z.infer<typeof ReceiptProcessingResponseSchema>

export const ReceiptConfirmWarningSchema = z.object({
  code: z.enum(['ITEMS_SUM_MISMATCH']),
  differenceMinor: z.number().int(),
})

export type ReceiptConfirmWarning = z.infer<typeof ReceiptConfirmWarningSchema>

export const ReceiptConfirmResponseSchema = z.object({
  status: ReceiptStatusSchema,
  warnings: z.array(ReceiptConfirmWarningSchema),
})

export type ReceiptConfirmResponse = z.infer<typeof ReceiptConfirmResponseSchema>

export const ReceiptReprocessResponseSchema = z.object({
  receiptId: z.uuid(),
  processingStatus: ProcessingStatusSchema,
})

export type ReceiptReprocessResponse = z.infer<typeof ReceiptReprocessResponseSchema>
