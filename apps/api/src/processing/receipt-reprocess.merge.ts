import type { NormalizedReceipt } from './receipt-normalizer'

type FieldSource = 'AI' | 'USER' | 'OCR'

type ExistingReceipt = {
  merchantId: string | null
  purchasedAt: Date | null
  purchasedTime: string | null
  currency: string
  subtotalMinor: number | null
  taxTotalMinor: number | null
  discountTotalMinor: number | null
  totalMinor: number | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null
  fieldSources: unknown
}

export interface MergedReprocessResult extends NormalizedReceipt {
  preserveItems: boolean
}

export function mergeReprocessResult(
  existing: ExistingReceipt,
  normalized: NormalizedReceipt,
): MergedReprocessResult {
  const fieldSources = readFieldSources(existing.fieldSources)
  const mergedFieldSources: Record<string, FieldSource> = { ...fieldSources }

  for (const key of Object.keys(normalized.fieldSources)) {
    if (fieldSources[key] !== 'USER') {
      mergedFieldSources[key] = 'AI'
    }
  }

  const preserveItems = fieldSources.items === 'USER'

  return {
    merchantId: fieldSources.merchantName === 'USER' ? existing.merchantId : normalized.merchantId,
    purchasedAt:
      fieldSources.purchasedAt === 'USER' ? existing.purchasedAt : normalized.purchasedAt,
    purchasedTime:
      fieldSources.purchasedTime === 'USER' ? existing.purchasedTime : normalized.purchasedTime,
    currency: fieldSources.currency === 'USER' ? existing.currency : normalized.currency,
    subtotalMinor:
      fieldSources.subtotalMinor === 'USER' ? existing.subtotalMinor : normalized.subtotalMinor,
    taxTotalMinor:
      fieldSources.taxTotalMinor === 'USER' ? existing.taxTotalMinor : normalized.taxTotalMinor,
    discountTotalMinor:
      fieldSources.discountTotalMinor === 'USER'
        ? existing.discountTotalMinor
        : normalized.discountTotalMinor,
    totalMinor: fieldSources.totalMinor === 'USER' ? existing.totalMinor : normalized.totalMinor,
    confidence:
      fieldSources.totalMinor === 'USER' || preserveItems
        ? (existing.confidence ?? normalized.confidence)
        : normalized.confidence,
    fieldSources: mergedFieldSources,
    items: normalized.items,
    rawResultKey: normalized.rawResultKey,
    rawResultExpiresAt: normalized.rawResultExpiresAt,
    preserveItems,
  }
}

function readFieldSources(value: unknown): Record<string, FieldSource> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, FieldSource>) }
  }
  return {}
}
