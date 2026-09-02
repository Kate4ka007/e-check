<script setup lang="ts">
import {
  ITEM_UNIT,
  LINE_TYPE,
  SYSTEM_CATEGORIES,
  formatMoney,
  type ReceiptItem,
} from '@receipt-tracker/contracts'
import { inputUi, inputUiRight, selectUi } from '~/utils/formUi'

/**
 * Редактор позиций чека.
 *
 * На широком экране — таблица. На узком — компактная карточка: название
 * в одну строку, числа в узкой сетке, категория отдельно. Растягивать
 * каждое поле на всю ширину не нужно — так карточка занимает в три
 * раза меньше места, а чек из 18 позиций всё равно проверяют с телефона.
 */
const items = defineModel<ReceiptItem[]>({ required: true })

defineProps<{ currency: string | null }>()

const { t } = useT()

const categoryOptions = computed(() =>
  SYSTEM_CATEGORIES.map((category) => ({ label: t(category.nameKey), value: category.id })),
)

const unitOptions = ITEM_UNIT.map((unit) => ({ label: t(`unit.${unit}`), value: unit }))

const lineTypeOptions = LINE_TYPE.map((lineType) => ({
  label: t(`lineType.${lineType}`),
  value: lineType,
}))

function addItem() {
  items.value = [
    ...items.value,
    {
      id: `new-${crypto.randomUUID()}`,
      position: items.value.length + 1,
      name: '',
      lineType: 'ITEM',
      quantity: '1',
      unit: 'PCS',
      unitPriceMinor: null,
      totalPriceMinor: 0,
      categoryId: 'other',
      confidence: null,
    },
  ]
}

function removeItem(id: string) {
  items.value = items.value
    .filter((item) => item.id !== id)
    .map((item, index) => ({ ...item, position: index + 1 }))
}

/** Скидки и возвраты залога визуально отличаются от обычных покупок. */
const isNegativeLine = (item: ReceiptItem) => item.totalPriceMinor < 0
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-baseline justify-between">
      <h2 class="text-sm font-medium text-(--ui-text-highlighted)">
        {{ t('receipt.items.title') }}
        <span class="ml-1 font-normal text-(--ui-text-dimmed)">{{ items.length }}</span>
      </h2>
    </div>

    <p
      v-if="items.length === 0"
      class="rounded-lg bg-(--ui-bg-elevated) px-3 py-4 text-sm text-(--ui-text-muted)"
    >
      {{ t('receipt.items.empty') }}
    </p>

    <!-- Заголовки столбцов — только на широком экране -->
    <div
      v-if="items.length > 0"
      class="hidden gap-2 px-1 text-xs text-(--ui-text-dimmed) lg:grid lg:grid-cols-[1fr_5rem_4.5rem_6rem_6rem_9rem_2rem]"
    >
      <span>{{ t('receipt.items.name') }}</span>
      <span>{{ t('receipt.items.quantity') }}</span>
      <span />
      <span class="text-right">{{ t('receipt.items.unitPrice') }}</span>
      <span class="text-right">{{ t('receipt.items.total') }}</span>
      <span>{{ t('receipt.items.category') }}</span>
      <span />
    </div>

    <ul class="space-y-2">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        class="rounded-lg border border-(--ui-border) p-2 lg:border-0 lg:p-0"
        :class="isNegativeLine(item) ? 'bg-(--ui-bg-elevated)/60 lg:bg-transparent' : ''"
      >
        <!--
          lg:contents — на широком экране обёртки «растворяются», дети
          становятся ячейками таблицы. На узком — обычные блоки карточки.
        -->
        <div class="grid gap-2 lg:grid-cols-[1fr_5rem_4.5rem_6rem_6rem_9rem_2rem] lg:items-center">
          <!-- Название + удаление -->
          <div class="col-span-full flex items-start gap-1.5 lg:contents">
            <div class="flex min-w-0 flex-1 items-center gap-1.5 lg:col-start-1">
              <UIcon
                v-if="item.confidence === 'LOW'"
                name="i-lucide-circle-alert"
                class="size-3.5 shrink-0 text-(--ui-warning)"
                :title="t('receipt.confidence.low')"
              />
              <UInput
                v-model="items[index]!.name"
                :placeholder="t('receipt.items.newName')"
                size="xs"
                :ui="inputUi"
                class="min-w-0 flex-1"
              />
            </div>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              class="mt-0.5 shrink-0 lg:col-start-7 lg:row-start-1 lg:mt-0"
              :aria-label="t('receipt.items.remove')"
              @click="removeItem(item.id)"
            />
          </div>

          <!-- Кол-во, единица, цены -->
          <div
            class="col-span-full grid grid-cols-[3.25rem_3.75rem_1fr_1fr] items-center gap-1.5 lg:contents"
          >
            <UInput
              v-model="items[index]!.quantity"
              size="xs"
              :ui="inputUiRight"
              class="tabular w-full lg:col-start-2 lg:row-start-1"
              inputmode="decimal"
              :aria-label="t('receipt.items.quantity')"
            />

            <USelect
              v-model="items[index]!.unit"
              :items="unitOptions"
              value-key="value"
              size="xs"
              :ui="selectUi"
              class="w-full lg:col-start-3 lg:row-start-1"
              :aria-label="'unit'"
            />

            <div class="min-w-0 lg:col-start-4 lg:row-start-1">
              <MoneyInput
                v-model="items[index]!.unitPriceMinor"
                :currency="currency"
                :placeholder="t('common.notSet')"
                size="xs"
              />
            </div>

            <div class="min-w-0 lg:col-start-5 lg:row-start-1">
              <MoneyInput v-model="items[index]!.totalPriceMinor" :currency="currency" size="xs" />
            </div>
          </div>

          <USelect
            :model-value="item.categoryId ?? undefined"
            :items="categoryOptions"
            value-key="value"
            size="xs"
            :ui="selectUi"
            class="col-span-full w-full min-w-0 lg:col-start-6 lg:row-start-1"
            :aria-label="t('receipt.items.category')"
            @update:model-value="items[index]!.categoryId = ($event as string) ?? null"
          />
        </div>

        <div
          v-if="item.lineType !== 'ITEM' || isNegativeLine(item)"
          class="mt-2 flex items-center gap-2 lg:mt-1"
        >
          <span class="shrink-0 text-xs text-(--ui-text-dimmed)">{{
            t('receipt.items.type')
          }}</span>
          <USelect
            v-model="items[index]!.lineType"
            :items="lineTypeOptions"
            value-key="value"
            size="xs"
            class="max-w-48"
          />
        </div>
      </li>
    </ul>

    <div class="flex items-center justify-between gap-3">
      <UButton
        icon="i-lucide-plus"
        color="neutral"
        variant="soft"
        size="sm"
        :label="t('receipt.items.add')"
        @click="addItem"
      />

      <span
        v-if="items.length > 0"
        class="tabular shrink-0 text-xs text-(--ui-text-muted) lg:text-sm"
      >
        {{
          formatMoney(
            items.reduce((sum, item) => sum + item.totalPriceMinor, 0),
            currency,
          )
        }}
      </span>
    </div>
  </div>
</template>
