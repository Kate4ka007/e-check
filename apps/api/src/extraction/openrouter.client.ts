import OpenAI from 'openai'
import type { Env } from '../config/env.schema'

export type JsonMode = 'json_schema' | 'json_object' | 'text'

const JSON_MODE_ORDER: JsonMode[] = ['json_schema', 'json_object', 'text']
const DEFAULT_MAX_TOKENS = 32_000

export interface CallResult {
  content: string
  model: string
  jsonMode: JsonMode
  attempts: number
  durationMs: number
  costMicros: number
}

export class AllModelsFailedError extends Error {
  constructor(readonly failures: { model: string; reason: string }[]) {
    super(`All models failed:\n${failures.map((f) => `  ${f.model}: ${f.reason}`).join('\n')}`)
    this.name = 'AllModelsFailedError'
  }
}

class EmptyResponseError extends Error {
  constructor(
    readonly finishReason: string,
    readonly reasoningChars: number,
  ) {
    super('empty model response')
    this.name = 'EmptyResponseError'
  }
}

function classify(error: unknown): { retryable: boolean; nextModel: boolean; reason: string } {
  const status = (error as { status?: number })?.status
  const message = (error as { message?: string })?.message ?? String(error)

  if (error instanceof EmptyResponseError) {
    if (error.finishReason === 'length') {
      return { retryable: true, nextModel: true, reason: 'output token limit reached' }
    }
    return { retryable: true, nextModel: false, reason: `empty response (${error.finishReason})` }
  }

  if ((error as { name?: string })?.name === 'AbortError' || /aborted/i.test(message)) {
    return { retryable: true, nextModel: true, reason: 'timeout' }
  }
  if (status === 401 || status === 403) {
    return { retryable: false, nextModel: false, reason: `auth rejected (${status})` }
  }
  if (status === 404) {
    return { retryable: true, nextModel: true, reason: 'model unavailable (404)' }
  }
  if (status === 429) {
    return { retryable: true, nextModel: true, reason: 'rate limited (429)' }
  }
  if (status === 400 && /schema|response_format|json/i.test(message)) {
    return { retryable: true, nextModel: false, reason: 'json mode unsupported' }
  }
  if (status !== undefined && status >= 500) {
    return { retryable: true, nextModel: true, reason: `provider error (${status})` }
  }
  return { retryable: true, nextModel: true, reason: message.slice(0, 120) }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function parseModelList(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function createOpenRouterClient(env: Env): OpenAI {
  return new OpenAI({
    apiKey: env.EXTRACTOR_API_KEY,
    baseURL: env.EXTRACTOR_BASE_URL,
    timeout: env.EXTRACTOR_TIMEOUT_MS,
    maxRetries: 0,
    defaultHeaders: {
      'HTTP-Referer': env.APP_URL,
      'X-Title': 'Receipt Tracker',
    },
  })
}

export async function callWithFallback(
  client: OpenAI,
  env: Env,
  options: {
    models: string[]
    messages: OpenAI.Chat.ChatCompletionMessageParam[]
    jsonSchema?: unknown
    maxTokens?: number
    allowJsonModeFallback?: boolean
  },
): Promise<CallResult> {
  const {
    models,
    messages,
    jsonSchema,
    maxTokens = DEFAULT_MAX_TOKENS,
    allowJsonModeFallback = true,
  } = options

  if (models.length === 0) {
    throw new Error('EXTRACTOR_MODELS is empty')
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

        const abort = new AbortController()
        const guard = setTimeout(() => abort.abort(), env.EXTRACTOR_TIMEOUT_MS)

        let completion: OpenAI.Chat.ChatCompletion
        try {
          completion = await client.chat.completions.create(
            {
              model,
              messages,
              max_tokens: maxTokens,
              temperature: 0,
              ...(responseFormat ? { response_format: responseFormat } : {}),
              provider: { data_collection: env.EXTRACTOR_DATA_COLLECTION },
              usage: { include: true },
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

        const usage = completion.usage as (OpenAI.CompletionUsage & { cost?: number }) | undefined

        return {
          content,
          model: completion.model ?? model,
          jsonMode,
          attempts,
          durationMs: Date.now() - startedAt,
          costMicros: Math.round((usage?.cost ?? 0) * 1_000_000),
        }
      } catch (error) {
        const { retryable, nextModel, reason } = classify(error)
        failures.push({ model: `${model} [${jsonMode}]`, reason })

        if (!retryable) throw new AllModelsFailedError(failures)
        if (nextModel) break
      }
    }

    if (models.indexOf(model) < models.length - 1) await sleep(1000)
  }

  throw new AllModelsFailedError(failures)
}

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
    throw new Error(`Response is not JSON: ${candidate.slice(0, 200)}`)
  }
}
