const NON_RETRYABLE_ERROR_CODES = new Set(['RECEIPT_IMAGE_INVALID', 'EXTRACTION_INVALID_RESPONSE'])

export function isRetryableProcessingError(errorCode: string): boolean {
  return !NON_RETRYABLE_ERROR_CODES.has(errorCode)
}
