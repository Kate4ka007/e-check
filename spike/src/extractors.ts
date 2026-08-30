import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { config } from './config.js'
import type { PreparedImage } from './image.js'
import { callWithFallback, extractJson } from './openrouter.js'
import {
  buildUserPrompt,
  OCR_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  TEXT_STAGE_SYSTEM_PROMPT,
} from './prompt.js'
import { ParsedReceiptSchema, RECEIPT_JSON_SCHEMA, type ParsedReceipt } from './schema.js'

export type ExtractorKind = 'vision' | 'two-stage'

export interface ExtractionHints {
  expectedCurrency?: string
  knownMerchants?: string[]
}

export interface ExtractionOutcome {
  ok: boolean
  data: ParsedReceipt | null
  /** Что вернула модель до валидации — нужно, чтобы разбирать провалы */
  raw: unknown
  /** Промежуточный текст OCR у двухэтапного варианта */
  ocrText?: string
  model: string
  jsonMode: string
  attempts: number
  durationMs: number
  costMicros: number
  error?: string
}

function validate(raw: unknown): { data: ParsedReceipt | null; error?: string } {
  const result = ParsedReceiptSchema.safeParse(raw)
  if (result.success) return { data: result.data }

  const issues = result.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
    .join('; ')

  return { data: null, error: `ответ не прошёл схему — ${issues}` }
}

/** Изображение → JSON одним вызовом. */
export async function extractVision(
  image: PreparedImage,
  models: string[],
  hints?: ExtractionHints,
): Promise<ExtractionOutcome> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        { type: 'text', text: buildUserPrompt(hints) },
        { type: 'image_url', image_url: { url: image.dataUrl } },
      ],
    },
  ]

  const call = await callWithFallback({
    models,
    messages,
    jsonSchema: RECEIPT_JSON_SCHEMA,
  })

  let raw: unknown
  try {
    raw = extractJson(call.content)
  } catch (error) {
    return {
      ok: false,
      data: null,
      raw: call.content,
      model: call.model,
      jsonMode: call.jsonMode,
      attempts: call.attempts,
      durationMs: call.durationMs,
      costMicros: call.costMicros,
      error: (error as Error).message,
    }
  }

  const { data, error } = validate(raw)

  return {
    ok: data !== null,
    data,
    raw,
    model: call.model,
    jsonMode: call.jsonMode,
    attempts: call.attempts,
    durationMs: call.durationMs,
    costMicros: call.costMicros,
    error,
  }
}

/** Изображение → текст → JSON двумя вызовами. */
export async function extractTwoStage(
  image: PreparedImage,
  models: string[],
  hints?: ExtractionHints,
): Promise<ExtractionOutcome> {
  const ocrCall = await callWithFallback({
    models,
    messages: [
      { role: 'system', content: OCR_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Прочитай весь текст с этого чека.' },
          { type: 'image_url', image_url: { url: image.dataUrl } },
        ],
      },
    ],
    maxTokens: 4000,
  })

  const ocrText = ocrCall.content

  const parseCall = await callWithFallback({
    models: config.TEXT_MODELS.length > 0 ? config.TEXT_MODELS : models,
    messages: [
      { role: 'system', content: TEXT_STAGE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${buildUserPrompt(hints)}\n\nТекст чека:\n\n${ocrText}`,
      },
    ],
    jsonSchema: RECEIPT_JSON_SCHEMA,
  })

  const totalDuration = ocrCall.durationMs + parseCall.durationMs
  const totalCost = ocrCall.costMicros + parseCall.costMicros

  let raw: unknown
  try {
    raw = extractJson(parseCall.content)
  } catch (error) {
    return {
      ok: false,
      data: null,
      raw: parseCall.content,
      ocrText,
      model: `${ocrCall.model} + ${parseCall.model}`,
      jsonMode: parseCall.jsonMode,
      attempts: ocrCall.attempts + parseCall.attempts,
      durationMs: totalDuration,
      costMicros: totalCost,
      error: (error as Error).message,
    }
  }

  const { data, error } = validate(raw)

  return {
    ok: data !== null,
    data,
    raw,
    ocrText,
    model: `${ocrCall.model} + ${parseCall.model}`,
    jsonMode: parseCall.jsonMode,
    attempts: ocrCall.attempts + parseCall.attempts,
    durationMs: totalDuration,
    costMicros: totalCost,
    error,
  }
}

export function getExtractor(kind: ExtractorKind) {
  return kind === 'vision' ? extractVision : extractTwoStage
}
