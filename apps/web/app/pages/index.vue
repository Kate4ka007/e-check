<script setup lang="ts">
import { formatMoney } from '@receipt-tracker/contracts'

/**
 * Временный список чеков — точка входа в экран проверки.
 *
 * Полноценная история с фильтрами и пагинацией появится вместе с API,
 * сейчас нужна только навигация к тому, что есть в фикстуре.
 */
const { t } = useT()
const { data: receipts, status } = useReceiptList()

const isDemo = computed(() => receipts.value?.length === 1 && receipts.value[0]?.id === 'demo')
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6">
    <h1 class="mb-4 text-lg font-semibold text-(--ui-text-highlighted) sm:text-xl">
      {{ t('nav.receipts') }}
    </h1>

    <UAlert
      v-if="isDemo"
      class="mb-4"
      color="neutral"
      variant="soft"
      icon="i-lucide-info"
      title="Синтетический образец"
      description="Настоящие чеки в репозиторий не попадают. Чтобы посмотреть экран на реальном ответе модели, выполните pnpm fixture в каталоге spike."
    />

    <div v-if="status === 'pending'" class="py-16 text-center">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-(--ui-text-muted)" />
    </div>

    <ul v-else class="space-y-2">
      <li v-for="receipt in receipts" :key="receipt.id">
        <NuxtLink
          :to="`/receipts/${receipt.id}`"
          class="flex flex-col gap-2 rounded-lg border border-(--ui-border) p-3 transition hover:border-(--ui-border-accented) hover:bg-(--ui-bg-elevated) sm:flex-row sm:items-center sm:gap-3"
        >
          <img
            v-if="receipt.thumbnailUrl"
            :src="receipt.thumbnailUrl"
            alt=""
            class="h-24 w-full rounded border border-(--ui-border) object-cover object-top sm:h-14 sm:w-11 sm:shrink-0"
          />

          <div class="min-w-0 flex-1 space-y-0.5">
            <p class="truncate text-sm font-medium text-(--ui-text-highlighted)">
              {{ receipt.merchant?.name ?? t('common.notSet') }}
            </p>
            <p class="tabular text-xs text-(--ui-text-muted)">
              {{ receipt.purchasedAt ?? t('common.notSet') }}
              <span class="mx-1 text-(--ui-text-dimmed)">·</span>
              {{ receipt.items.length }} {{ t('receipt.items.title').toLowerCase() }}
            </p>
            <p v-if="receipt._source" class="truncate text-xs text-(--ui-text-dimmed)">
              {{ receipt._source.model }} · {{ receipt._source.promptVersion }}
            </p>
          </div>

          <div class="flex items-center justify-between gap-2 sm:block sm:shrink-0 sm:text-right">
            <p class="tabular text-sm font-semibold text-(--ui-text-highlighted)">
              {{ formatMoney(receipt.totalMinor, receipt.currency) }}
            </p>
            <UIcon
              v-if="!receipt.validation.matchesTotal"
              name="i-lucide-triangle-alert"
              class="size-4 shrink-0 text-(--ui-warning)"
              title="Сумма позиций расходится с итогом"
            />
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
