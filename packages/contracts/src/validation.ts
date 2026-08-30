import type { ReceiptValidation } from './receipt.js'
import type { LineType } from './enums.js'

/**
 * Допуск при сверке суммы позиций с итогом чека.
 *
 * Ноль здесь был бы вреден: на реальных чеках встречаются округления
 * и скидки на весь чек, не выраженные отдельной строкой. Расхождение —
 * повод показать предупреждение, а не запретить сохранение.
 */
export const SUM_TOLERANCE_MINOR = 2

interface SummableItem {
  lineType: LineType
  totalPriceMinor: number
}

/**
 * Сверяет сумму позиций с итогом чека.
 *
 * В сумму входят все строки, включая скидки и депозиты: их знак уже
 * отрицательный там, где нужно, и именно так они складываются на кассе.
 */
export function validateReceiptSum(
  items: readonly SummableItem[],
  totalMinor: number | null,
): ReceiptValidation {
  const itemsSumMinor = items.reduce((sum, item) => sum + item.totalPriceMinor, 0)

  if (totalMinor === null) {
    return { itemsSumMinor, matchesTotal: false, differenceMinor: 0 }
  }

  const differenceMinor = itemsSumMinor - totalMinor

  return {
    itemsSumMinor,
    matchesTotal: Math.abs(differenceMinor) <= SUM_TOLERANCE_MINOR,
    differenceMinor,
  }
}
