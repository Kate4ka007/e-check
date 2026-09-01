<script setup lang="ts">
import {
  CATEGORY_SLUGS,
  formatMoney,
  validateReceiptSum,
  type ReceiptDetail,
  type ReceiptPatch,
} from '@receipt-tracker/contracts'
import type { ApiClientError } from '~/composables/useApi'
import { messageKeyForError } from '~/utils/apiErrors'
import { inputUi, selectUi, textareaUi } from '~/utils/formUi'

/**
 * Экран проверки чека — ключевой экран продукта.
 *
 * Распознавание здесь считается черновиком: редактируется любое поле,
 * ничто не блокирует сохранение, а расхождения показываются как повод
 * посмотреть, а не как запрет. Тот же экран открывается пустым при
 * ручном вводе — отдельной формы для него нет.
 */
const route = useRoute()
const { t } = useT()
const api = useApi()
const { pollUntilDone, statusLabel: processingStatusLabel } = useReceiptProcessing()

const id = computed(() => String(route.params.id))
const { data: loaded, status } = useReceipt(id)

/** Рабочая копия: правки не должны трогать загруженные данные до сохранения. */
const draft = ref<ReceiptDetail | null>(null)

watch(
  loaded,
  (value) => {
    draft.value = value ? structuredClone(toRaw(value)) : null
  },
  { immediate: true },
)

const merchantName = computed({
  get: () => draft.value?.merchant?.name ?? '',
  set: (name: string) => {
    if (!draft.value) return
    draft.value.merchant = name.trim()
      ? { id: draft.value.merchant?.id ?? 'new', name }
      : null
  },
})

/**
 * Пустое значение в контракте — `null`, в полях ввода — `undefined`.
 * Расхождение сводится здесь, чтобы не рассыпать приведения по шаблону.
 */
type NullableTextField = 'purchasedAt' | 'purchasedTime' | 'currency' | 'note'

function nullableField(key: NullableTextField) {
  return computed<string | undefined>({
    get: () => draft.value?.[key] ?? undefined,
    set: (value) => {
      if (draft.value) draft.value[key] = value?.trim() ? value : null
    },
  })
}

const purchasedAt = nullableField('purchasedAt')
const purchasedTime = nullableField('purchasedTime')
const currency = nullableField('currency')
const note = nullableField('note')

/**
 * Сверка пересчитывается на лету, пока человек правит.
 *
 * Серверная validation остаётся источником истины при сохранении, но ждать
 * ответа сервера, чтобы увидеть результат своей правки, — плохой обмен.
 */
const liveValidation = computed(() =>
  draft.value
    ? validateReceiptSum(draft.value.items, draft.value.totalMinor)
    : { itemsSumMinor: 0, matchesTotal: false, differenceMinor: 0 },
)

function stripVolatile(receipt: ReceiptDetail) {
  const copy = structuredClone(toRaw(receipt))
  copy.imageUrl = null
  copy.thumbnailUrl = null
  copy.updatedAt = ''
  copy.confirmedAt = copy.confirmedAt ?? null
  return copy
}

const isDirty = computed(
  () =>
    !!draft.value &&
    !!loaded.value &&
    JSON.stringify(stripVolatile(draft.value)) !== JSON.stringify(stripVolatile(loaded.value)),
)

const currencyOptions = ['BYN', 'EUR', 'USD', 'PLN', 'RUB', 'GBP', 'CZK'].map((code) => ({
  label: code,
  value: code,
}))

const showImage = ref(true)

const saveState = ref<'idle' | 'saving' | 'saved'>('idle')
const confirmState = ref<'idle' | 'confirming' | 'confirmed'>('idle')
const reprocessState = ref<'idle' | 'running'>('idle')
const errorMessage = ref<string | null>(null)
const confirmWarnings = ref<Array<{ code: string; differenceMinor: number }>>([])

watch(id, () => {
  errorMessage.value = null
  confirmWarnings.value = []
  saveState.value = 'idle'
  confirmState.value = 'idle'
  reprocessState.value = 'idle'
})

