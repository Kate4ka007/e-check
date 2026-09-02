<script setup lang="ts">
import { formatMoney } from '@receipt-tracker/contracts'

const { t } = useT()
const { data: receipts, status, refresh } = useReceiptList()

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 py-6">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-lg font-semibold text-(--ui-text-highlighted) sm:text-xl">
        {{ t('nav.receipts') }}
      </h1>
      <UButton to="/receipts/new" color="primary" size="sm" icon="i-lucide-plus">
        {{ t('upload.title') }}
      </UButton>
    </div>

    <div v-if="status === 'pending'" class="py-16 text-center">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-(--ui-text-muted)" />
    </div>

    <div
      v-else-if="!receipts?.length"
      class="rounded-lg border border-dashed border-(--ui-border) px-6 py-16 text-center"
    >
      <UIcon name="i-lucide-receipt" class="mx-auto mb-3 size-10 text-(--ui-text-dimmed)" />
      <p class="text-sm font-medium text-(--ui-text-highlighted)">
        {{ t('receipt.list.emptyTitle') }}
      </p>
      <p class="mt-1 text-sm text-(--ui-text-muted)">
        {{ t('receipt.list.emptyDescription') }}
      </p>
      <UButton class="mt-4" to="/receipts/new" color="primary" icon="i-lucide-camera">
        {{ t('upload.action') }}
      </UButton>
      <UButton
        class="mt-2"
        to="/receipts/new"
        color="neutral"
        variant="soft"
        icon="i-lucide-pencil-line"
      >
        {{ t('upload.createWithoutPhoto') }}
      </UButton>
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
              {{ receipt.itemCount }} {{ t('receipt.items.title').toLowerCase() }}
            </p>
          </div>

          <div class="flex items-center justify-between gap-2 sm:block sm:shrink-0 sm:text-right">
            <p class="tabular text-sm font-semibold text-(--ui-text-highlighted)">
              {{ formatMoney(receipt.totalMinor, receipt.currency) }}
            </p>
            <UBadge
              v-if="receipt.processingStatus !== 'COMPLETED' && receipt.processingStatus !== 'SKIPPED'"
              :label="t(`processing.${receipt.processingStatus}`)"
              color="neutral"
              variant="soft"
              size="xs"
              class="mt-1"
            />
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
