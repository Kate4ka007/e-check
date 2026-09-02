import { ParsedReceiptSchema, RECEIPT_JSON_SCHEMA } from '@receipt-tracker/contracts'
import type { Env } from '../config/env.schema'
import { toImageDataUrl } from './image-data-url'
import {
  callWithFallback,
  createOpenRouterClient,
  extractJson,
  parseModelList,
} from './openrouter.client'
import { buildUserPrompt, SYSTEM_PROMPT } from './prompts'
import type { ExtractionInput, ExtractionResult, ReceiptExtractor } from './receipt-extractor'

function validateParsed(raw: unknown): {
  data: ExtractionResult['data']
  errorMessage?: string
} {
  const result = ParsedReceiptSchema.safeParse(raw)
  if (result.success) return { data: result.data }

  const issues = result.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ')

  return { data: null, errorMessage: issues }
}

export class VisionExtractor implements ReceiptExtractor {
  readonly kind = 'vision' as const
  private readonly client: ReturnType<typeof createOpenRouterClient>
  private readonly models: string[]

  constructor(private readonly env: Env) {
    this.client = createOpenRouterClient(env)
    this.models = parseModelList(env.EXTRACTOR_MODELS)
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const dataUrl = toImageDataUrl(input.imageBuffer, input.mimeType)

    try {
      const call = await callWithFallback(this.client, this.env, {
        models: this.models,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: buildUserPrompt(input.hints) },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
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
          durationMs: call.durationMs,
          costMicros: call.costMicros,
          attempts: call.attempts,
          errorCode: 'EXTRACTION_FAILED',
          errorMessage: (error as Error).message,
        }
      }

      const validated = validateParsed(raw)
      if (!validated.data) {
        return {
          ok: false,
          data: null,
          raw,
          model: call.model,
          durationMs: call.durationMs,
          costMicros: call.costMicros,
          attempts: call.attempts,
          errorCode: 'EXTRACTION_INVALID_RESPONSE',
          errorMessage: validated.errorMessage,
        }
      }

      return {
        ok: true,
        data: validated.data,
        raw,
        model: call.model,
        durationMs: call.durationMs,
        costMicros: call.costMicros,
        attempts: call.attempts,
      }
    } catch (error) {
      return {
        ok: false,
        data: null,
        raw: null,
        model: this.models[0] ?? 'unknown',
        durationMs: 0,
        costMicros: 0,
        attempts: 1,
        errorCode: 'EXTRACTION_FAILED',
        errorMessage: (error as Error).message,
      }
    }
  }
}
