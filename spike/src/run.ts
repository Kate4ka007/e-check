/**
 * Прогоняет чеки из fixtures/private через выбранный вариант извлечения.
 *
 *   pnpm run                        вариант vision
 *   pnpm run -- --kind two-stage    двухэтапный вариант
 *   pnpm run -- --force             игнорировать кэш
 *   pnpm run -- --only 001,002      только указанные чеки
 *
 * Результаты кэшируются в results/. Повторный запуск без --force не тратит
 * запросы к провайдеру — при лимите 50 в день это существенно.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { config } from './config.js'
import { getExtractor, type ExtractorKind } from './extractors.js'
import { prepareImage } from './image.js'
import { AllModelsFailedError } from './openrouter.js'
import { listFixtures, resultPath } from './paths.js'
import { PROMPT_VERSION } from './prompt.js'

interface StoredResult {
  fixtureId: string
  kind: ExtractorKind
  promptVersion: string
  sourceSha256: string
  runAt: string
  ok: boolean
  model: string
  jsonMode: string
  attempts: number
  durationMs: number
  costMicros: number
  error?: string
  data: unknown
  raw: unknown
  ocrText?: string
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : undefined
  }
  const kind = (get('--kind') ?? 'vision') as ExtractorKind
  if (kind !== 'vision' && kind !== 'two-stage') {
    console.error(`Неизвестный вариант: ${kind}. Допустимо: vision, two-stage`)
    process.exit(1)
  }
  return {
    kind,
    force: args.includes('--force'),
    only: get('--only')?.split(',').map((s) => s.trim()),
  }
}

async function readCached(path: string): Promise<StoredResult | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as StoredResult
  } catch {
    return null
  }
}

async function main() {
  const { kind, force, only } = parseArgs()

  if (config.VISION_MODELS.length === 0) {
    console.error('VISION_MODELS пуст. Запустите `pnpm models`, выберите модели и впишите в .env')
    process.exit(1)
  }

  let fixtures = await listFixtures()
  if (only) fixtures = fixtures.filter((f) => only.includes(f.id))

  if (fixtures.length === 0) {
    console.error(
      'Не найдено ни одного изображения в spike/fixtures/private/\n' +
        'Положите туда фотографии чеков: 001.jpg, 002.jpg, ...',
    )
    process.exit(1)
  }

  console.log(`\nВариант: ${kind}   промпт: ${PROMPT_VERSION}   чеков: ${fixtures.length}`)
  console.log(`Модели: ${config.VISION_MODELS.join(', ')}`)
  if (kind === 'two-stage' && config.TEXT_MODELS.length > 0) {
    console.log(`Текстовые: ${config.TEXT_MODELS.join(', ')}`)
  }
  console.log(`Обучение на данных: ${config.DATA_COLLECTION}\n`)

  const extract = getExtractor(kind)
  let processed = 0
  let cached = 0
  let failed = 0
  let totalDuration = 0
  let totalCost = 0

  for (const fixture of fixtures) {
    process.stdout.write(`  ${fixture.id}  `)

    const image = await prepareImage(fixture.imagePath)
    const path = resultPath(fixture.id, kind, PROMPT_VERSION, image.sourceSha256)

    if (!force) {
      const existing = await readCached(path)
      if (existing) {
        cached++
        console.log(`из кэша (${existing.ok ? 'ok' : 'ошибка'})`)
        continue
      }
    }

    const sizeInfo = `${(image.sourceBytes / 1024 / 1024).toFixed(1)}МБ → ${(image.preparedBytes / 1024).toFixed(0)}КБ, ${image.width}×${image.height}`
    process.stdout.write(`${sizeInfo}\n`)

    let stored: StoredResult

    try {
      const outcome = await extract(image)

      stored = {
        fixtureId: fixture.id,
        kind,
        promptVersion: PROMPT_VERSION,
        sourceSha256: image.sourceSha256,
        runAt: new Date().toISOString(),
        ok: outcome.ok,
        model: outcome.model,
        jsonMode: outcome.jsonMode,
        attempts: outcome.attempts,
        durationMs: outcome.durationMs,
        costMicros: outcome.costMicros,
        error: outcome.error,
        data: outcome.data,
        raw: outcome.raw,
        ocrText: outcome.ocrText,
      }

      totalDuration += outcome.durationMs
      totalCost += outcome.costMicros

      if (outcome.ok) {
        const itemCount = outcome.data?.items.length ?? 0
        console.log(
          `      ok — ${outcome.model} [${outcome.jsonMode}], ${itemCount} позиций, ${(outcome.durationMs / 1000).toFixed(1)}с`,
        )
        processed++
      } else {
        console.log(`      не прошло: ${outcome.error}`)
        failed++
      }
    } catch (error) {
      if (error instanceof AllModelsFailedError) {
        console.log(`      все модели отказали`)
      } else {
        console.log(`      ошибка: ${(error as Error).message}`)
      }

      stored = {
        fixtureId: fixture.id,
        kind,
        promptVersion: PROMPT_VERSION,
        sourceSha256: image.sourceSha256,
        runAt: new Date().toISOString(),
        ok: false,
        model: '—',
        jsonMode: '—',
        attempts: 0,
        durationMs: 0,
        costMicros: 0,
        error: (error as Error).message,
        data: null,
        raw: null,
      }
      failed++
    }

    await writeFile(path, JSON.stringify(stored, null, 2), 'utf8')
  }

  console.log(`\nГотово: ${processed} успешно, ${failed} с ошибкой, ${cached} из кэша`)
  if (processed > 0) {
    console.log(`Среднее время: ${(totalDuration / processed / 1000).toFixed(1)}с на чек`)
    console.log(
      `Стоимость: ${totalCost === 0 ? '0 (бесплатные модели)' : `$${(totalCost / 1_000_000).toFixed(4)}`}`,
    )
  }
  console.log(`\nДальше: pnpm score${kind === 'vision' ? '' : ` -- --kind ${kind}`}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
