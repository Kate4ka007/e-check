import type { ReceiptDetail, ReceiptListItem } from '@receipt-tracker/contracts'

/**
 * Чеки пользователя из API. Фикстуры spike больше не используются в UI.
 */
export function useReceiptList() {
  const api = useApi()

  return useAsyncData('receipts', () => api.getReceiptList(), {
    default: () => [] as ReceiptListItem[],
    transform: (response) => response.items,
  })
}

export function useReceipt(id: MaybeRefOrGetter<string>) {
  const api = useApi()

  return useAsyncData(
    () => `receipt:${toValue(id)}`,
    () => api.getReceipt(toValue(id)),
    { watch: [() => toValue(id)] },
  )
}

export type { ReceiptDetail as LoadedReceipt }
