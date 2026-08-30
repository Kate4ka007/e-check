/**
 * Сравнивает результаты прогона с ручной разметкой и печатает точность.
 *
 *   pnpm score                       вариант vision
 *   pnpm score -- --kind two-stage
 *   pnpm score -- --details          разбор каждого чека построчно
 *
 * Итог дописывается в results/HISTORY.md — без этой таблицы правки промпта
 * превращаются в хождение по кругу.
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { aggregate, compareReceipt, type ReceiptComparison } from './compare.js'
import { prepareImage } from './image.js'
import { listFixtures, RESULTS_DIR, resultPath } from './paths.js'
import { PROMPT_VERSION } from './prompt.js'
import { ParsedReceiptSchema, type ParsedReceipt } from './schema.js'

/** Пороги из PROJECT_PLAN.md, раздел 1. */
const THRESHOLDS = { header: 0.9, items: 0.8 }

const pct = (part: number, whole: number) => (whole === 0 ? 0 : (part / whole) * 100)
const fmtPct = (value: number) => `${value.toFixed(0)}%`.padStart(4)

function bar(value: number, width = 20): string {
  const filled = Math.round((value / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

async function main() {
  const args = process.argv.slice(2)
  const kindIndex = args.indexOf('--kind')
  const kind = kindIndex !== -1 ? args[kindIndex + 1]! : 'vision'
  const details = args.includes('--details')

  const fixtures = await listFixtures()
  const comparisons: ReceiptComparison[] = []

  let missingExpected = 0
  let missingResult = 0
  let parsedCount = 0
  let totalDuration = 0
  let totalCost = 0
  const models = new Set<string>()

  for (const fixture of fixtures) {
    let expected: ParsedReceipt
    try {
      const raw = JSON.parse(await readFile(fixture.expectedPath, 'utf8'))
      delete (raw as Record<string, unknown>)._README
      const parsed = ParsedReceiptSchema.safeParse(raw)
      if (!parsed.success) {
        console.error(`  ${fixture.id}  разметка не проходит схему:`)
        for (const issue of parsed.error.issues.slice(0, 3)) {
          console.error(`      ${issue.path.join('.') || '<root>'}: ${issue.message}`)
        }
        missingExpected++
        continue
      }
      expected = parsed.data
    } catch {
      missingExpected++
      continue
    }

    const image = await prepareImage(fixture.imagePath)
    const path = resultPath(fixture.id, kind, PROMPT_VERSION, image.sourceSha256)

    if (!existsSync(path)) {
      missingResult++
      continue
    }

    const stored = JSON.parse(await readFile(path, 'utf8')) as {
      ok: boolean
      data: ParsedReceipt | null
      model: string
      durationMs: number
      costMicros: number
    }

    if (stored.ok && stored.data) parsedCount++
    totalDuration += stored.durationMs
    totalCost += stored.costMicros
    models.add(stored.model)

    comparisons.push(compareReceipt(fixture.id, expected, stored.data))
  }

  if (comparisons.length === 0) {
    console.error('\nНечего оценивать.')
    if (missingExpected > 0) console.error(`  Без разметки: ${missingExpected}. Запустите pnpm annotate`)
    if (missingResult > 0) console.error(`  Без результата прогона: ${missingResult}. Запустите pnpm run`)
    process.exit(1)
  }

  const agg = aggregate(comparisons, parsedCount)

  const headerAccuracy = pct(agg.headerFullyCorrect, agg.receiptCount)
  const itemRecall = pct(agg.matchedItems, agg.expectedItems)
  const itemAccuracy = pct(agg.itemFullyCorrect, agg.expectedItems)

  console.log(`\n${'═'.repeat(62)}`)
  console.log(`  Вариант: ${kind}    промпт: ${PROMPT_VERSION}    чеков: ${agg.receiptCount}`)
  console.log(`  Модели: ${[...models].join(', ')}`)
  console.log('═'.repeat(62))

  console.log(`\n  Ответ прошёл схему        ${fmtPct(pct(agg.parsedCount, agg.receiptCount))}  ${agg.parsedCount}/${agg.receiptCount}`)

  console.log('\n  ── Шапка чека ──────────────────────────────────────')
  const headerRows = [
    ['магазин', agg.merchantCorrect],
    ['дата', agg.dateCorrect],
    ['валюта', agg.currencyCorrect],
    ['итоговая сумма', agg.totalCorrect],
  ] as const

  for (const [label, correct] of headerRows) {
    const value = pct(correct, agg.receiptCount)
    console.log(`  ${label.padEnd(18)} ${fmtPct(value)}  ${bar(value)}  ${correct}/${agg.receiptCount}`)
  }

  console.log(`\n  ${'все три ключевых'.padEnd(18)} ${fmtPct(headerAccuracy)}  ${bar(headerAccuracy)}  ${agg.headerFullyCorrect}/${agg.receiptCount}`)

  console.log('\n  ── Позиции ─────────────────────────────────────────')
  console.log(`  в эталоне ${agg.expectedItems}, модель вернула ${agg.matchedItems + agg.hallucinatedItems}`)
  console.log()

  const itemRows = [
    ['найдено', agg.matchedItems, agg.expectedItems],
    ['название точно', agg.itemNameExact, agg.expectedItems],
    ['цена верна', agg.itemPriceCorrect, agg.expectedItems],
    ['количество верно', agg.itemQuantityCorrect, agg.expectedItems],
    ['тип строки верен', agg.itemLineTypeCorrect, agg.expectedItems],
    ['категория верна', agg.itemCategoryCorrect, agg.expectedItems],
  ] as const

  for (const [label, correct, total] of itemRows) {
    const value = pct(correct, total)
    console.log(`  ${label.padEnd(18)} ${fmtPct(value)}  ${bar(value)}  ${correct}/${total}`)
  }

  console.log(`\n  ${'название + цена'.padEnd(18)} ${fmtPct(itemAccuracy)}  ${bar(itemAccuracy)}  ${agg.itemFullyCorrect}/${agg.expectedItems}`)

  console.log(`\n  пропущено позиций    ${agg.missedItems}`)
  console.log(`  выдумано позиций     ${agg.hallucinatedItems}${agg.hallucinatedItems > 0 ? '   ← хуже пропусков: их не заметят' : ''}`)

  console.log('\n  ── Ресурсы ─────────────────────────────────────────')
  console.log(`  среднее время        ${(totalDuration / agg.receiptCount / 1000).toFixed(1)}с на чек`)
  console.log(
    `  стоимость            ${totalCost === 0 ? '0 (бесплатные модели)' : `$${(totalCost / 1_000_000).toFixed(4)} за ${agg.receiptCount}`}`,
  )

  console.log('\n  ── Пороги гипотезы ─────────────────────────────────')
  const headerPass = headerAccuracy >= THRESHOLDS.header * 100
  const itemPass = itemAccuracy >= THRESHOLDS.items * 100
  console.log(`  шапка   ≥ ${THRESHOLDS.header * 100}%   ${fmtPct(headerAccuracy)}   ${headerPass ? 'проходит' : 'НЕ проходит'}`)
  console.log(`  позиции ≥ ${THRESHOLDS.items * 100}%   ${fmtPct(itemAccuracy)}   ${itemPass ? 'проходит' : 'НЕ проходит'}`)

  if (agg.receiptCount < 20) {
    console.log(
      `\n  Внимание: ${agg.receiptCount} чеков — это не выборка. Цифры показывают,\n` +
        '  что конвейер работает, но не насколько он точен. Для вывода о\n' +
        '  гипотезе нужно 30–50 чеков разных магазинов.',
    )
  }

  console.log(`\n${'═'.repeat(62)}\n`)

  if (details) printDetails(comparisons)

  await appendHistory(kind, [...models].join(', '), agg.receiptCount, {
    headerAccuracy,
    itemRecall,
    itemAccuracy,
    hallucinated: agg.hallucinatedItems,
    avgSeconds: totalDuration / agg.receiptCount / 1000,
  })
}

function printDetails(comparisons: ReceiptComparison[]) {
  for (const c of comparisons) {
    console.log(`\n── ${c.fixtureId} ${'─'.repeat(50)}`)

    for (const f of c.header) {
      if (f.correct) continue
      console.log(`  ✗ ${f.field}: ожидалось "${f.expected}", получено "${f.actual}"`)
    }

    for (const m of c.matches) {
      const problems: string[] = []
      if (!m.nameExact) problems.push(`название "${m.actual.name}" вместо "${m.expected.name}"`)
      if (!m.priceCorrect) problems.push(`цена ${m.actual.totalPrice} вместо ${m.expected.totalPrice}`)
      if (!m.quantityCorrect) problems.push(`кол-во ${m.actual.quantity} вместо ${m.expected.quantity}`)
      if (!m.lineTypeCorrect) problems.push(`тип ${m.actual.lineType} вместо ${m.expected.lineType}`)
      if (!m.categoryCorrect) problems.push(`категория ${m.actual.categorySlug} вместо ${m.expected.categorySlug}`)
      if (problems.length > 0) console.log(`  ~ ${m.expected.name}: ${problems.join('; ')}`)
    }

    for (const item of c.missed) console.log(`  ✗ пропущено: ${item.name} (${item.totalPrice})`)
    for (const item of c.hallucinated) console.log(`  ! выдумано: ${item.name} (${item.totalPrice})`)

    const clean =
      c.header.every((f) => f.correct) &&
      c.missed.length === 0 &&
      c.hallucinated.length === 0 &&
      c.matches.every((m) => m.nameExact && m.priceCorrect)
    if (clean) console.log('  всё верно')
  }
  console.log()
}

async function appendHistory(
  kind: string,
  models: string,
  receiptCount: number,
  metrics: {
    headerAccuracy: number
    itemRecall: number
    itemAccuracy: number
    hallucinated: number
    avgSeconds: number
  },
) {
  const path = join(RESULTS_DIR, 'HISTORY.md')

  if (!existsSync(path)) {
    await writeFile(
      path,
      '# История замеров точности\n\n' +
        'Строка добавляется при каждом запуске `pnpm score`.\n' +
        'Сравнивать имеет смысл только строки с одинаковым числом чеков.\n\n' +
        '| Дата | Вариант | Промпт | Чеков | Шапка | Найдено позиций | Название+цена | Выдумано | Сек/чек | Модель |\n' +
        '|---|---|---|---|---|---|---|---|---|---|\n',
      'utf8',
    )
  }

  const date = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const row =
    `| ${date} | ${kind} | ${PROMPT_VERSION} | ${receiptCount} | ` +
    `${metrics.headerAccuracy.toFixed(0)}% | ${metrics.itemRecall.toFixed(0)}% | ` +
    `${metrics.itemAccuracy.toFixed(0)}% | ${metrics.hallucinated} | ` +
    `${metrics.avgSeconds.toFixed(1)} | ${models} |\n`

  await appendFile(path, row, 'utf8')
  console.log(`Запись добавлена в results/HISTORY.md\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
