import { describe, expect, it } from 'vitest'
import { isRetryableProcessingError } from './processing-retry'

describe('isRetryableProcessingError', () => {
  it('does not retry permanent extraction failures', () => {
    expect(isRetryableProcessingError('RECEIPT_IMAGE_INVALID')).toBe(false)
    expect(isRetryableProcessingError('EXTRACTION_INVALID_RESPONSE')).toBe(false)
  })

  it('retries transient extraction failures', () => {
    expect(isRetryableProcessingError('EXTRACTION_FAILED')).toBe(true)
  })
})
