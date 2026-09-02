<script setup lang="ts">
import type { ConfidenceLevel, FieldSource } from '@receipt-tracker/contracts'

/**
 * Строка формы с пометками происхождения и уверенности.
 *
 * Низкая уверенность подсвечивается, но ничего не блокирует: распознавание —
 * черновик, и решение всегда за человеком. Поле, которое человек уже
 * исправил, помечается отдельно, чтобы повторное распознавание не выглядело
 * потерей правок.
 */
defineProps<{
  label: string
  confidence?: ConfidenceLevel | null
  source?: FieldSource | undefined
  hint?: string
}>()

const { t } = useT()
</script>
<template>
  <div
    class="grid grid-cols-1 gap-y-1.5 sm:grid-cols-[9rem_1fr] sm:items-center sm:gap-x-3 sm:gap-y-1"
  >
    <label class="flex items-center gap-1.5 text-xs text-(--ui-text-muted) sm:text-sm">
      {{ label }}
      <UIcon
        v-if="confidence === 'LOW'"
        name="i-lucide-circle-alert"
        class="size-3.5 text-(--ui-warning)"
        :title="t('receipt.confidence.low')"
      />
      <UIcon
        v-else-if="source === 'USER'"
        name="i-lucide-user-round-check"
        class="size-3.5 text-(--ui-text-dimmed)"
        :title="t('receipt.source.USER')"
      />
    </label>

    <div :class="confidence === 'LOW' ? 'rounded-md ring-2 ring-(--ui-warning)/30' : ''">
      <slot />
    </div>

    <p v-if="hint" class="text-xs text-(--ui-text-dimmed) sm:col-start-2">{{ hint }}</p>
  </div>
</template>
