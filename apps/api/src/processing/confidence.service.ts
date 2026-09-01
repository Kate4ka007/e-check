import type { ConfidenceLevel, ParsedReceipt } from '@receipt-tracker/contracts'
import { validateReceiptSum } from '@receipt-tracker/contracts'

const SUM_MEDIUM_THRESHOLD = 0.05

export function computeReceiptConfidence(
  parsed: ParsedReceipt,
  items: Array<{ lineType: string; totalPriceMinor: number }>,
  totalMinor: number | null,
): ConfidenceLevel {
  const validation = validateReceiptSum(
    items.map((item) => ({
      lineType: item.lineType as 'ITEM',
      totalPriceMinor: item.totalPriceMinor,
    })),
    totalMinor,
  )

  if (validation.matchesTotal) return 'HIGH'
  if (totalMinor === null || items.length === 0) return 'LOW'

  const ratio = Math.abs(validation.differenceMinor) / Math.max(Math.abs(totalMinor), 1)
  if (ratio <= SUM_MEDIUM_THRESHOLD) return 'MEDIUM'
  return 'LOW'
}

export function isReasonableDate(value: string | null): boolean {
  if (!value) return false
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return false

  const now = Date.now()
  const tenYearsMs = 10 * 365 * 24 * 60 * 60 * 1000
  return date.getTime() <= now + 24 * 60 * 60 * 1000 && date.getTime() >= now - tenYearsMs
}
