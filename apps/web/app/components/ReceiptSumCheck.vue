<script setup lang="ts">
import { formatMoney, type ReceiptValidation } from '@receipt-tracker/contracts'

/**
 * Сверка суммы позиций с итогом.
 *
 * Расхождение — предупреждение, а не ошибка: на реальных чеках бывают
 * округления, скидки на весь чек и строки, которые модель не разобрала.
 * Запрещать сохранение из-за этого значит заставлять человека подгонять
 * цифры под программу.
 */
const props = defineProps<{
  validation: ReceiptValidation
  totalMinor: number | null
  currency: string | null
}>()

const { t } = useT()

const state = computed(() => {
  if (props.totalMinor === null) return 'noTotal'
  return props.validation.matchesTotal ? 'ok' : 'mismatch'
})
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-sm"
    :class="
      state === 'ok'
        ? 'bg-(--ui-success)/10 text-(--ui-success)'
        : 'bg-(--ui-warning)/10 text-(--ui-warning)'
    "
  >
    <span class="flex items-center gap-1.5 font-medium">
      <UIcon
        :name="state === 'ok' ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert'"
        class="size-4"
      />
      {{
        state === 'ok'
          ? t('receipt.sum.matches')
          : state === 'noTotal'
            ? t('receipt.sum.noTotal')
            : t('receipt.sum.mismatch')
      }}
    </span>

    <span class="tabular text-(--ui-text-muted)">
      {{ t('receipt.sum.items') }}
      {{ formatMoney(validation.itemsSumMinor, currency) }}
    </span>

    <span v-if="totalMinor !== null" class="tabular text-(--ui-text-muted)">
      {{ t('receipt.sum.total') }} {{ formatMoney(totalMinor, currency) }}
    </span>

    <span v-if="state === 'mismatch'" class="tabular font-medium">
      {{ t('receipt.sum.difference') }}
      {{ formatMoney(validation.differenceMinor, currency) }}
    </span>

    <span v-if="state === 'mismatch'" class="w-full text-xs text-(--ui-text-dimmed)">
      {{ t('receipt.sum.mismatchHint') }}
    </span>
  </div>
</template>
