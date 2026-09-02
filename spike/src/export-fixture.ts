/**
 * Кладёт результат распознавания в apps/web как локальную фикстуру,
 * чтобы посмотреть экран проверки на настоящем ответе модели.
 *
 *   pnpm fixture                                 прогоны модели из VISION_MODELS (.env)
 *   pnpm fixture -- --model openai-gpt-4o-mini   конкретная модель (для сравнения)
 *
 * Каталог назначения в .gitignore: чеки — персональные данные и в
 * репозиторий попадать не должны. В репозитории лежит синтетический
 * образец, см. apps/web/app/fixtures/demoReceipt.ts.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.js'
import { prepareImage } from './image.js'
import { parseMoneyToMinor, parseQuantity } from './money.js'
import { listFixtures, listResults, modelTag, type StoredResult } from './paths.js'
import type { ParsedItem, ParsedReceipt } from './schema.js'

const TARGET_DIR = join(process.cwd(), '..', 'apps', 'web', 'public', '.local')
const out = (line = '') => process.stdout.write(line + '\n')

/**
 * Уверенность вычисляется из проверяемых признаков, а не спрашивается
 * у модели, см. ADR-0010. Здесь это черновая версия для наполнения экрана:
 * настоящая переедет на бэкенд вместе с обработкой.
 */
function itemConfidence(item: ParsedItem, currency: string | null): 'HIGH' | 'MEDIUM' | 'LOW' {
  const total = parseMoneyToMinor(item.totalPrice, currency)
  const unit = parseMoneyToMinor(item.unitPrice, currency)

  if (total === null) return 'LOW'
  if (unit === null) return 'MEDIUM'

  // Цена за единицу, умноженная на количество, должна дать сумму строки.
  // Допуск в одну копейку — округление на кассе при дробном весе.
  const expected = Math.round(unit * parseQuantity(item.quantity))
  return Math.abs(expected - total) <= 1 ? 'HIGH' : 'LOW'
}

function receiptConfidence(receipt: ParsedReceipt, sumMatches: boolean): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (!sumMatches) return 'LOW'
  const complete = receipt.merchantName && receipt.purchasedAt && receipt.currency
  return complete ? 'HIGH' : 'MEDIUM'
}

function toDetail(result: StoredResult, imageUrl: string) {
  const parsed = result.data as ParsedReceipt
  const currency = parsed.currency

  const items = parsed.items.map((item, index) => ({
    id: `${result.fixtureId}-${index + 1}`,
    position: index + 1,
    name: item.name,
    lineType: item.lineType,
    quantity: item.quantity ?? '1',
    unit: item.unit,
    unitPriceMinor: parseMoneyToMinor(item.unitPrice, currency),
    totalPriceMinor: parseMoneyToMinor(item.totalPrice, currency) ?? 0,
    categoryId: item.categorySlug,
    confidence: itemConfidence(item, currency),
  }))

  const totalMinor = parseMoneyToMinor(parsed.total, currency)
  const itemsSumMinor = items.reduce((sum, item) => sum + item.totalPriceMinor, 0)
  const differenceMinor = totalMinor === null ? 0 : itemsSumMinor - totalMinor
  const matchesTotal = totalMinor !== null && Math.abs(differenceMinor) <= 2

  return {
    id: result.fixtureId,
    purchasedAt: parsed.purchasedAt,
    purchasedTime: parsed.purchasedTime,
    currency,

    subtotalMinor: parseMoneyToMinor(parsed.subtotal, currency),
    taxTotalMinor: parseMoneyToMinor(parsed.taxTotal, currency),
    discountTotalMinor: parseMoneyToMinor(parsed.discountTotal, currency),
    totalMinor,

    receiptNumber: null,
    note: null,

    status: 'DRAFT' as const,
    processingStatus: 'COMPLETED' as const,
    entryMode: 'SCAN' as const,
    confidence: receiptConfidence(parsed, matchesTotal),

    imageUrl,
    thumbnailUrl: imageUrl,

    merchant: parsed.merchantName ? { id: result.fixtureId, name: parsed.merchantName } : null,
    items,

    fieldSources: {
      merchantName: 'AI' as const,
      purchasedAt: 'AI' as const,
      purchasedTime: 'AI' as const,
      currency: 'AI' as const,
      totalMinor: 'AI' as const,
    },

    validation: { itemsSumMinor, matchesTotal, differenceMinor },

    createdAt: result.runAt,
    updatedAt: result.runAt,
    confirmedAt: null,

    /** Не часть контракта: чтобы в интерфейсе было видно, чей это ответ. */
    _source: { model: result.model, promptVersion: result.promptVersion },
  }
}

async function main() {
  const args = process.argv.slice(2)
  const modelIndex = args.indexOf('--model')
  const preferredTag = modelTag(config.VISION_MODELS)
  const wantedModel = modelIndex !== -1 ? args[modelIndex + 1] : preferredTag || undefined

  if (!wantedModel) {
    out('\nЗадайте VISION_MODELS в spike/.env или передайте --model\n')
    process.exit(1)
  }

  const results = (await listResults()).filter((r) => r.ok && r.data)
  const fixtures = await listFixtures()

  if (results.length === 0) {
    out('\nНет успешных прогонов. Сначала pnpm extract\n')
    process.exit(1)
  }

  // По одному прогону на чек: самый свежий среди подходящих
  const chosen = new Map<string, StoredResult>()
  for (const r of results) {
    if (wantedModel && r.modelTag !== wantedModel) continue
    const previous = chosen.get(r.fixtureId)
    if (!previous || r.runAt > previous.runAt) chosen.set(r.fixtureId, r)
  }

  if (chosen.size === 0) {
    out(`\nНет прогонов модели "${wantedModel}".\n`)
    process.exit(1)
  }

  await mkdir(TARGET_DIR, { recursive: true })

  const receipts = []

  for (const [fixtureId, result] of [...chosen].sort()) {
    const fixture = fixtures.find((f) => f.id === fixtureId)
    if (!fixture) continue

    const image = await prepareImage(fixture.imagePath)
    const imageName = `${fixtureId}.jpg`
    await writeFile(join(TARGET_DIR, imageName), image.buffer)

    receipts.push(toDetail(result, `/.local/${imageName}`))
    out(
      `  ${fixtureId}  ${result.modelTag}, позиций ${(result.data as ParsedReceipt).items.length}`,
    )
  }

  await writeFile(join(TARGET_DIR, 'receipts.json'), JSON.stringify(receipts, null, 2), 'utf8')

  out(`\nГотово: ${receipts.length} чеков в apps/web/public/.local/`)
  out(`Модель: ${wantedModel}`)
  out('Каталог в .gitignore — чеки в репозиторий не попадут.\n')
}

main().catch((error) => {
  process.stderr.write(String(error) + '\n')
  process.exit(1)
})
