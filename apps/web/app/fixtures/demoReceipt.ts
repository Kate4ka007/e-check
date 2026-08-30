import { validateReceiptSum, type ReceiptDetail } from '@receipt-tracker/contracts'

/**
 * Синтетический чек для разработки интерфейса.
 *
 * Настоящие чеки — персональные данные и в репозиторий не попадают.
 * Чтобы посмотреть экран на реальном ответе модели, есть команда
 * `pnpm fixture:import` — она кладёт результат из spike/ в игнорируемый
 * git каталог, см. README приложения.
 *
 * Набор подобран так, чтобы проверить неудобные случаи: весовой товар
 * с дробным количеством, скидка отдельной строкой с отрицательной суммой
 * и поле с низкой уверенностью.
 */
const items: ReceiptDetail['items'] = [
  {
    id: 'demo-item-1',
    position: 1,
    name: 'Хлеб бородинский 400г',
    lineType: 'ITEM',
    quantity: '1',
    unit: 'PCS',
    unitPriceMinor: 245,
    totalPriceMinor: 245,
    categoryId: 'groceries',
    confidence: 'HIGH',
  },
  {
    id: 'demo-item-2',
    position: 2,
    name: 'Молоко 3,2% 1л',
    lineType: 'ITEM',
    quantity: '1',
    unit: 'PCS',
    unitPriceMinor: 380,
    totalPriceMinor: 380,
    categoryId: 'groceries',
    confidence: 'HIGH',
  },
  {
    id: 'demo-item-3',
    position: 3,
    name: 'Яблоки Гала',
    lineType: 'ITEM',
    quantity: '1.420',
    unit: 'KG',
    unitPriceMinor: 300,
    totalPriceMinor: 426,
    categoryId: 'groceries',
    confidence: 'MEDIUM',
  },
  {
    id: 'demo-item-4',
    position: 4,
    name: 'Кофе зерновой 250г',
    lineType: 'ITEM',
    quantity: '1',
    unit: 'PCS',
    unitPriceMinor: 1890,
    totalPriceMinor: 1890,
    categoryId: 'groceries',
    confidence: 'LOW',
  },
  {
    id: 'demo-item-5',
    position: 5,
    name: 'Скидка по карте',
    lineType: 'DISCOUNT',
    quantity: '1',
    unit: 'PCS',
    unitPriceMinor: null,
    totalPriceMinor: -189,
    categoryId: 'groceries',
    confidence: 'HIGH',
  },
]

export function createDemoReceipt(): ReceiptDetail {
  return {
    id: 'demo',
    purchasedAt: '2026-08-30',
    purchasedTime: '14:12',
    currency: 'BYN',

    subtotalMinor: null,
    taxTotalMinor: null,
    discountTotalMinor: -189,
    totalMinor: 2752,

    receiptNumber: '000184',
    note: null,

    status: 'DRAFT',
    processingStatus: 'COMPLETED',
    entryMode: 'SCAN',
    confidence: 'MEDIUM',

    imageUrl: '/demo-receipt.svg',
    thumbnailUrl: '/demo-receipt.svg',

    merchant: { id: 'demo-merchant', name: 'Продукты у дома' },
    items,

    fieldSources: {
      merchantName: 'AI',
      purchasedAt: 'AI',
      purchasedTime: 'AI',
      currency: 'AI',
      totalMinor: 'AI',
    },

    validation: validateReceiptSum(items, 2752),

    createdAt: '2026-08-30T14:20:00.000Z',
    updatedAt: '2026-08-30T14:20:00.000Z',
    confirmedAt: null,
  }
}
