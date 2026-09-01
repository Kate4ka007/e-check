import {
  validateReceiptSum,
  type ReceiptDetail,
  type ReceiptItem,
} from '@receipt-tracker/contracts'
import type { Decimal } from '@prisma/client/runtime/library'
import type { ReceiptCategoryResolver } from './receipt-category.resolver'

type ReceiptWithRelations = {
  id: string
  purchasedAt: Date | null
  purchasedTime: string | null
  currency: string
  subtotalMinor: number | null
  taxTotalMinor: number | null
  discountTotalMinor: number | null
  totalMinor: number | null
  receiptNumber: string | null
  note: string | null
  status: ReceiptDetail['status']
  processingStatus: ReceiptDetail['processingStatus']
  entryMode: ReceiptDetail['entryMode']
  confidence: ReceiptDetail['confidence']
  fieldSources: unknown
  createdAt: Date
  updatedAt: Date
  confirmedAt: Date | null
  merchant: { id: string; name: string } | null
  items: Array<{
    id: string
    position: number
    name: string
    lineType: ReceiptItem['lineType']
    quantity: Decimal
    unit: ReceiptItem['unit']
    unitPriceMinor: number | null
    totalPriceMinor: number
    categoryId: string | null
    confidence: ReceiptItem['confidence']
  }>
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function formatTimeOnly(value: string | null): string | null {
  if (!value) return null
  const match = /^(\d{2}:\d{2})/.exec(value.trim())
  return match ? match[1] : null
}

function formatQuantity(value: Decimal): string {
  const raw = value.toString()
  if (!raw.includes('.')) return raw
  return raw.replace(/\.?0+$/, '')
}

export async function toReceiptDetail(
  receipt: ReceiptWithRelations,
  categories: ReceiptCategoryResolver,
  urls: { imageUrl: string | null; thumbnailUrl: string | null },
): Promise<ReceiptDetail> {
  const fieldSources =
    receipt.fieldSources && typeof receipt.fieldSources === 'object'
      ? (receipt.fieldSources as Record<string, 'AI' | 'USER' | 'OCR'>)
      : {}

  const items: ReceiptItem[] = receipt.items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      id: item.id,
      position: item.position + 1,
      name: item.name,
      lineType: item.lineType,
      quantity: formatQuantity(item.quantity),
      unit: item.unit,
      unitPriceMinor: item.unitPriceMinor,
      totalPriceMinor: item.totalPriceMinor,
      categoryId: categories.toApiId(item.categoryId),
      confidence: item.confidence,
    }))

  const validation = validateReceiptSum(items, receipt.totalMinor)

  return {
    id: receipt.id,
    purchasedAt: receipt.purchasedAt ? formatDateOnly(receipt.purchasedAt) : null,
    purchasedTime: formatTimeOnly(receipt.purchasedTime),
    currency: receipt.currency,
    subtotalMinor: receipt.subtotalMinor,
    taxTotalMinor: receipt.taxTotalMinor,
    discountTotalMinor: receipt.discountTotalMinor,
    totalMinor: receipt.totalMinor,
    receiptNumber: receipt.receiptNumber,
    note: receipt.note,
    status: receipt.status,
    processingStatus: receipt.processingStatus,
    entryMode: receipt.entryMode,
    confidence: receipt.confidence,
    imageUrl: urls.imageUrl,
    thumbnailUrl: urls.thumbnailUrl,
    merchant: receipt.merchant,
    items,
    fieldSources,
    validation,
    createdAt: receipt.createdAt.toISOString(),
    updatedAt: receipt.updatedAt.toISOString(),
    confirmedAt: receipt.confirmedAt?.toISOString() ?? null,
  }
}