async function reloadReceipt() {
  const refreshed = await api.getReceipt(id.value)
  draft.value = structuredClone(refreshed)
  loaded.value = refreshed
}

async function reprocess() {
  if (!draft.value || reprocessState.value === 'running') return
  if (draft.value.entryMode !== 'SCAN') return

  reprocessState.value = 'running'
  errorMessage.value = null

  try {
    await api.reprocessReceipt(id.value)
    const result = await pollUntilDone(id.value)

    if (result.processingStatus === 'COMPLETED') {
      await reloadReceipt()
      return
    }

    if (result.processingStatus === 'FAILED') {
      errorMessage.value = t('processing.failedHint')
      if (draft.value) {
        draft.value.processingStatus = 'FAILED'
        loaded.value = draft.value
      }
    }
  } catch (error) {
    const apiError = error as ApiClientError
    const code = apiError.body?.code
    errorMessage.value = code ? t(messageKeyForError(code)) : t('processing.failedHint')
  } finally {
    reprocessState.value = 'idle'
  }
}

function toPatchPayload(draft: ReceiptDetail): ReceiptPatch {
  const items = draft.items
    .filter((item) => item.name.trim().length > 0)
    .map((item) => ({
      id: item.id.startsWith('new-') ? undefined : item.id,
      name: item.name.trim(),
      lineType: item.lineType,
      quantity: item.quantity,
      unit: item.unit,
      unitPriceMinor: item.unitPriceMinor,
      totalPriceMinor: item.totalPriceMinor,
      categoryId: item.categoryId,
    }))

  return {
    merchantName: draft.merchant?.name?.trim() ? draft.merchant.name.trim() : null,
    purchasedAt: draft.purchasedAt,
    purchasedTime: draft.purchasedTime,
    currency: draft.currency,
    subtotalMinor: draft.subtotalMinor,
    taxTotalMinor: draft.taxTotalMinor,
    discountTotalMinor: draft.discountTotalMinor,
    totalMinor: draft.totalMinor,
    note: draft.note?.trim() ? draft.note.trim() : null,
    items,
  }
}

async function save(): Promise<boolean> {
  if (!draft.value) return false
  saveState.value = 'saving'
  errorMessage.value = null

  try {
    const updated = await api.patchReceipt(id.value, toPatchPayload(draft.value))
    draft.value = structuredClone(updated)
    loaded.value = updated
    saveState.value = 'saved'
    setTimeout(() => (saveState.value = 'idle'), 1500)
    return true
  } catch (error) {
    const apiError = error as ApiClientError
    const code = apiError.body?.code
    errorMessage.value = code ? t(messageKeyForError(code)) : t('receipt.error.saveFailed')
    saveState.value = 'idle'
    return false
  }
}

async function confirm() {
  if (!draft.value || confirmState.value === 'confirming') return
  confirmState.value = 'confirming'
  errorMessage.value = null
  confirmWarnings.value = []

  try {
    if (isDirty.value && !(await save())) {
      confirmState.value = 'idle'
      return
    }

    const result = await api.confirmReceipt(id.value)
    confirmWarnings.value = result.warnings

    await reloadReceipt()
    errorMessage.value = null
    confirmState.value = 'confirmed'
    setTimeout(() => (confirmState.value = 'idle'), 1500)
  } catch (error) {
    const apiError = error as ApiClientError
    const code = apiError.body?.code
    errorMessage.value = code ? t(messageKeyForError(code)) : t('receipt.error.confirmFailed')
    confirmState.value = 'idle'
  }
}

function discard() {
  draft.value = loaded.value ? structuredClone(toRaw(loaded.value)) : null
}

const unknownCategories = computed(() => {
  if (!draft.value) return []
  const known = new Set<string>(CATEGORY_SLUGS)
  return [
    ...new Set(
      draft.value.items
        .map((item) => item.categoryId)
        .filter((id): id is string => !!id && !known.has(id)),
    ),
  ]
})
</script>

