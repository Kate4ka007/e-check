import { parseMoneyToMinor, parseQuantity } from './money.js'
import type { ParsedItem, ParsedReceipt } from './schema.js'

/** Нормализация названия для сопоставления: регистр, пробелы, пунктуация. */
export function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,;:!?*"'`()[\]{}/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost)
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[b.length]!
}

/** 1 — совпадение, 0 — ничего общего. */
export function similarity(a: string, b: string): number {
  const x = normalizeName(a)
  const y = normalizeName(b)
  if (x === y) return 1
  const longest = Math.max(x.length, y.length)
  if (longest === 0) return 1
  return 1 - levenshtein(x, y) / longest
}

const NAME_MATCH_THRESHOLD = 0.6

export interface FieldVerdict {
  field: string
  expected: string
  actual: string
  correct: boolean
}

export interface ItemMatch {
  expected: ParsedItem
  actual: ParsedItem
  nameSimilarity: number
  nameExact: boolean
  priceCorrect: boolean
  quantityCorrect: boolean
  categoryCorrect: boolean
  lineTypeCorrect: boolean
}

export interface ReceiptComparison {
  fixtureId: string
  header: FieldVerdict[]
  headerCorrect: number
  headerTotal: number
  matches: ItemMatch[]
  /** Есть в эталоне, модель не нашла */
  missed: ParsedItem[]
  /** Модель вернула, в эталоне нет */
  hallucinated: ParsedItem[]
  expectedItemCount: number
  actualItemCount: number
}

function moneyEqual(
  expected: string | null,
  actual: string | null,
  currency: string | null,
): boolean {
  const e = parseMoneyToMinor(expected, currency)
  const a = parseMoneyToMinor(actual, currency)
  return e === a
}

function compareHeader(expected: ParsedReceipt, actual: ParsedReceipt | null): FieldVerdict[] {
  const currency = expected.currency

  const show = (v: string | null) => v ?? '—'

  return [
    {
      field: 'магазин',
      expected: show(expected.merchantName),
      actual: show(actual?.merchantName ?? null),
      correct:
        expected.merchantName === null
          ? actual?.merchantName == null
          : actual?.merchantName != null &&
            similarity(expected.merchantName, actual.merchantName) >= 0.8,
    },
    {
      field: 'дата',
      expected: show(expected.purchasedAt),
      actual: show(actual?.purchasedAt ?? null),
      correct: expected.purchasedAt === (actual?.purchasedAt ?? null),
    },
    {
      field: 'валюта',
      expected: show(expected.currency),
      actual: show(actual?.currency ?? null),
      correct: expected.currency === (actual?.currency ?? null),
    },
    {
      field: 'итог',
      expected: show(expected.total),
      actual: show(actual?.total ?? null),
      correct: moneyEqual(expected.total, actual?.total ?? null, currency),
    },
  ]
}

/**
 * Сопоставление позиций: жадно, по убыванию похожести названий,
 * один к одному.
 *
 * Порядок строк на чеке модель обычно сохраняет, но пропуск или лишняя
 * строка сдвинули бы всё дальнейшее при сравнении по индексу. Поэтому
 * сопоставляем по названию.
 */
