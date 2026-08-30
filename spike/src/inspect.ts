/**
 * Показывает структуру ответов моделей, не выводя содержимое чеков.
 *
 *   pnpm inspect              форматы полей и причины отказов
 *   pnpm inspect -- --raw 001 полный ответ по одному чеку
 *
 * Нужен для отладки схемы: по сообщению «не прошёл схему» не видно,
 * что именно вернула модель.
 */
import { listResults } from './paths.js'

const out = (line: string) => process.stdout.write(line + '\n')

function shape(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'нет поля'
  if (Array.isArray(value)) return `массив[${value.length}]`
  return typeof value === 'string' ? JSON.stringify(value) : String(value)
}

async function main() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : undefined
  }
  const rawFor = get('--raw')
  const only = get('--only')?.split(',').map((s) => s.trim())

  let results = await listResults()
  if (only) results = results.filter((r) => only.includes(r.fixtureId))

  if (results.length === 0) {
    out('\nНет сохранённых прогонов.\n')
    return
  }

  if (rawFor) {
    for (const r of results.filter((x) => x.fixtureId === rawFor)) {
      out(`\n=== ${r.fixtureId} / ${r.modelTag} / ${r.kind} ===`)
      out(JSON.stringify(r.raw ?? r.data, null, 2))
    }
    return
  }

  for (const r of results.sort((a, b) => a.fixtureId.localeCompare(b.fixtureId))) {
    const raw = (r.raw ?? {}) as Record<string, unknown>
    const items = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : []
    const first = items[0]

    out(`\n${r.fixtureId}  [${r.modelTag}]  промпт ${r.promptVersion}  ${r.ok ? 'ok' : 'ОТКАЗ'}`)
    out(`  ответила: ${r.model}   режим: ${r.jsonMode}   попыток: ${r.attempts}   ${(r.durationMs / 1000).toFixed(1)}с`)

    if (r.error) out(`  причина: ${r.error.slice(0, 300)}`)

    out(`  поля шапки: ${Object.keys(raw).filter((k) => k !== 'items').join(', ') || '—'}`)
    out(`  purchasedAt=${shape(raw.purchasedAt)}  purchasedTime=${shape(raw.purchasedTime)}  currency=${shape(raw.currency)}`)
    out(`  total=${shape(raw.total)}  позиций: ${items.length}`)

    if (first) {
      out(`  поля позиции: ${Object.keys(first).join(', ')}`)

      // Форматы, а не содержимое: по ним видно, почему схема отвергла ответ
      const uniq = (key: string) =>
        [...new Set(items.map((i) => JSON.stringify(i[key])))].slice(0, 8).join(' ')

      out(`  quantity: ${uniq('quantity')}`)
      out(`  unit: ${uniq('unit')}`)
      out(`  lineType: ${uniq('lineType')}`)
      out(`  unitPrice: ${uniq('unitPrice')}`)
    }
  }

  out('')
}

main().catch((error) => {
  process.stderr.write(String(error) + '\n')
  process.exit(1)
})
