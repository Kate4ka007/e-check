import * as Sentry from '@sentry/node'
import type { ErrorEvent } from '@sentry/node'
import type { Env } from '../config/env.schema'
import { getRequestId, getUserId } from './request-context'

const SENSITIVE_HEADERS = new Set(['cookie', 'authorization', 'set-cookie'])

export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent | null {
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

export function initSentry(env: Env): void {
  if (!env.SENTRY_DSN) return

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    beforeSend: sanitizeSentryEvent,
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
  })
}

export function configureRequestScope(requestId: string): void {
  if (!Sentry.isInitialized()) return
  Sentry.getCurrentScope().setTag('requestId', requestId)
}

export function captureServerException(exception: unknown): void {
  if (!Sentry.isInitialized()) return

  Sentry.withScope((scope) => {
    const requestId = getRequestId()
    if (requestId) scope.setTag('requestId', requestId)

    const userId = getUserId()
    if (userId) scope.setUser({ id: userId })

    Sentry.captureException(exception)
  })
}
