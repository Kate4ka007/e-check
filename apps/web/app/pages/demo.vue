<script setup lang="ts">
import {
  formatMoney,
  validateReceiptSum,
  type ReceiptDetail,
  type ReceiptItem,
} from '@receipt-tracker/contracts'
import type { TourStep } from '~/components/AppTour.vue'
import { createDemoReceipt } from '~/fixtures/demoReceipt'
import { currencyOptions } from '~/utils/currencyOptions'
import { inputUi, selectUi, textareaUi } from '~/utils/formUi'

definePageMeta({
  layout: false,
})

const DEMO_TOUR_KEY = 'e-check:demo-tour-seen'

const { t } = useT()

const original = createDemoReceipt()
const draft = ref<ReceiptDetail>(structuredClone(original))

const merchantName = computed({
  get: () => draft.value.merchant?.name ?? '',
  set: (name: string) => {
    draft.value.merchant = name.trim()
      ? { id: draft.value.merchant?.id ?? 'new', name }
      : null
  },
})

type NullableTextField = 'purchasedAt' | 'purchasedTime' | 'currency' | 'note'

function nullableField(key: NullableTextField) {
  return computed<string | undefined>({
    get: () => draft.value[key] ?? undefined,
    set: (value) => {
      draft.value[key] = value?.trim() ? value : null
    },
  })
}

const purchasedAt = nullableField('purchasedAt')
const purchasedTime = nullableField('purchasedTime')
const currency = nullableField('currency')
const note = nullableField('note')

const liveValidation = computed(() =>
  validateReceiptSum(draft.value.items, draft.value.totalMinor),
)

function itemSnapshot(item: ReceiptItem) {
  return {
    id: item.id,
    name: item.name,
    lineType: item.lineType,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceMinor: item.unitPriceMinor,
    totalPriceMinor: item.totalPriceMinor,
    categoryId: item.categoryId,
  }
}

function editableSnapshot(receipt: ReceiptDetail) {
  return {
    merchant: receipt.merchant,
    purchasedAt: receipt.purchasedAt,
    purchasedTime: receipt.purchasedTime,
    currency: receipt.currency,
    totalMinor: receipt.totalMinor,
    note: receipt.note,
    items: receipt.items.map(itemSnapshot),
  }
}

const draftRevision = ref(0)
watch(draft, () => draftRevision.value++, { deep: true })

const isDirty = computed(() => {
  draftRevision.value
  return (
    JSON.stringify(editableSnapshot(draft.value)) !==
    JSON.stringify(editableSnapshot(original))
  )
})

const showImage = ref(true)
const demoNotice = ref<string | null>(null)
const saveState = ref<'idle' | 'saved'>('idle')
const confirmState = ref<'idle' | 'confirmed'>('idle')

const tourOpen = ref(false)

const tourSteps = computed<TourStep[]>(() => [
  {
    title: t('demo.tour.welcome.title'),
    description: t('demo.tour.welcome.description'),
  },
  {
    target: '[data-tour="image"]',
    title: t('demo.tour.image.title'),
    description: t('demo.tour.image.description'),
    placement: 'right',
  },
  {
    target: '[data-tour="fields"]',
    title: t('demo.tour.fields.title'),
    description: t('demo.tour.fields.description'),
    placement: 'bottom',
  },
  {
    target: '[data-tour="sum-check"]',
    title: t('demo.tour.sumCheck.title'),
    description: t('demo.tour.sumCheck.description'),
    placement: 'bottom',
  },
  {
    target: '[data-tour="items"]',
    title: t('demo.tour.items.title'),
    description: t('demo.tour.items.description'),
    placement: 'top',
  },
  {
    target: '[data-tour="actions"]',
    title: t('demo.tour.actions.title'),
    description: t('demo.tour.actions.description'),
    placement: 'top',
  },
  {
    target: '[data-tour="register"]',
    title: t('demo.tour.register.title'),
    description: t('demo.tour.register.description'),
    placement: 'bottom',
  },
])

onMounted(() => {
  if (import.meta.client && !localStorage.getItem(DEMO_TOUR_KEY)) {
    tourOpen.value = true
  }
})

function markTourSeen() {
  if (import.meta.client) localStorage.setItem(DEMO_TOUR_KEY, '1')
}

function startTour() {
  tourOpen.value = true
}

function showDemoNotice(message: string) {
  demoNotice.value = message
  setTimeout(() => {
    if (demoNotice.value === message) demoNotice.value = null
  }, 4000)
}

function save() {
  showDemoNotice(t('demo.notice.save'))
  saveState.value = 'saved'
  setTimeout(() => (saveState.value = 'idle'), 1500)
}

function confirm() {
  showDemoNotice(t('demo.notice.confirm'))
  confirmState.value = 'confirmed'
  setTimeout(() => (confirmState.value = 'idle'), 1500)
}

