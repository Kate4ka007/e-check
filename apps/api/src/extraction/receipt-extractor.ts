import type { ParsedReceipt } from '@receipt-tracker/contracts'

export type ExtractorKind = 'mock' | 'vision' | 'two-stage'

export interface ExtractionHints {
  expectedCurrency?: string
  knownMerchants?: string[]
}

export interface ExtractionInput {
  imageBuffer: Buffer
  mimeType: string
  hints?: ExtractionHints
}

export interface ExtractionResult {
  ok: boolean
  data: ParsedReceipt | null
  raw: unknown
  model: string
  durationMs: number
  costMicros: number
  attempts: number
  errorCode?: 'EXTRACTION_FAILED' | 'EXTRACTION_INVALID_RESPONSE'
  errorMessage?: string
}

export interface ReceiptExtractor {
  readonly kind: ExtractorKind
  extract(input: ExtractionInput): Promise<ExtractionResult>
}
