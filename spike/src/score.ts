/**
 * Сравнивает сохранённые прогоны с ручной разметкой.
 *
 *   pnpm score                       таблица по всем прогонам
 *   pnpm score -- --details          разбор ошибок лучшего прогона
 *   pnpm score -- --details --pick openai-gpt-4o-mini
 *   pnpm score -- --kind two-stage   только двухэтапные прогоны
 *
 * Прогоны группируются по варианту, версии промпта и модели, поэтому
 * сравнение моделей между собой получается само.
 *
 * Итог дописывается в results/HISTORY.md — без этой таблицы правки
 * промпта превращаются в хождение по кругу.
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { aggregate, compareReceipt, type Aggregate, type ReceiptComparison } from './compare.js'
import { listFixtures, listResults, RESULTS_DIR, type StoredResult } from './paths.js'
import { ParsedReceiptSchema, type ParsedReceipt } from './schema.js'

/** Пороги из PROJECT_PLAN.md, раздел 1. */
const THRESHOLDS = { header: 0.9, items: 0.8 }

const pct = (part: number, whole: number) => (whole === 0 ? 0 : (part / whole) * 100)
const fmtPct = (v: number) => `${v.toFixed(0)}%`.padStart(4)
const bar = (v: number, w = 18) =>
  '█'.repeat(Math.round((v / 100) * w)) + '░'.repeat(w - Math.round((v / 100) * w))

interface RunGroup {
  key: string
  kind: string
  promptVersion: string
  modelTag: string
  actualModels: Set<string>
  results: StoredResult[]
  comparisons: ReceiptComparison[]
  agg: Aggregate
  parsedCount: number
  avgSeconds: number
  costMicros: number
  headerAccuracy: number
  itemRecall: number
  itemAccuracy: number
}

async function loadExpected(): Promise<Map<string, ParsedReceipt>> {
  const fixtures = await listFixtures()
  const expected = new Map<string, ParsedReceipt>()
  const problems: string[] = []

  for (const fixture of fixtures) {
    let raw: unknown
    try {
      raw = JSON.parse(await readFile(fixture.expectedPath, 'utf8'))
    } catch {
      problems.push(`  ${fixture.id}  разметки нет`)
      continue
    }

    delete (raw as Record<string, unknown>)._README
    const parsed = ParsedReceiptSchema.safeParse(raw)

    if (!parsed.success) {
      const first = parsed.error.issues[0]
      problems.push(
        `  ${fixture.id}  разметка не проходит схему: ${first?.path.join('.') || '<root>'} — ${first?.message}`,
      )
      continue
    }

    expected.set(fixture.id, parsed.data)
  }

  if (problems.length > 0) {
    console.log('\nПропущены чеки:')
    problems.forEach((p) => console.log(p))
  }

  return expected
}

function groupRuns(results: StoredResult[], expected: Map<string, ParsedReceipt>): RunGroup[] {
  const buckets = new Map<string, StoredResult[]>()

  for (const r of results) {
    if (!expected.has(r.fixtureId)) continue
    const key = `${r.kind}|${r.promptVersion}|${r.modelTag ?? 'unknown'}`
    const list = buckets.get(key)
    if (list) list.push(r)
    else buckets.set(key, [r])
  }

  const groups: RunGroup[] = []

  for (const [key, list] of buckets) {
    const [kind = '?', promptVersion = '?', tag = '?'] = key.split('|')
    const comparisons = list.map((r) =>
      compareReceipt(
        r.fixtureId,
        expected.get(r.fixtureId)!,
        (r.data as ParsedReceipt | null) ?? null,
      ),
    )
    const parsedCount = list.filter((r) => r.ok).length
    const agg = aggregate(comparisons, parsedCount)

    groups.push({
      key,
      kind,
      promptVersion,
      modelTag: tag,
      actualModels: new Set(list.map((r) => r.model).filter((m) => m && m !== '—')),
      results: list,
      comparisons,
      agg,
      parsedCount,
      avgSeconds: list.reduce((s, r) => s + r.durationMs, 0) / list.length / 1000,
      costMicros: list.reduce((s, r) => s + r.costMicros, 0),
      headerAccuracy: pct(agg.headerFullyCorrect, agg.receiptCount),
      itemRecall: pct(agg.matchedItems, agg.expectedItems),
      itemAccuracy: pct(agg.itemFullyCorrect, agg.expectedItems),
    })
  }

  // Лучший — по позициям, при равенстве по шапке
  return groups.sort(
    (a, b) => b.itemAccuracy - a.itemAccuracy || b.headerAccuracy - a.headerAccuracy,
  )
}