<template>
  <div class="mx-auto w-full max-w-7xl px-4 py-5">
    <div v-if="status === 'pending'" class="py-20 text-center text-(--ui-text-muted)">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
    </div>

    <div v-else-if="!draft" class="py-20 text-center text-(--ui-text-muted)">
      Чек не найден
    </div>

    <template v-else>
      <header class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold text-(--ui-text-highlighted)">
            {{ t('receipt.review.title') }}
          </h1>
          <p class="mt-0.5 text-sm text-(--ui-text-muted)">
            {{
              draft.entryMode === 'MANUAL'
                ? t('receipt.review.subtitleManual')
                : t('receipt.review.subtitleScan')
            }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <UBadge :label="t(`receipt.status.${draft.status}`)" color="neutral" variant="subtle" />
          <UBadge
            :label="t(`processing.${draft.processingStatus}`)"
            :color="draft.processingStatus === 'FAILED' ? 'error' : 'neutral'"
            variant="soft"
          />
        </div>
      </header>

      <UAlert
        v-if="draft.processingStatus === 'FAILED' && draft.entryMode === 'SCAN'"
        class="mb-4"
        color="warning"
        variant="soft"
        icon="i-lucide-scan-text"
        :title="processingStatusLabel('FAILED')"
        :description="t('processing.failedHint')"
      />

      <UAlert
        v-if="errorMessage"
        class="mb-4"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :title="errorMessage"
      />

      <UAlert
        v-if="confirmWarnings.length > 0"
        class="mb-4"
        color="warning"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :title="t('receipt.confirm.warningsTitle')"
        :description="t('receipt.confirm.sumMismatch', { amount: confirmWarnings[0]?.differenceMinor ?? 0 })"
      />

      <div class="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <!-- Изображение: на узком экране сворачивается, чтобы не оттеснять поля -->
        <aside class="lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)]">
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
          <div class="space-y-3">
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
                :confidence="draft.purchasedAt ? null : 'LOW'"
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
                :confidence="draft.currency ? null : 'LOW'"
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

          <ReceiptSumCheck
            :validation="liveValidation"
            :total-minor="draft.totalMinor"
            :currency="draft.currency"
          />

          <UAlert
            v-if="unknownCategories.length > 0"
            color="warning"
            variant="soft"
            icon="i-lucide-tag"
            title="Незнакомые категории"
            :description="`Модель вернула значения вне списка: ${unknownCategories.join(', ')}`"
          />

          <ReceiptItemsEditor v-model="draft.items" :currency="draft.currency" />

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
                v-if="draft.processingStatus === 'FAILED' && draft.entryMode === 'SCAN'"
                color="primary"
                variant="soft"
                size="sm"
                icon="i-lucide-refresh-cw"
                :loading="reprocessState === 'running'"
                :disabled="reprocessState === 'running' || confirmState === 'confirming'"
                :label="t('processing.retry')"
                @click="reprocess"
              />
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
                  saveState === 'saving'
                    ? t('receipt.action.saving')
                    : saveState === 'saved'
                      ? t('receipt.action.saved')
                      : t('receipt.action.save')
                "
                :icon="saveState === 'saved' ? 'i-lucide-check' : undefined"
                :loading="saveState === 'saving'"
                :disabled="(!isDirty && saveState === 'idle') || confirmState === 'confirming'"
                color="neutral"
                variant="soft"
                @click="save"
              />
              <UButton
                v-if="draft.status === 'DRAFT'"
                :label="
                  confirmState === 'confirming'
                    ? t('receipt.action.confirming')
                    : confirmState === 'confirmed'
                      ? t('receipt.action.confirmed')
                      : t('receipt.action.confirm')
                "
                :icon="confirmState === 'confirmed' ? 'i-lucide-check' : undefined"
                :loading="confirmState === 'confirming'"
                @click="confirm"
              />
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
