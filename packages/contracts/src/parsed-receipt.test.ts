import { describe, expect, it } from 'vitest'
import { ParsedReceiptSchema } from './parsed-receipt.js'

const baseReceipt = {
  merchantName: 'UNISTORE',
  purchasedAt: '2026-09-02',
  purchasedTime: '21:44',
  currency: 'BYN',
  subtotal: null,
  taxTotal: null,
  discountTotal: null,
  total: '28.32',
}

function item(overrides: Record<string, unknown>) {
  return {
    name: 'Товар',
    lineType: 'ITEM',
    quantity: '1',
    unit: 'PCS',
    categorySlug: 'groceries',
    unitPrice: '3.49',
    totalPrice: '3.49',
    ...overrides,
  }
}

describe('ParsedReceiptSchema money normalization', () => {
  it('accepts JSON numbers for prices', () => {
    const result = ParsedReceiptSchema.safeParse({
      ...baseReceipt,
      items: [item({ unitPrice: 3.49, totalPrice: 3.49 })],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0]?.unitPrice).toBe('3.49')
      expect(result.data.items[0]?.totalPrice).toBe('3.49')
    }
  })

  it('trims four-decimal prices from the model', () => {
    const result = ParsedReceiptSchema.safeParse({
      ...baseReceipt,
      items: [item({ unitPrice: '3.4900', totalPrice: '9.3500' })],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0]?.unitPrice).toBe('3.49')
      expect(result.data.items[0]?.totalPrice).toBe('9.35')
    }
  })

  it('strips currency suffixes from prices', () => {
    const result = ParsedReceiptSchema.safeParse({
      ...baseReceipt,
      items: [item({ unitPrice: '3.49 BYN', totalPrice: '3.49 BYN' })],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0]?.unitPrice).toBe('3.49')
      expect(result.data.items[0]?.totalPrice).toBe('3.49')
    }
  })

  it('extracts unit price from quantity expressions', () => {
    const result = ParsedReceiptSchema.safeParse({
      ...baseReceipt,
      items: [item({ unitPrice: '15.69 x 0.596', totalPrice: '9.35' })],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0]?.unitPrice).toBe('15.69')
      expect(result.data.items[0]?.totalPrice).toBe('9.35')
    }
  })
})