function printLeaderboard(groups: RunGroup[]) {
  console.log(`\n${'═'.repeat(78)}`)
  console.log('  Сравнение прогонов')
  console.log('═'.repeat(78))
  console.log()
  console.log(
    '  модель'.padEnd(34) +
      'вар.'.padEnd(11) +
      'пром.'.padEnd(7) +
      'схема'.padEnd(7) +
      'шапка'.padEnd(7) +
      'позиц.'.padEnd(8) +
      'выдум.'.padEnd(8) +
      'сек',
  )
  console.log('  ' + '─'.repeat(80))

  for (const g of groups) {
    const schema = fmtPct(pct(g.parsedCount, g.agg.receiptCount))
    console.log(
      '  ' +
        g.modelTag.slice(0, 31).padEnd(32) +
        g.kind.padEnd(11) +
        g.promptVersion.padEnd(7) +
        schema.padEnd(7) +
        fmtPct(g.headerAccuracy).padEnd(7) +
        fmtPct(g.itemAccuracy).padEnd(8) +
        String(g.agg.hallucinatedItems).padEnd(8) +
        g.avgSeconds.toFixed(1),
    )
  }

  const paid = groups.filter((g) => g.costMicros > 0)
  if (paid.length > 0) {
    console.log('\n  Стоимость:')
    for (const g of paid) {
      const perReceipt = g.costMicros / g.agg.receiptCount / 1_000_000
      console.log(
        `    ${g.modelTag.padEnd(32)} $${perReceipt.toFixed(4)} за чек   ` +
          `$${(perReceipt * 100).toFixed(2)} на 100 чеков в месяц`,
      )
    }
  }

  console.log()
}

function printDetail(g: RunGroup) {
  const { agg } = g

  console.log(`${'═'.repeat(78)}`)
  console.log(`  ${g.modelTag}   вариант: ${g.kind}   промпт: ${g.promptVersion}`)
  if (g.actualModels.size > 0)
    console.log(`  Фактически отвечали: ${[...g.actualModels].join(', ')}`)
  console.log('═'.repeat(78))

  console.log(
    `\n  Ответ прошёл схему   ${fmtPct(pct(g.parsedCount, agg.receiptCount))}  ${g.parsedCount}/${agg.receiptCount}`,
  )

  console.log('\n  ── Шапка чека ──────────────────────────────────')
  const headerRows = [
    ['магазин', agg.merchantCorrect],
    ['дата', agg.dateCorrect],
    ['валюта', agg.currencyCorrect],
    ['итоговая сумма', agg.totalCorrect],
  ] as const
  for (const [label, correct] of headerRows) {
    const v = pct(correct, agg.receiptCount)
    console.log(`  ${label.padEnd(18)} ${fmtPct(v)}  ${bar(v)}  ${correct}/${agg.receiptCount}`)
  }
  console.log(
    `\n  ${'все три ключевых'.padEnd(18)} ${fmtPct(g.headerAccuracy)}  ${bar(g.headerAccuracy)}  ${agg.headerFullyCorrect}/${agg.receiptCount}`,
  )

  console.log('\n  ── Позиции ─────────────────────────────────────')
  console.log(
    `  в эталоне ${agg.expectedItems}, модель вернула ${agg.matchedItems + agg.hallucinatedItems}\n`,
  )
  const itemRows = [
    ['найдено', agg.matchedItems],
    ['название точно', agg.itemNameExact],
    ['цена верна', agg.itemPriceCorrect],
    ['количество верно', agg.itemQuantityCorrect],
    ['тип строки верен', agg.itemLineTypeCorrect],
    ['категория верна', agg.itemCategoryCorrect],
  ] as const
  for (const [label, correct] of itemRows) {
    const v = pct(correct, agg.expectedItems)
    console.log(`  ${label.padEnd(18)} ${fmtPct(v)}  ${bar(v)}  ${correct}/${agg.expectedItems}`)
  }
  console.log(
    `\n  ${'название + цена'.padEnd(18)} ${fmtPct(g.itemAccuracy)}  ${bar(g.itemAccuracy)}  ${agg.itemFullyCorrect}/${agg.expectedItems}`,
  )

  console.log(`\n  пропущено позиций    ${agg.missedItems}`)
  console.log(
    `  выдумано позиций     ${agg.hallucinatedItems}` +
      (agg.hallucinatedItems > 0 ? '   ← хуже пропусков: их не заметят' : ''),
  )

  console.log('\n  ── Пороги гипотезы ─────────────────────────────')
  console.log(
    `  шапка   ≥ ${THRESHOLDS.header * 100}%   ${fmtPct(g.headerAccuracy)}   ${g.headerAccuracy >= THRESHOLDS.header * 100 ? 'проходит' : 'НЕ проходит'}`,
  )
  console.log(
    `  позиции ≥ ${THRESHOLDS.items * 100}%   ${fmtPct(g.itemAccuracy)}   ${g.itemAccuracy >= THRESHOLDS.items * 100 ? 'проходит' : 'НЕ проходит'}`,
  )

  if (agg.receiptCount < 20) {
    console.log(
      `\n  Внимание: ${agg.receiptCount} чеков — это не выборка. Цифры показывают,\n` +
        '  что конвейер работает, но не насколько он точен. Для вывода о\n' +
        '  гипотезе нужно 30–50 чеков разных магазинов.',
    )
  }
  console.log()
}

