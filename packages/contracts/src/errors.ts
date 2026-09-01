import { z } from 'zod'

/** Стабильные коды ошибок API — фронтенд реагирует на них, а не на message. */
export const AUTH_ERROR_CODES = [
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_EMAIL_TAKEN',
  'AUTH_SESSION_EXPIRED',
  'AUTH_SESSION_REVOKED',
  'AUTH_UNAUTHENTICATED',
  'AUTH_PASSWORD_TOO_WEAK',
  'AUTH_REGISTRATION_DISABLED',
] as const

export const RECEIPT_ERROR_CODES = [
  'RECEIPT_FILE_MISSING',
  'RECEIPT_FILE_TOO_LARGE',
  'RECEIPT_FILE_TYPE_UNSUPPORTED',
  'RECEIPT_IMAGE_INVALID',
  'IDEMPOTENCY_KEY_REUSED',
  'RATE_LIMIT_EXCEEDED',
] as const

export const COMMON_ERROR_CODES = ['VALIDATION_FAILED', 'INTERNAL_ERROR', 'NOT_FOUND'] as const

export const ApiErrorCodeSchema = z.enum([
  ...AUTH_ERROR_CODES,
  ...RECEIPT_ERROR_CODES,
  ...COMMON_ERROR_CODES,
])
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>

export const ApiErrorBodySchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.array(z.string())).optional(),
  requestId: z.string().uuid(),
})

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
