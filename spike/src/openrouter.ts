import OpenAI from 'openai'
import { config } from './config.js'
import { OPENROUTER_BASE_URL } from './constants.js'

export const client = new OpenAI({
  apiKey: config.OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
  timeout: config.REQUEST_TIMEOUT_MS,
  maxRetries: 0, // перебор моделей делаем сами, чтобы он был виден в логе
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/local/receipt-tracker',
    'X-Title': 'Receipt Tracker M0 spike',
  },
})

/**
 * Способ получить от модели JSON, от самого надёжного к самому терпимому.
 *
 * Бесплатные модели поддерживают разное. json_schema гарантирует форму,
 * но доступен не у всех; json_object гарантирует валидный JSON, но не форму;
 * text не гарантирует ничего, и JSON приходится выковыривать из ответа.
 */
export type JsonMode = 'json_schema' | 'json_object' | 'text'

const JSON_MODE_ORDER: JsonMode[] = ['json_schema', 'json_object', 'text']

export interface CallResult {
  content: string
  model: string
  jsonMode: JsonMode
  attempts: number
  durationMs: number
  usage?: { promptTokens: number; completionTokens: number }
  costMicros: number
}

export class AllModelsFailedError extends Error {
  constructor(readonly failures: { model: string; reason: string }[]) {
    super(
      `Ни одна модель не ответила:\n${failures.map((f) => `  ${f.model}: ${f.reason}`).join('\n')}`,
    )
    this.name = 'AllModelsFailedError'
  }
}

interface CallOptions {
  models: string[]
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
  jsonSchema?: unknown
  maxTokens?: number
  /** Разрешить деградацию до json_object и text, если json_schema не поддержан. */
  allowJsonModeFallback?: boolean
}

/**
 * Классификация отказа. Определяет, пробовать ли следующую модель
 * и стоит ли вообще продолжать.
 */
function classify(error: unknown): { retryable: boolean; nextModel: boolean; reason: string } {
  const status = (error as { status?: number })?.status
  const message = (error as { message?: string })?.message ?? String(error)

  if (status === 401 || status === 403) {
    return { retryable: false, nextModel: false, reason: `ключ отклонён (${status})` }
  }
  if (status === 404) {
    return { retryable: true, nextModel: true, reason: 'модель недоступна (404)' }
  }
  if (status === 429) {
    return { retryable: true, nextModel: true, reason: 'лимит запросов (429)' }
  }
  if (status === 400 && /schema|response_format|json/i.test(message)) {
    return { retryable: true, nextModel: false, reason: 'режим JSON не поддержан' }
  }
  if (status !== undefined && status >= 500) {
    return { retryable: true, nextModel: true, reason: `ошибка провайдера (${status})` }
  }
  return { retryable: true, nextModel: true, reason: message.slice(0, 120) }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function callWithFallback(options: CallOptions): Promise<CallResult> {
  const { models, messages, jsonSchema, maxTokens = 8000, allowJsonModeFallback = true } = options

  if (models.length === 0) {
    throw new Error('Список моделей пуст. Заполните VISION_MODELS или TEXT_MODELS в .env')
  }

  const failures: { model: string; reason: string }[] = []
  const modes: JsonMode[] = jsonSchema
    ? allowJsonModeFallback
      ? JSON_MODE_ORDER
      : ['json_schema']
    : ['text']

  let attempts = 0

  for (const model of models) {
    for (const jsonMode of modes) {
      attempts++
      const startedAt = Date.now()

      try {
        const responseFormat =
          jsonMode === 'json_schema' && jsonSchema
            ? { type: 'json_schema' as const, json_schema: jsonSchema as never }
            : jsonMode === 'json_object'
              ? { type: 'json_object' as const }
              : undefined

        const completion = await client.chat.completions.create(
          {
            model,
            messages,
            max_tokens: maxTokens,
            temperature: 0,
            ...(responseFormat ? { response_format: responseFormat } : {}),
          },
          {
            body: {
              provider: { data_collection: config.DATA_COLLECTION },
              usage: { include: true },
            },
          } as never,
        )

        const content = completion.choices[0]?.message?.content
        if (!content) throw new Error('пустой ответ модели')

        const usage = completion.usage as
          | (OpenAI.CompletionUsage & { cost?: number })
          | undefined

        return {
          content,
          model: completion.model ?? model,
          jsonMode,
          attempts,
          durationMs: Date.now() - startedAt,
          usage: usage
            ? { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens }
            : undefined,
          costMicros: Math.round((usage?.cost ?? 0) * 1_000_000),
        }
      } catch (error) {
        const { retryable, nextModel, reason } = classify(error)
        console.warn(`    ${model} [${jsonMode}] — ${reason}`)
        failures.push({ model: `${model} [${jsonMode}]`, reason })

        if (!retryable) throw new AllModelsFailedError(failures)
        if (nextModel) break // следующая модель, менять режим JSON бессмысленно
      }
    }

    if (models.indexOf(model) < models.length - 1) await sleep(1000)
  }

  throw new AllModelsFailedError(failures)
}

/**
 * Достаёт JSON из ответа модели.
 *
 * При режиме text модель часто оборачивает JSON в ```json ... ``` или
 * добавляет пояснение до и после.
 */
export function extractJson(content: string): unknown {
  const trimmed = content.trim()

  const fenced = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n?```/)
  const candidate = fenced?.[1] ?? trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1))
    }
    throw new Error(`Ответ не содержит JSON: ${candidate.slice(0, 200)}`)
  }
}
