import {
  ReceiptProcessingResponseSchema,
  type ReceiptProcessingResponse,
} from '@receipt-tracker/contracts'

const POLL_FAST_MS = 2000
const POLL_SLOW_MS = 5000
const FAST_PHASE_MS = 20_000
const TIMEOUT_MS = 5 * 60_000

function isTerminal(status: ReceiptProcessingResponse['processingStatus']): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'SKIPPED'
}

export function useReceiptProcessing() {
  const api = useApi()
  const { t } = useT()

  function stageLabel(stage: ReceiptProcessingResponse['stage']): string | null {
    if (!stage) return null
    return t(`processing.stage.${stage}`)
  }

  function statusLabel(status: ReceiptProcessingResponse['processingStatus']): string {
    return t(`processing.${status}`)
  }

  async function pollUntilDone(receiptId: string): Promise<ReceiptProcessingResponse> {
    const startedAt = Date.now()
    let elapsed = 0

    while (elapsed < TIMEOUT_MS) {
      const response = await api.getReceiptProcessing(receiptId)
      const parsed = ReceiptProcessingResponseSchema.parse(response)

      if (isTerminal(parsed.processingStatus)) {
        return parsed
      }

      const delay = elapsed < FAST_PHASE_MS ? POLL_FAST_MS : POLL_SLOW_MS
      await new Promise((resolve) => setTimeout(resolve, delay))
      elapsed = Date.now() - startedAt
    }

    throw new Error('PROCESSING_TIMEOUT')
  }

  return {
    pollUntilDone,
    stageLabel,
    statusLabel,
  }
}
