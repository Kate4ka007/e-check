/**
 * Показывает, в чём модели разошлись между собой на одном и том же чеке.
 *
 *   pnpm diff              все чеки
 *   pnpm diff -- --only 001
 *
 * Нужен для разметки эталона. Там, где все модели сказали одно и то же,
 * ошибка маловероятна; проверять глазами имеет смысл прежде всего
 * расхождения. Это не заменяет сверку с чеком, но показывает, куда
 * смотреть в первую очередь.
 *
 * За опорный берётся ответ с наибольшим числом позиций: пропустить
 * строку модели свойственно куда чаще, чем выдумать лишнюю.
 */
import { compareReceipt } from './compare.js'
import { formatMinor, parseMoneyToMinor } from './money.js'
import { listResults, type StoredResult } from './paths.js'
import type { ParsedReceipt } from './schema.js'

const out = (line = '') => process.stdout.write(line + '\n')

/**
 * Сходится ли сумма позиций с итогом чека.
 *
 * Сильный признак правоты без обращения к самому чеку: пропущенная или
 * выдуманная строка почти всегда ломает равенство. Считает код, не модель.
 */
function reconcile(receipt: ParsedReceipt): string {
  const currency = receipt.currency
  if (receipt.total === null) return 'итог не распознан'

  let sum = 0
  for (const item of receipt.items) {
    const minor = parseMoneyToMinor(item.totalPrice, currency)
    if (minor === null) return 'часть сумм не разобрана'
    sum += minor
  }

  const total = parseMoneyToMinor(receipt.total, currency)
  if (total === null) return 'итог не разобран'

  const delta = sum - total
  if (delta === 0) return `сходится (${formatMinor(total, currency)})`

  return (
    `РАСХОЖДЕНИЕ ${formatMinor(delta, currency)}: ` +
    `позиции ${formatMinor(sum, currency)}, итог ${formatMinor(total, currency)}`
  )
}

function latestPerModel(results: StoredResult[]): StoredResult[] {
  const best = new Map<string, StoredResult>()

  for (const r of results) {
    if (!r.ok || !r.data) continue
    const previous = best.get(r.modelTag)
    if (!previous || r.runAt > previous.runAt) best.set(r.modelTag, r)
  }

  return [...best.values()]
}

async function main() {
  const args = process.argv.slice(2)
  const onlyIdx = args.indexOf('--only')
  const only = onlyIdx !== -1 ? args[onlyIdx + 1]?.split(',').map((s) => s.trim()) : undefined

  let results = await listResults()
  if (only) results = results.filter((r) => only.includes(r.fixtureId))

  const byFixture = new Map<string, StoredResult[]>()
  for (const r of results) {
    const list = byFixture.get(r.fixtureId)
    if (list) list.push(r)
    else byFixture.set(r.fixtureId, [r])
  }

  if (byFixture.size === 0) {
    out('\nНет прогонов.\n')
    return
  }

  for (const fixtureId of [...byFixture.keys()].sort()) {
    const runs = latestPerModel(byFixture.get(fixtureId)!)

    out(`\n${'═'.repeat(74)}`)
    out(`  ${fixtureId}`)
    out('═'.repeat(74))

    if (runs.length === 0) {
      out('  нет успешных прогонов')
      continue
    }

    if (runs.length === 1) {
      out(`  только один успешный прогон (${runs[0]!.modelTag}) — сравнивать не с чем`)
      continue
    }

    runs.sort((a, b) => (b.data as ParsedReceipt).items.length - (a.data as ParsedReceipt).items.length)
    const reference = runs[0]!
    const refData = reference.data as ParsedReceipt

    out('  Сумма позиций против итога чека:')
    for (const r of runs) {
      out(`     ${r.modelTag.padEnd(38)} ${reconcile(r.data as ParsedReceipt)}`)
    }
    out()
    out(`  опорный: ${reference.modelTag}, позиций ${refData.items.length}`)
    out()

    for (const other of runs.slice(1)) {
      const otherData = other.data as ParsedReceipt
      const cmp = compareReceipt(fixtureId, refData, otherData)

      out(`  ── против ${other.modelTag}, позиций ${otherData.items.length} ───────────`)

      const headerDiffs = cmp.header.filter((f) => !f.correct)
      if (headerDiffs.length === 0) {
        out('     шапка: расхождений нет')
      } else {
        for (const f of headerDiffs) {
          out(`     ${f.field}: ${f.expected}  ≠  ${f.actual}`)
        }
      }

      const itemDiffs = cmp.matches.filter(
        (m) => !m.priceCorrect || !m.quantityCorrect || !m.categoryCorrect || !m.lineTypeCorrect,
      )

      if (itemDiffs.length > 0) {
        out(`     расходятся в ${itemDiffs.length} общих позициях:`)
        for (const m of itemDiffs) {
          const parts: string[] = []
          if (!m.priceCorrect) parts.push(`цена ${m.expected.totalPrice} ≠ ${m.actual.totalPrice}`)
          if (!m.quantityCorrect) parts.push(`кол-во ${m.expected.quantity} ≠ ${m.actual.quantity}`)
          if (!m.lineTypeCorrect) parts.push(`тип ${m.expected.lineType} ≠ ${m.actual.lineType}`)
          if (!m.categoryCorrect) parts.push(`кат. ${m.expected.categorySlug} ≠ ${m.actual.categorySlug}`)
          out(`       ${m.expected.name}: ${parts.join(', ')}`)
        }
      }

      if (cmp.missed.length > 0) {
        out(`     есть у опорного, нет здесь (${cmp.missed.length}):`)
        for (const item of cmp.missed) out(`       ${item.name}  ${item.totalPrice}`)
      }

      if (cmp.hallucinated.length > 0) {
        out(`     есть здесь, нет у опорного (${cmp.hallucinated.length}):`)
        for (const item of cmp.hallucinated) out(`       ${item.name}  ${item.totalPrice}`)
      }

      if (itemDiffs.length === 0 && cmp.missed.length === 0 && cmp.hallucinated.length === 0) {
        out('     позиции: расхождений нет')
      }
      out()
    }
  }
}

main().catch((error) => {
  process.stderr.write(String(error) + '\n')
  process.exit(1)
})
