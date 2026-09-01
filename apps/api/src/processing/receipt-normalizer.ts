import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '../generated/prisma'
import {
  addMinor,
  parseMoneyToMinor,
  parseQuantity,
  type ParsedReceipt,
} from '@receipt-tracker/contracts'
import { computeReceiptConfidence, isReasonableDate } from './confidence.service'

const RAW_RESULT_TTL_DAYS = 30

function normalizeMerchantName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export interface NormalizedReceipt {
  merchantId: string | null
  purchasedAt: Date | null
  purchasedTime: string | null
  currency: string
  subtotalMinor: number | null
  taxTotalMinor: number | null
  discountTotalMinor: number | null
  totalMinor: number | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  fieldSources: Record<string, 'AI' | 'USER' | 'OCR'>
  items: Array<{
    id: string
    position: number
    name: string
    lineType: ParsedReceipt['items'][number]['lineType']
    quantity: number
    unit: ParsedReceipt['items'][number]['unit']
    unitPriceMinor: number | null
    totalPriceMinor: number
    categoryId: string | null
    confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  rawResultKey: string
  rawResultExpiresAt: Date
}

export class ReceiptNormalizer {
  constructor(private readonly prisma: PrismaClient) {}

  async normalize(input: {
    userId: string
    receiptId: string
    jobId: string
    parsed: ParsedReceipt
    baseCurrency: string
    raw: unknown
    storageKey: string
  }): Promise<NormalizedReceipt> {
    const currency = parsedCurrency(input.parsed, input.baseCurrency)
    const categoryBySlug = await this.loadSystemCategories()

    let merchantId: string | null = null
    if (input.parsed.merchantName) {
      merchantId = await this.findOrCreateMerchant(input.userId, input.parsed.merchantName)
    }

    const purchasedAt =
      input.parsed.purchasedAt && isReasonableDate(input.parsed.purchasedAt)
        ? new Date(`${input.parsed.purchasedAt}T12:00:00Z`)
        : null

    const items = input.parsed.items.map((item, index) => {
      const totalPriceMinor = parseMoneyToMinor(item.totalPrice, currency) ?? 0
      const unitPriceMinor = parseMoneyToMinor(item.unitPrice, currency)
      const categoryId = categoryBySlug.get(item.categorySlug) ?? categoryBySlug.get('other') ?? null

      return {
        id: randomUUID(),
        position: index,
        name: item.name,
        lineType: item.lineType,
        quantity: parseQuantity(item.quantity),
        unit: item.unit,
        unitPriceMinor,
        totalPriceMinor,
        categoryId,
        confidence: 'MEDIUM' as const,
      }
    })

    let totalMinor = parseMoneyToMinor(input.parsed.total, currency)
    if (totalMinor === null && items.length > 0) {
      totalMinor = items.reduce((sum, item) => addMinor(sum, item.totalPriceMinor), 0)
    }

    const confidence = computeReceiptConfidence(input.parsed, items, totalMinor)
    const fieldSources: Record<string, 'AI'> = {
      merchantName: 'AI',
      purchasedAt: 'AI',
      purchasedTime: 'AI',
      currency: 'AI',
      totalMinor: 'AI',
      items: 'AI',
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + RAW_RESULT_TTL_DAYS)

    return {
      merchantId,
      purchasedAt,
      purchasedTime: input.parsed.purchasedTime,
      currency,
      subtotalMinor: parseMoneyToMinor(input.parsed.subtotal, currency),
      taxTotalMinor: parseMoneyToMinor(input.parsed.taxTotal, currency),
      discountTotalMinor: parseMoneyToMinor(input.parsed.discountTotal, currency),
      totalMinor,
      confidence,
      fieldSources,
      items,
      rawResultKey: input.storageKey,
      rawResultExpiresAt: expiresAt,
    }
  }

  private async loadSystemCategories(): Promise<Map<string, string>> {
    const categories = await this.prisma.category.findMany({
      where: { userId: null, isSystem: true },
    })
    return new Map(categories.map((category) => [category.slug, category.id]))
  }

  private async findOrCreateMerchant(userId: string, name: string): Promise<string> {
    const normalizedName = normalizeMerchantName(name)
    const existing = await this.prisma.merchant.findFirst({
      where: { userId, normalizedName, deletedAt: null },
    })
    if (existing) return existing.id

    const created = await this.prisma.merchant.create({
      data: {
        userId,
        name: name.trim(),
        normalizedName,
      },
    })
    return created.id
  }
}

function parsedCurrency(parsed: ParsedReceipt, baseCurrency: string): string {
  if (parsed.currency && /^[A-Z]{3}$/.test(parsed.currency)) {
    return parsed.currency
  }
  return baseCurrency
}
