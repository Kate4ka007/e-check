<script setup lang="ts">
/**
 * Изображение чека с зумом и поворотом.
 *
 * Без зума экран бесполезен: мелкий шрифт на фотографии — ровно то, что
 * человек приходит сюда перепроверить. Поворот нужен, потому что EXIF
 * не всегда верен, а чек, снятый боком, читать невозможно.
 */
const props = defineProps<{ src: string | null }>()

const { t } = useT()

const viewportRef = ref<HTMLElement | null>(null)
const scale = ref(1)
const rotation = ref(0)
const isPanning = ref(false)

const MIN_SCALE = 0.5
const MAX_SCALE = 5

let panStartX = 0
let panStartY = 0
let panScrollLeft = 0
let panScrollTop = 0

const clamp = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

function zoom(delta: number) {
  scale.value = clamp(Number((scale.value + delta).toFixed(2)))
}

function rotate() {
  rotation.value = (rotation.value + 90) % 360
}

function resetScroll() {
  const el = viewportRef.value
  if (!el) return
  el.scrollLeft = 0
  el.scrollTop = 0
}

function reset() {
  scale.value = 1
  rotation.value = 0
  resetScroll()
}

function onWheel(event: WheelEvent) {
  // Колесо масштабирует только с Ctrl: иначе страница перестаёт скроллиться
  if (!event.ctrlKey) return
  event.preventDefault()
  zoom(event.deltaY > 0 ? -0.2 : 0.2)
}

function onPanStart(event: MouseEvent) {
  if (!props.src || event.button !== 0) return

  const el = viewportRef.value
  if (!el) return

  isPanning.value = true
  panStartX = event.clientX
  panStartY = event.clientY
  panScrollLeft = el.scrollLeft
  panScrollTop = el.scrollTop

  event.preventDefault()

  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', onPanEnd)
}

function onPanMove(event: MouseEvent) {
  if (!isPanning.value) return

  const el = viewportRef.value
  if (!el) return

  el.scrollLeft = panScrollLeft - (event.clientX - panStartX)
  el.scrollTop = panScrollTop - (event.clientY - panStartY)
}

function onPanEnd() {
  isPanning.value = false
  document.removeEventListener('mousemove', onPanMove)
  document.removeEventListener('mouseup', onPanEnd)
}

onBeforeUnmount(onPanEnd)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <div class="flex shrink-0 items-center gap-1">
      <UButton
        icon="i-lucide-zoom-out"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="t('receipt.image.zoomOut')"
        :disabled="!src || scale <= MIN_SCALE"
        @click="zoom(-0.25)"
      />
      <span class="tabular w-12 text-center text-xs text-(--ui-text-dimmed)">
        {{ Math.round(scale * 100) }}%
      </span>
      <UButton
        icon="i-lucide-zoom-in"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="t('receipt.image.zoomIn')"
        :disabled="!src || scale >= MAX_SCALE"
        @click="zoom(0.25)"
      />
      <UButton
        icon="i-lucide-rotate-cw"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="t('receipt.image.rotate')"
        :disabled="!src"
        @click="rotate"
      />
      <UButton
        icon="i-lucide-undo-2"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="t('receipt.image.reset')"
        :disabled="!src || (scale === 1 && rotation === 0)"
        @click="reset"
      />
    </div>

    <div
      ref="viewportRef"
      class="receipt-image-viewport relative min-h-0 flex-1 overflow-auto overscroll-contain rounded-lg border border-(--ui-border) bg-(--ui-bg-elevated)"
      :class="src && (isPanning ? 'cursor-grabbing select-none' : 'cursor-grab')"
      @mousedown="onPanStart"
      @wheel="onWheel"
    >
      <div v-if="!src" class="flex h-full min-h-64 items-center justify-center">
        <p class="text-sm text-(--ui-text-dimmed)">{{ t('receipt.image.missing') }}</p>
      </div>

      <div v-else class="flex min-h-full w-full justify-center p-3">
        <img
          :src="src"
          alt=""
          draggable="false"
          class="block h-auto max-w-full object-contain"
          :style="{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'top center',
          }"
          @dragstart.prevent
        />
      </div>
    </div>
  </div>
</template>