function discard() {
  draft.value = structuredClone(original)
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-(--ui-bg) text-(--ui-text)">
    <header class="border-b border-(--ui-border)">
      <div
        class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3"
        data-tour="welcome"
      >
        <div class="flex min-w-0 items-center gap-2">
          <UIcon name="i-lucide-receipt-text" class="size-5 shrink-0 text-(--ui-primary)" />
          <div class="min-w-0">
            <p class="truncate font-semibold text-(--ui-text-highlighted)">{{ t('app.title') }}</p>
            <p class="truncate text-xs text-(--ui-text-dimmed)">{{ t('demo.banner') }}</p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-compass"
            :label="t('demo.tour.start')"
            @click="startTour"
          />
          <UButton
            data-tour="register"
            to="/register"
            color="primary"
            size="sm"
            :label="t('demo.action.register')"
          />
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
      <header class="mb-4">
        <h1 class="text-xl font-semibold text-(--ui-text-highlighted)">
          {{ t('demo.title') }}
        </h1>
        <p class="mt-0.5 text-sm text-(--ui-text-muted)">{{ t('demo.subtitle') }}</p>
      </header>

      <UAlert
        v-if="demoNotice"
        class="mb-4"
        color="primary"
        variant="soft"
        icon="i-lucide-info"
        :title="demoNotice"
      />

      <div class="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <aside class="lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)]" data-tour="image">
          <UButton
            class="mb-2 lg:hidden"
            color="neutral"
            variant="soft"
            size="sm"
            :icon="showImage ? 'i-lucide-chevron-up' : 'i-lucide-image'"
            :label="showImage ? t('receipt.image.hide') : t('receipt.image.show')"
            @click="showImage = !showImage"
          />
          <div :class="showImage ? 'h-96 min-h-0 lg:h-full' : 'hidden lg:block lg:h-full lg:min-h-0'">
            <ReceiptImagePane :src="draft.imageUrl" />
          </div>
        </aside>

        <section class="receipt-review space-y-5">
          <div class="space-y-3" data-tour="fields">
            <FieldRow
              :label="t('receipt.field.merchant')"
              :source="draft.fieldSources.merchantName"
            >
              <UInput
                v-model="merchantName"
                :placeholder="t('receipt.field.merchantPlaceholder')"
                size="xs"
                :ui="inputUi"
                class="w-full"
              />
            </FieldRow>

            <div class="grid gap-3 sm:grid-cols-2">
              <FieldRow
                :label="t('receipt.field.purchasedAt')"
                :source="draft.fieldSources.purchasedAt"
              >
                <UInput v-model="purchasedAt" type="date" size="xs" :ui="inputUi" class="w-full tabular" />
              </FieldRow>

              <FieldRow
                :label="t('receipt.field.purchasedTime')"
                :source="draft.fieldSources.purchasedTime"
              >
                <UInput v-model="purchasedTime" type="time" size="xs" :ui="inputUi" class="w-full tabular" />
              </FieldRow>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <FieldRow
                :label="t('receipt.field.currency')"
                :source="draft.fieldSources.currency"
              >
                <USelect
                  v-model="currency"
                  :items="currencyOptions"
                  value-key="value"
                  size="xs"
                  :ui="selectUi"
                  class="w-full"
                />
              </FieldRow>

              <FieldRow :label="t('receipt.field.total')" :source="draft.fieldSources.totalMinor">
                <MoneyInput v-model="draft.totalMinor" :currency="draft.currency" />
              </FieldRow>
            </div>
          </div>

          <div data-tour="sum-check">
            <ReceiptSumCheck
              :validation="liveValidation"
              :total-minor="draft.totalMinor"
              :currency="draft.currency"
            />
          </div>

          <div data-tour="items">
            <ReceiptItemsEditor v-model="draft.items" :currency="draft.currency" />
          </div>

          <FieldRow :label="t('receipt.field.note')">
            <UTextarea
              v-model="note"
              :placeholder="t('receipt.field.notePlaceholder')"
              :rows="2"
              size="xs"
              :ui="textareaUi"
              class="w-full"
            />
          </FieldRow>

          <div
            data-tour="actions"
            class="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-(--ui-border) bg-(--ui-bg)/95 px-4 py-3 backdrop-blur"
          >
            <div class="text-sm">
              <span class="text-(--ui-text-dimmed)">{{ t('receipt.field.total') }}</span>
              <span class="tabular ml-2 text-base font-semibold text-(--ui-text-highlighted) lg:text-lg">
                {{ formatMoney(draft.totalMinor, draft.currency) }}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <UButton
                v-if="isDirty"
                color="neutral"
                variant="ghost"
                size="sm"
                :label="t('receipt.action.discard')"
                @click="discard"
              />
              <UButton
                :label="
                  saveState === 'saved' ? t('receipt.action.saved') : t('receipt.action.save')
                "
                :icon="saveState === 'saved' ? 'i-lucide-check' : undefined"
                color="neutral"
                variant="soft"
                @click="save"
              />
              <UButton
                :label="
                  confirmState === 'confirmed'
                    ? t('receipt.action.confirmed')
                    : t('receipt.action.confirm')
                "
                :icon="confirmState === 'confirmed' ? 'i-lucide-check' : undefined"
                @click="confirm"
              />
            </div>
          </div>
        </section>
      </div>
    </main>

    <AppTour
      v-model="tourOpen"
      :steps="tourSteps"
      @finish="markTourSeen"
      @close="markTourSeen"
    />
  </div>
</template>