function matchItems(expected: ParsedItem[], actual: ParsedItem[], currency: string | null) {
  const pairs: { ei: number; ai: number; score: number }[] = []

  expected.forEach((e, ei) => {
    actual.forEach((a, ai) => {
      const score = similarity(e.name, a.name)
      if (score >= NAME_MATCH_THRESHOLD) pairs.push({ ei, ai, score })
    })
  })

  pairs.sort((x, y) => y.score - x.score)

  const usedExpected = new Set<number>()
  const usedActual = new Set<number>()
  const matches: ItemMatch[] = []

  // Ненапечатанное количество означает одну штуку: строка без числа
  // и строка с «1» описывают одну и ту же покупку.
  const quantityValue = (value: string | null) => (value === null ? 1 : parseQuantity(value))

  for (const { ei, ai, score } of pairs) {
    if (usedExpected.has(ei) || usedActual.has(ai)) continue
    usedExpected.add(ei)
    usedActual.add(ai)

    const e = expected[ei]!
    const a = actual[ai]!

    matches.push({
      expected: e,
      actual: a,
      nameSimilarity: score,
      nameExact: normalizeName(e.name) === normalizeName(a.name),
      priceCorrect: moneyEqual(e.totalPrice, a.totalPrice, currency),
      quantityCorrect: quantityValue(e.quantity) === quantityValue(a.quantity),
      categoryCorrect: e.categorySlug === a.categorySlug,
      lineTypeCorrect: e.lineType === a.lineType,
    })
  }

  return {
    matches,
    missed: expected.filter((_, i) => !usedExpected.has(i)),
    hallucinated: actual.filter((_, i) => !usedActual.has(i)),
  }
}

export function compareReceipt(
  fixtureId: string,
  expected: ParsedReceipt,
  actual: ParsedReceipt | null,
): ReceiptComparison {
  const header = compareHeader(expected, actual)
  const { matches, missed, hallucinated } = matchItems(
    expected.items,
    actual?.items ?? [],
    expected.currency,
  )

  return {
    fixtureId,
    header,
    headerCorrect: header.filter((f) => f.correct).length,
    headerTotal: header.length,
    matches,
    missed,
    hallucinated,
    expectedItemCount: expected.items.length,
    actualItemCount: actual?.items.length ?? 0,
  }
}

export interface Aggregate {
  receiptCount: number
  /** Чеки, где модель вернула валидный ответ */
  parsedCount: number

  merchantCorrect: number
  dateCorrect: number
  currencyCorrect: number
  totalCorrect: number
  /** Чеки, где верны все три ключевых поля: магазин, дата, итог */
  headerFullyCorrect: number

  expectedItems: number
  matchedItems: number
  missedItems: number
  hallucinatedItems: number

  itemNameExact: number
  itemPriceCorrect: number
  itemQuantityCorrect: number
  itemCategoryCorrect: number
  itemLineTypeCorrect: number
  /** Позиции, где верны и название, и цена — практический критерий */
  itemFullyCorrect: number
}

export function aggregate(comparisons: ReceiptComparison[], parsedCount: number): Aggregate {
  const agg: Aggregate = {
    receiptCount: comparisons.length,
    parsedCount,
    merchantCorrect: 0,
    dateCorrect: 0,
    currencyCorrect: 0,
    totalCorrect: 0,
    headerFullyCorrect: 0,
    expectedItems: 0,
    matchedItems: 0,
    missedItems: 0,
    hallucinatedItems: 0,
    itemNameExact: 0,
    itemPriceCorrect: 0,
    itemQuantityCorrect: 0,
    itemCategoryCorrect: 0,
    itemLineTypeCorrect: 0,
    itemFullyCorrect: 0,
  }

  for (const c of comparisons) {
    const byField = Object.fromEntries(c.header.map((f) => [f.field, f.correct]))
    if (byField['магазин']) agg.merchantCorrect++
    if (byField['дата']) agg.dateCorrect++
    if (byField['валюта']) agg.currencyCorrect++
    if (byField['итог']) agg.totalCorrect++
    if (byField['магазин'] && byField['дата'] && byField['итог']) agg.headerFullyCorrect++

    agg.expectedItems += c.expectedItemCount
    agg.matchedItems += c.matches.length
    agg.missedItems += c.missed.length
    agg.hallucinatedItems += c.hallucinated.length

    for (const m of c.matches) {
      if (m.nameExact) agg.itemNameExact++
      if (m.priceCorrect) agg.itemPriceCorrect++
      if (m.quantityCorrect) agg.itemQuantityCorrect++
      if (m.categoryCorrect) agg.itemCategoryCorrect++
      if (m.lineTypeCorrect) agg.itemLineTypeCorrect++
      if (m.nameExact && m.priceCorrect) agg.itemFullyCorrect++
    }
  }

  return agg
}
