import { UserProfileSchema, type UserProfile } from '@receipt-tracker/contracts'
import { parseApiErrorBody } from '~/utils/apiErrors'

type ApiRequestOptions = RequestInit & {
  retryOnUnauthorized?: boolean
}

let refreshPromise: Promise<boolean> | null = null

async function refreshSession(apiBaseUrl: string): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  return response.ok
}

export function useApi() {
  const config = useRuntimeConfig()
  const apiBaseUrl = config.public.apiBaseUrl as string

  async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { retryOnUnauthorized = true, ...init } = options

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

    if (response.status === 401 && retryOnUnauthorized && !path.startsWith('/auth/')) {
      refreshPromise ??= refreshSession(apiBaseUrl).finally(() => {
        refreshPromise = null
      })

      const refreshed = await refreshPromise
      if (refreshed) {
        return request<T>(path, { ...options, retryOnUnauthorized: false })
      }
    }

    const requestId = response.headers.get('x-request-id') ?? undefined
    const payload = response.status === 204 ? null : await response.json().catch(() => null)

    if (!response.ok) {
      const errorBody = parseApiErrorBody(payload)
      throw {
        status: response.status,
        requestId: errorBody?.requestId ?? requestId,
        body: errorBody,
      }
    }

    return payload as T
  }

  return {
    apiBaseUrl,
    request,
    async login(email: string, password: string) {
      const profile = await request<unknown>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        retryOnUnauthorized: false,
      })
      return UserProfileSchema.parse(profile)
    },
    async register(input: {
      email: string
      password: string
      timezone: string
      baseCurrency: string
    }) {
      const profile = await request<unknown>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
        retryOnUnauthorized: false,
      })
      return UserProfileSchema.parse(profile)
    },
    async logout() {
      await request('/auth/logout', { method: 'POST', retryOnUnauthorized: false })
    },
    async me() {
      const profile = await request<unknown>('/auth/me', { retryOnUnauthorized: true })
      return UserProfileSchema.parse(profile)
    },
    async uploadReceipt(formData: FormData, idempotencyKey: string) {
      const config = useRuntimeConfig()
      const apiBaseUrl = config.public.apiBaseUrl as string

      const response = await fetch(`${apiBaseUrl}/receipts/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      })

      const requestId = response.headers.get('x-request-id') ?? undefined
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const errorBody = parseApiErrorBody(payload)
        throw {
          status: response.status,
          requestId: errorBody?.requestId ?? requestId,
          body: errorBody,
        } satisfies ApiClientError
      }

      return payload as {
        receiptId: string
        processingStatus: string
        duplicate: boolean
      }
    },
  }
}

export type ApiClientError = {
  status: number
  requestId?: string
  body: ReturnType<typeof parseApiErrorBody>
}

export type { UserProfile }
