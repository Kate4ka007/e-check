import type { ReceiptDetail } from '@receipt-tracker/contracts'
import { createDemoReceipt } from '~/fixtures/demoReceipt'

export interface ReceiptSourceInfo {
  model: string
  promptVersion: string
}

export type SourcedReceipt = ReceiptDetail & { _source?: ReceiptSourceInfo }

/**
 * Источник данных до появления бэкенда.
 *
 * Сначала пробуем локальную фикстуру из настоящих чеков — её собирает
 * `pnpm fixture` в spike/. Если её нет, показываем синтетический образец,
 * чтобы экран открывался в чистом клоне репозитория.
 *
 * Когда появится API, меняется только тело этой функции.
 */
async function loadAll(): Promise<SourcedReceipt[]> {
  try {
    const local = await $fetch<SourcedReceipt[]>('/.local/receipts.json', {
      responseType: 'json',
    })
    if (Array.isArray(local) && local.length > 0) return local
  } catch {
    // локальной фикстуры нет — это норма
  }

  return [createDemoReceipt()]
}

export function useReceiptList() {
  return useAsyncData('receipts', loadAll, { default: () => [] as SourcedReceipt[] })
}

export function useReceipt(id: MaybeRefOrGetter<string>) {
  return useAsyncData(
    () => `receipt:${toValue(id)}`,
    async () => {
      const all = await loadAll()
      return all.find((receipt) => receipt.id === toValue(id)) ?? all[0] ?? null
    },
    { watch: [() => toValue(id)] },
  )
}