function printErrors(g: RunGroup) {
  console.log(`${'─'.repeat(78)}`)
  console.log(`  Разбор ошибок: ${g.modelTag}`)
  console.log('─'.repeat(78))

  for (const c of g.comparisons) {
    console.log(`\n  ${c.fixtureId}`)

    let clean = true
    for (const f of c.header) {
      if (f.correct) continue
      clean = false
      console.log(`    ✗ ${f.field}: ожидалось "${f.expected}", получено "${f.actual}"`)
    }

    for (const m of c.matches) {
      const problems: string[] = []
      if (!m.nameExact) problems.push(`название "${m.actual.name}" вместо "${m.expected.name}"`)
      if (!m.priceCorrect)
        problems.push(`цена ${m.actual.totalPrice} вместо ${m.expected.totalPrice}`)
      if (!m.quantityCorrect)
        problems.push(`кол-во ${m.actual.quantity} вместо ${m.expected.quantity}`)
      if (!m.lineTypeCorrect)
        problems.push(`тип ${m.actual.lineType} вместо ${m.expected.lineType}`)
      if (!m.categoryCorrect)
        problems.push(`категория ${m.actual.categorySlug} вместо ${m.expected.categorySlug}`)
      if (problems.length > 0) {
        clean = false
        console.log(`    ~ ${m.expected.name}: ${problems.join('; ')}`)
      }
    }

    for (const item of c.missed) {
      clean = false
      console.log(`    ✗ пропущено: ${item.name} (${item.totalPrice})`)
    }
    for (const item of c.hallucinated) {
      clean = false
      console.log(`    ! выдумано: ${item.name} (${item.totalPrice})`)
    }

    if (clean) console.log('    всё верно')
  }
  console.log()
}

async function appendHistory(groups: RunGroup[]) {
  const path = join(RESULTS_DIR, 'HISTORY.md')

  if (!existsSync(path)) {
    await writeFile(
      path,
      '# История замеров точности\n\n' +
        'Дописывается при каждом `pnpm score`.\n' +
        'Сравнивать имеет смысл только строки с одинаковым числом чеков.\n\n' +
        '| Дата | Модель | Вариант | Промпт | Чеков | Схема | Шапка | Найдено | Назв.+цена | Выдумано | Сек | $/чек |\n' +
        '|---|---|---|---|---|---|---|---|---|---|---|---|\n',
      'utf8',
    )
  }

  const date = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const rows = groups
    .map((g) => {
      const cost =
        g.costMicros === 0 ? '0' : `$${(g.costMicros / g.agg.receiptCount / 1_000_000).toFixed(4)}`
      return (
        `| ${date} | ${g.modelTag} | ${g.kind} | ${g.promptVersion} | ${g.agg.receiptCount} | ` +
        `${pct(g.parsedCount, g.agg.receiptCount).toFixed(0)}% | ${g.headerAccuracy.toFixed(0)}% | ` +
        `${g.itemRecall.toFixed(0)}% | ${g.itemAccuracy.toFixed(0)}% | ${g.agg.hallucinatedItems} | ` +
        `${g.avgSeconds.toFixed(1)} | ${cost} |\n`
      )
    })
    .join('')

  await appendFile(path, rows, 'utf8')
  console.log(`Записано в results/HISTORY.md: ${groups.length} строк\n`)
}

async function main() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : undefined
  }
  const kindFilter = get('--kind')
  const pick = get('--pick')
  const details = args.includes('--details')
  // Пробные запуски не должны попадать в историю: строка с непроверенным
  // эталоном выглядит как настоящий замер и сбивает сравнение по времени.
  const noHistory = args.includes('--no-history')

  const expected = await loadExpected()

  if (expected.size === 0) {
    console.error(
      '\nНет ни одной заполненной разметки. Запустите pnpm annotate и заполните файлы.\n',
    )
    process.exit(1)
  }

  let results = await listResults()
  if (kindFilter) results = results.filter((r) => r.kind === kindFilter)

  if (results.length === 0) {
    console.error('\nНет сохранённых прогонов. Запустите pnpm run\n')
    process.exit(1)
  }

  const groups = groupRuns(results, expected)

  if (groups.length === 0) {
    console.error('\nПрогоны есть, но ни один не соответствует размеченным чекам.\n')
    process.exit(1)
  }

  if (groups.length > 1) printLeaderboard(groups)

  const selected = pick ? groups.find((g) => g.modelTag === pick) : groups[0]

  if (!selected) {
    console.error(
      `\nПрогон "${pick}" не найден. Доступны: ${groups.map((g) => g.modelTag).join(', ')}\n`,
    )
    process.exit(1)
  }

  printDetail(selected)
  if (details) printErrors(selected)

  if (noHistory) console.log('Запуск с --no-history: в results/HISTORY.md ничего не записано\n')
  else await appendHistory(groups)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
