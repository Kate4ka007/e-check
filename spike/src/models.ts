/**
 * Показывает бесплатные модели OpenRouter, доступные прямо сейчас.
 *
 * Список ротируется: работавшая вчера модель сегодня может вернуть 404.
 * Запускать перед прогоном и класть результат в VISION_MODELS.
 *
 *   pnpm models          все бесплатные модели, понимающие изображения
 *   pnpm models --text   бесплатные текстовые модели
 */
import { OPENROUTER_BASE_URL } from './constants.js'

interface ModelInfo {
  id: string
  name: string
  context_length: number | null
  architecture?: { input_modalities?: string[] }
  pricing?: { prompt?: string; completion?: string }
  supported_parameters?: string[]
}

const isFree = (m: ModelInfo) =>
  m.id.endsWith(':free') ||
  (Number(m.pricing?.prompt ?? 1) === 0 && Number(m.pricing?.completion ?? 1) === 0)

/**
 * Модели, которые формально принимают изображения, но для чтения чеков
 * непригодны: генерация звука и картинок, классификаторы безопасности,
 * эмбеддинги, распознавание речи.
 */
const UNSUITABLE =
  /lyria|veo|imagen|dall-?e|whisper|tts|音|safety|guard|moderat|embed|rerank|clip-preview/i

const isUsable = (m: ModelInfo) => !UNSUITABLE.test(m.id) && !UNSUITABLE.test(m.name)

async function main() {
  const wantText = process.argv.includes('--text')

  const response = await fetch(`${OPENROUTER_BASE_URL}/models`)
  if (!response.ok) {
    console.error(`Не удалось получить список моделей: ${response.status}`)
    process.exit(1)
  }

  const { data } = (await response.json()) as { data: ModelInfo[] }

  const matching = data
    .filter(isFree)
    .filter(isUsable)
    .filter((m) => {
      const modalities = m.architecture?.input_modalities ?? []
      return wantText ? true : modalities.includes('image')
    })
    .sort((a, b) => {
      const schemaA = a.supported_parameters?.includes('structured_outputs') ? 1 : 0
      const schemaB = b.supported_parameters?.includes('structured_outputs') ? 1 : 0
      if (schemaA !== schemaB) return schemaB - schemaA
      return (b.context_length ?? 0) - (a.context_length ?? 0)
    })

  if (matching.length === 0) {
    console.log(
      wantText
        ? 'Бесплатных текстовых моделей не найдено.'
        : 'Бесплатных моделей с поддержкой изображений сейчас нет. Попробуйте позже или используйте двухэтапный вариант.',
    )
    return
  }

  console.log(`\nБесплатные ${wantText ? 'текстовые' : 'vision'} модели (${matching.length}):\n`)

  for (const m of matching) {
    const structured = m.supported_parameters?.includes('structured_outputs') ? 'schema' : '—'
    const context = m.context_length ? `${Math.round(m.context_length / 1000)}k` : '?'
    console.log(`  ${m.id}`)
    console.log(`      контекст ${context.padEnd(6)} structured output: ${structured}`)
  }

  const recommended = matching.slice(0, 5)

  console.log('\nСтрока для .env — модели с поддержкой схемы идут первыми,')
  console.log('остальные подхватятся, если первые вернут 404 или 429:\n')
  console.log(
    `${wantText ? 'TEXT_MODELS' : 'VISION_MODELS'}=${recommended.map((m) => m.id).join(',')}\n`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
