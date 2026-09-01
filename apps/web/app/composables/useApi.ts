import {
  ReceiptConfirmResponseSchema,
  ReceiptDetailSchema,
  ReceiptListResponseSchema,
  ReceiptProcessingResponseSchema,
  UserProfileSchema,
  type ReceiptConfirmResponse,
  type ReceiptDetail,
  type ReceiptListResponse,
  type ReceiptPatch,
  type ReceiptProcessingResponse,
  type ReceiptReprocessResponse,
  type UserProfile,
} from '@receipt-tracker/contracts'
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
    const headers = new Headers(init.headers ?? {})
    const hasJsonBody = init.body !== undefined && init.body !== null && init.body !== ''

    if (hasJsonBody && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers,
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
    async getReceiptProcessing(receiptId: string): Promise<ReceiptProcessingResponse> {
      const payload = await request<unknown>(`/receipts/${receiptId}/processing`)
      return ReceiptProcessingResponseSchema.parse(payload)
    },
    async getReceipt(receiptId: string): Promise<ReceiptDetail> {
      const payload = await request<unknown>(`/receipts/${receiptId}`)
      return ReceiptDetailSchema.parse(payload)
    },
    async getReceiptList(): Promise<ReceiptListResponse> {
      const payload = await request<unknown>('/receipts')
      return ReceiptListResponseSchema.parse(payload)
    },
    async patchReceipt(receiptId: string, patch: ReceiptPatch): Promise<ReceiptDetail> {
      const payload = await request<unknown>(`/receipts/${receiptId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      return ReceiptDetailSchema.parse(payload)
    },
    async confirmReceipt(receiptId: string): Promise<ReceiptConfirmResponse> {
      // POST без тела ломает cookie/auth на некоторых прокси; confirm читает чек из БД по id.
      const payload = await request<unknown>(`/receipts/${receiptId}/confirm`, {
        method: 'POST',
        body: '{}',
      })
      const parsed = ReceiptConfirmResponseSchema.safeParse(payload)
      if (!parsed.success) {
        throw new Error(`Invalid confirm response: ${parsed.error.message}`)
      }
      return parsed.data
    },
    async reprocessReceipt(receiptId: string): Promise<ReceiptReprocessResponse> {
      return request<ReceiptReprocessResponse>(`/receipts/${receiptId}/reprocess`, {
        method: 'POST',
        body: '{}',
      })
    },
  }
}

export type ApiClientError = {
  status: number
  requestId?: string
  body: ReturnType<typeof parseApiErrorBody>
}

export type { UserProfile }
