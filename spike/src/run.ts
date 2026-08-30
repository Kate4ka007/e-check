/**
 * Прогоняет чеки из fixtures/private через выбранный вариант извлечения.
 *
 *   pnpm run                                 бесплатные модели из .env
 *   pnpm run -- --models openai/gpt-4o-mini  конкретная модель
 *   pnpm run -- --kind two-stage             двухэтапный вариант
 *   pnpm run -- --force                      игнорировать кэш
 *   pnpm run -- --only 001,002               только указанные чеки
 *
 * Результаты кэшируются в results/. Ключ кэша включает модель, вариант,
 * версию промпта и хеш изображения — повторный запуск не тратит запросы,
 * а смена любой составляющей выполняет прогон заново.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { config } from './config.js'
import { getExtractor, type ExtractorKind } from './extractors.js'
import { prepareImage } from './image.js'
import { AllModelsFailedError } from './openrouter.js'
import { listFixtures, modelTag, resultPath, type StoredResult } from './paths.js'
import { PROMPT_VERSION } from './prompt.js'

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

  const modelsArg = get('--models')

  return {
    kind,
    force: args.includes('--force'),
    yes: args.includes('--yes'),
    only: get('--only')?.split(',').map((s) => s.trim()),
    models: modelsArg?.split(',').map((s) => s.trim()).filter(Boolean),
  }
}

const isFreeModel = (id: string) => id.endsWith(':free') || id === 'openrouter/free'

async function confirmPaid(models: string[], receiptCount: number, yes: boolean) {
  const paid = models.filter((m) => !isFreeModel(m))
  if (paid.length === 0) return

  console.log(`\n  Платные модели: ${paid.join(', ')}`)
  console.log(`  Чеков в прогоне: ${receiptCount}`)
  console.log('  Фактическая стоимость будет показана после прогона.\n')

  if (yes || !process.stdin.isTTY) return

  process.stdout.write('  Продолжить? [y/N] ')
  const answer = await new Promise<string>((resolve) => {
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', (d) => resolve(String(d).trim().toLowerCase()))
  })
  process.stdin.pause()

  if (answer !== 'y' && answer !== 'yes') {
    console.log('  Отменено.\n')
    process.exit(0)
  }
  console.log()
}

async function readCached(path: string): Promise<StoredResult | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as StoredResult
  } catch {
    return null
  }
}

async function main() {
  const { kind, force, only, models: modelsOverride, yes } = parseArgs()

  const models = modelsOverride ?? config.VISION_MODELS

  if (models.length === 0) {
    console.error(
      'Не заданы модели. Либо заполните VISION_MODELS в .env (`pnpm models` подскажет),\n' +
        'либо укажите явно: pnpm run -- --models openai/gpt-4o-mini',
    )
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
  console.log(`Модели: ${models.join(', ')}`)
  if (kind === 'two-stage' && config.TEXT_MODELS.length > 0) {
    console.log(`Текстовые: ${config.TEXT_MODELS.join(', ')}`)
  }
  console.log(`Обучение на данных: ${config.DATA_COLLECTION}`)

  await confirmPaid(models, fixtures.length, yes)

  const extract = getExtractor(kind)
  const tag = modelTag(models)

  let processed = 0
  let cached = 0
  let failed = 0
  let totalDuration = 0
  let totalCost = 0

  for (const fixture of fixtures) {
    process.stdout.write(`  ${fixture.id}  `)

    const image = await prepareImage(fixture.imagePath)
    const path = resultPath(fixture.id, kind, PROMPT_VERSION, models, image.sourceSha256)

    if (!force) {
      const existing = await readCached(path)
      if (existing) {
        cached++
        console.log(`из кэша (${existing.ok ? 'ok' : 'ошибка'})`)
        continue
      }
    }

    console.log(
      `${(image.sourceBytes / 1024 / 1024).toFixed(1)}МБ → ${(image.preparedBytes / 1024).toFixed(0)}КБ, ${image.width}×${image.height}`,
    )

    const base = {
      fixtureId: fixture.id,
      kind,
      promptVersion: PROMPT_VERSION,
      modelTag: tag,
      requestedModels: models,
      sourceSha256: image.sourceSha256,
      runAt: new Date().toISOString(),
    }

    let stored: StoredResult

    try {
      const outcome = await extract(image, models)

      stored = {
        ...base,
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
        console.log(
          `      ok — ${outcome.model} [${outcome.jsonMode}], ` +
            `${outcome.data?.items.length ?? 0} позиций, ${(outcome.durationMs / 1000).toFixed(1)}с`,
        )
        processed++
      } else {
        console.log(`      не прошло: ${outcome.error}`)
        failed++
      }
    } catch (error) {
      console.log(
        error instanceof AllModelsFailedError
          ? '      все модели отказали'
          : `      ошибка: ${(error as Error).message}`,
      )

      stored = {
        ...base,
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
    if (totalCost === 0) {
      console.log('Стоимость: 0 (бесплатные модели)')
    } else {
      console.log(
        `Стоимость: $${(totalCost / 1_000_000).toFixed(4)} за ${processed} чеков ` +
          `= $${(totalCost / 1_000_000 / processed).toFixed(4)} за чек`,
      )
      console.log(
        `В пересчёте на 100 чеков в месяц: $${((totalCost / processed / 1_000_000) * 100).toFixed(2)}`,
      )
    }
  }

  console.log(`\nДальше: pnpm score${kind === 'vision' ? '' : ` -- --kind ${kind}`}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
