import { AsyncLocalStorage } from 'node:async_hooks'

export type RequestContextStore = {
  requestId: string
  userId?: string
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>()

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId
}

export function getUserId(): string | undefined {
  return requestContext.getStore()?.userId
}

export function runWithRequestContext<T>(store: RequestContextStore, fn: () => T): T {
  return requestContext.run(store, fn)
}

export function setRequestUserId(userId: string | undefined): void {
  const store = requestContext.getStore()
  if (store) store.userId = userId
}
