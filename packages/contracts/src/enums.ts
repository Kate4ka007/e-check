import { z } from 'zod'

export const RECEIPT_STATUS = ['DRAFT', 'CONFIRMED', 'ARCHIVED'] as const
export const PROCESSING_STATUS = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
] as const
export const CONFIDENCE_LEVEL = ['HIGH', 'MEDIUM', 'LOW'] as const
export const FIELD_SOURCE = ['OCR', 'AI', 'USER'] as const
export const ENTRY_MODE = ['SCAN', 'MANUAL'] as const
export const LINE_TYPE = ['ITEM', 'DISCOUNT', 'DEPOSIT', 'DEPOSIT_RETURN', 'FEE'] as const
export const ITEM_UNIT = ['PCS', 'KG', 'G', 'L', 'ML', 'M'] as const

export const ReceiptStatusSchema = z.enum(RECEIPT_STATUS)
export const ProcessingStatusSchema = z.enum(PROCESSING_STATUS)
export const ConfidenceLevelSchema = z.enum(CONFIDENCE_LEVEL)
export const FieldSourceSchema = z.enum(FIELD_SOURCE)
export const EntryModeSchema = z.enum(ENTRY_MODE)
export const LineTypeSchema = z.enum(LINE_TYPE)
export const ItemUnitSchema = z.enum(ITEM_UNIT)

export type ReceiptStatus = z.infer<typeof ReceiptStatusSchema>
export type ProcessingStatus = z.infer<typeof ProcessingStatusSchema>
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>
export type FieldSource = z.infer<typeof FieldSourceSchema>
export type EntryMode = z.infer<typeof EntryModeSchema>
export type LineType = z.infer<typeof LineTypeSchema>
export type ItemUnit = z.infer<typeof ItemUnitSchema>

/**
 * Строки чека, которые не являются покупкой, участвуют в сверке сумм,
 * но не должны попадать в разбивку расходов по категориям.
 */
export const NON_PURCHASE_LINE_TYPES: readonly LineType[] = [
  'DISCOUNT',
  'DEPOSIT_RETURN',
] as const
