import * as Sentry from '@sentry/vue'

const SENSITIVE_HEADERS = new Set(['cookie', 'authorization', 'set-cookie'])

type SentryErrorEvent = Parameters<NonNullable<Sentry.BrowserOptions['beforeSend']>>[0]

export function sanitizeSentryEvent(event: SentryErrorEvent): SentryErrorEvent | null {
  if (event.request) {
    delete event.request.cookies
    delete event.request.data

    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
          delete event.request.headers[key]
        }
      }
    }
  }

  return event
}

export function attachRequestId(requestId?: string): void {
  if (!requestId || !Sentry.isInitialized()) return
  Sentry.setTag('requestId', requestId)
}

export function recordApiFailure(input: {
  status: number
  path: string
  requestId?: string
  code?: string
}): void {
  if (!Sentry.isInitialized()) return

  attachRequestId(input.requestId)

  Sentry.addBreadcrumb({
    category: 'api',
    level: input.status >= 500 ? 'error' : 'warning',
    message: `${input.status} ${input.path}`,
    data: {
      code: input.code,
      requestId: input.requestId,
    },
  })

  if (input.status >= 500) {
    Sentry.captureMessage(`API ${input.status} on ${input.path}`, 'error')
  }
}
