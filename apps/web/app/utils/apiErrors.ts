import type { ApiErrorBody, ApiErrorCode } from '@receipt-tracker/contracts'
import type { TranslationKey } from '~/i18n/ru'

const ERROR_MESSAGES: Partial<Record<ApiErrorCode, TranslationKey>> = {
  AUTH_INVALID_CREDENTIALS: 'auth.error.invalidCredentials',
  AUTH_EMAIL_TAKEN: 'auth.error.emailTaken',
  AUTH_SESSION_EXPIRED: 'auth.error.sessionExpired',
  AUTH_SESSION_REVOKED: 'auth.error.sessionRevoked',
  AUTH_UNAUTHENTICATED: 'auth.error.unauthenticated',
  AUTH_PASSWORD_TOO_WEAK: 'auth.error.passwordTooWeak',
  AUTH_REGISTRATION_DISABLED: 'auth.error.registrationDisabled',
  RECEIPT_FILE_MISSING: 'upload.error.fileMissing',
  RECEIPT_FILE_TOO_LARGE: 'upload.error.fileTooLarge',
  RECEIPT_FILE_TYPE_UNSUPPORTED: 'upload.error.fileTypeUnsupported',
  RECEIPT_IMAGE_INVALID: 'upload.error.imageInvalid',
  IDEMPOTENCY_KEY_REUSED: 'upload.error.idempotency',
  RATE_LIMIT_EXCEEDED: 'upload.error.rateLimit',
  VALIDATION_FAILED: 'auth.error.validationFailed',
  INTERNAL_ERROR: 'auth.error.internal',
}

export function messageKeyForError(code: ApiErrorCode): TranslationKey {
  return ERROR_MESSAGES[code] ?? 'auth.error.internal'
}

export function parseApiErrorBody(payload: unknown): ApiErrorBody | null {
  if (!payload || typeof payload !== 'object') return null
  const body = payload as Record<string, unknown>
  if (typeof body.code !== 'string' || typeof body.message !== 'string') return null
  return body as ApiErrorBody
}
