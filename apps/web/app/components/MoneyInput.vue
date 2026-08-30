<script setup lang="ts">
import { formatMinor, parseMoneyToMinor } from '@receipt-tracker/contracts'
import { inputUiRight } from '~/utils/formUi'

/**
 * Ввод денежной суммы.
 *
 * Наружу отдаёт целые минорные единицы, внутри держит текст: пока человек
 * печатает «12,», значения ещё нет, а перерисовывать поле на каждый символ
 * значит вырывать курсор из-под пальцев. Текст приводится к числу при
 * потере фокуса.
 */
const props = withDefaults(
  defineProps<{
    modelValue: number | null
    currency: string | null
    placeholder?: string
    disabled?: boolean
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { size: 'xs' },
)

const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const text = ref('')
const focused = ref(false)

watchEffect(() => {
  if (focused.value) return
  text.value = props.modelValue === null ? '' : formatMinor(props.modelValue, props.currency)
})

function commit() {
  focused.value = false

  const trimmed = text.value.trim()
  if (trimmed === '') {
    emit('update:modelValue', null)
    return
  }

  const minor = parseMoneyToMinor(trimmed, props.currency)
  if (minor === null) {
    // Неразбираемый ввод возвращаем к последнему валидному значению,
    // а не обнуляем: обнуление молча потеряло бы сумму.
    text.value = props.modelValue === null ? '' : formatMinor(props.modelValue, props.currency)
    return
  }

  emit('update:modelValue', minor)
  text.value = formatMinor(minor, props.currency)
}
</script>

<template>
  <UInput
    v-model="text"
    :placeholder="placeholder"
    :disabled="disabled"
    :size="size"
    inputmode="decimal"
    class="tabular"
    :ui="{ ...inputUiRight, base: `${inputUiRight.base} text-right` }"
    @focus="focused = true"
    @blur="commit"
    @keydown.enter="($event.target as HTMLInputElement).blur()"
  />
</template>
