import { ParsedReceiptSchema, type ParsedReceipt } from '@receipt-tracker/contracts'
import type {
  ExtractionInput,
  ExtractionResult,
  ReceiptExtractor,
} from './receipt-extractor'

function buildMockReceipt(hints?: ExtractionInput['hints']): ParsedReceipt {
  const currency = hints?.expectedCurrency ?? 'BYN'
  return {
    merchantName: 'Mock Store',
    purchasedAt: '2026-01-15',
    purchasedTime: '14:30',
    currency,
    items: [
      {
        name: 'Хлеб белый',
        lineType: 'ITEM',
        quantity: '1',
        unit: 'PCS',
        unitPrice: '2,50',
        totalPrice: '2,50',
        categorySlug: 'groceries',
      },
      {
        name: 'Молоко 2,5%',
        lineType: 'ITEM',
        quantity: '1',
        unit: 'PCS',
        unitPrice: '3,20',
        totalPrice: '3,20',
        categorySlug: 'groceries',
      },
    ],
    subtotal: '5,70',
    taxTotal: null,
    discountTotal: null,
    total: '5,70',
  }
}

export class MockExtractor implements ReceiptExtractor {
  readonly kind = 'mock' as const

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const data = buildMockReceipt(input.hints)
    ParsedReceiptSchema.parse(data)

    return {
      ok: true,
      data,
      raw: data,
      model: 'mock',
      durationMs: 50,
      costMicros: 0,
      attempts: 1,
    }
  }
}
