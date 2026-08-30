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
 * Лимит вывода. У моделей с рассуждением сюда же входят токены размышления,
 * поэтому запас большой: на чеке из 18 позиций dots потратила на рассуждение
 * 28 тысяч символов и до самого ответа не добралась.
 */
const DEFAULT_MAX_TOKENS = 32_000

/**
 * Классификация отказа. Определяет, пробовать ли следующую модель
 * и стоит ли вообще продолжать.
 */
/**
 * Модель вернула ответ, но без содержимого. Причина решает, что делать
 * дальше, поэтому она отделена от сетевых ошибок.
 */
class EmptyResponseError extends Error {
  constructor(
    readonly finishReason: string,
    readonly reasoningChars: number,
  ) {
    super('пустой ответ модели')
    this.name = 'EmptyResponseError'
  }
}

function classify(error: unknown): { retryable: boolean; nextModel: boolean; reason: string } {
  const status = (error as { status?: number })?.status
  const message = (error as { message?: string })?.message ?? String(error)

  if (error instanceof EmptyResponseError) {
    // Упёрлись в лимит вывода — другой режим JSON не поможет, нужна другая модель
    if (error.finishReason === 'length') {
      return {
        retryable: true,
        nextModel: true,
        reason:
          `не хватило токенов на ответ` +
          (error.reasoningChars > 0 ? `, ${error.reasoningChars} символов ушло на рассуждение` : ''),
      }
    }
    // Иначе модель могла споткнуться о строгую схему: пробуем режим попроще
    return {
      retryable: true,
      nextModel: false,
      reason: `пустой ответ (finish_reason=${error.finishReason})`,
    }
  }

  if ((error as { name?: string })?.name === 'AbortError' || /aborted/i.test(message)) {
    return { retryable: true, nextModel: true, reason: 'превышен таймаут' }
  }
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
  const {
    models,
    messages,
    jsonSchema,
    maxTokens = DEFAULT_MAX_TOKENS,
    allowJsonModeFallback = true,
  } = options

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

        // Свой таймаут поверх SDK: одна из моделей отвечала 528 секунд,
        // и таймаут клиента этого не прервал.
        const abort = new AbortController()
        const guard = setTimeout(() => abort.abort(), config.REQUEST_TIMEOUT_MS)

        let completion: OpenAI.Chat.ChatCompletion
        try {
          // provider, usage и reasoning — расширения OpenRouter. Передаются в теле
          // запроса: поле body в options заменило бы тело целиком, а не дополнило.
          completion = await client.chat.completions.create(
            {
              model,
              messages,
              max_tokens: maxTokens,
              temperature: 0,
              ...(responseFormat ? { response_format: responseFormat } : {}),
              provider: { data_collection: config.DATA_COLLECTION },
              usage: { include: true },
              // Чтение чека — распознавание, а не рассуждение. Размышление
              // съедает лимит вывода и время, не улучшая результат.
              reasoning: { enabled: false },
            } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
            { signal: abort.signal },
          )
        } finally {
          clearTimeout(guard)
        }

        const choice = completion.choices[0]
        const content = choice?.message?.content

        if (!content) {
          const reasoning = (choice?.message as { reasoning?: string } | undefined)?.reasoning ?? ''
          throw new EmptyResponseError(choice?.finish_reason ?? 'unknown', reasoning.length)
        }

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
