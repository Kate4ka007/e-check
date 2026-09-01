<script setup lang="ts">
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right'

export type TourStep = {
  /** CSS selector or getter for the highlighted element. Empty — card in center. */
  target?: string | (() => HTMLElement | null)
  title: string
  description?: string
  placement?: TourPlacement
}

const props = withDefaults(
  defineProps<{
    steps: TourStep[]
    /** Which step is active when the tour opens. */
    initialStep?: number
  }>(),
  { initialStep: 0 },
)

const open = defineModel<boolean>({ default: false })
const current = defineModel<number>('current', { default: 0 })

const emit = defineEmits<{
  close: []
  finish: []
}>()

const { t } = useT()

const highlight = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const cardStyle = ref<Record<string, string>>({})
const cardRef = ref<HTMLElement | null>(null)

const step = computed(() => props.steps[current.value])
const isFirst = computed(() => current.value === 0)
const isLast = computed(() => current.value === props.steps.length - 1)

function resolveTarget(): HTMLElement | null {
  const target = step.value?.target
  if (!target) return null
  if (typeof target === 'string') return document.querySelector<HTMLElement>(target)
  return target()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function layout() {
  const el = resolveTarget()
  const gap = 12
  const padding = 8
  const cardWidth = 320
  const cardHeight = cardRef.value?.offsetHeight ?? 180
  const placement = step.value?.placement ?? 'bottom'

  if (!el) {
    highlight.value = null
    cardStyle.value = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${cardWidth}px`,
    }
    return
  }

  const rect = el.getBoundingClientRect()
  highlight.value = {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }

  let top = 0
  let left = 0

  switch (placement) {
    case 'top':
      top = rect.top - gap - cardHeight
      left = rect.left + rect.width / 2 - cardWidth / 2
      break
    case 'left':
      top = rect.top + rect.height / 2 - cardHeight / 2
      left = rect.left - gap - cardWidth
      break
    case 'right':
      top = rect.top + rect.height / 2 - cardHeight / 2
      left = rect.right + gap
      break
    default:
      top = rect.bottom + gap
      left = rect.left + rect.width / 2 - cardWidth / 2
  }

  const maxLeft = window.innerWidth - cardWidth - 16
  cardStyle.value = {
    top: `${clamp(top, 16, window.innerHeight - cardHeight - 16)}px`,
    left: `${clamp(left, 16, maxLeft)}px`,
    width: `${cardWidth}px`,
  }
}

function scrollTargetIntoView() {
  const el = resolveTarget()
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'instant'
    : 'smooth'
  el?.scrollIntoView({ block: 'nearest', behavior })
}

function scheduleLayout() {
  if (!open.value) return
  requestAnimationFrame(() => {
    layout()
    requestAnimationFrame(layout)
  })
}

watch(open, (value) => {
  if (value) {
    current.value = props.initialStep
    scrollTargetIntoView()
    scheduleLayout()
    window.addEventListener('resize', scheduleLayout)
    window.addEventListener('scroll', scheduleLayout, true)
  } else {
    window.removeEventListener('resize', scheduleLayout)
    window.removeEventListener('scroll', scheduleLayout, true)
  }
})

watch(current, () => {
  scrollTargetIntoView()
  scheduleLayout()
})

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape') close()
  if (event.key === 'ArrowRight' && !isLast.value) next()
  if (event.key === 'ArrowLeft' && !isFirst.value) prev()
}

function close() {
  open.value = false
  emit('close')
}

function finish() {
  open.value = false
  emit('finish')
}

function next() {
  if (isLast.value) finish()
  else current.value++
}

function prev() {
  if (!isFirst.value) current.value--
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleLayout)
  window.removeEventListener('scroll', scheduleLayout, true)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && step"
      class="fixed inset-0 z-[2001]"
      role="dialog"
      aria-modal="true"
      :aria-label="step.title"
    >
      <div
        v-if="highlight"
        class="pointer-events-none fixed rounded-lg transition-all duration-200"
        :style="{
          top: `${highlight.top}px`,
          left: `${highlight.left}px`,
          width: `${highlight.width}px`,
          height: `${highlight.height}px`,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
        }"
      />
      <div v-else class="fixed inset-0 bg-black/55" />

      <div
        ref="cardRef"
        class="fixed z-[2002] rounded-xl border border-(--ui-border) bg-(--ui-bg) p-4 shadow-xl"
        :style="cardStyle"
      >
        <div class="mb-3 flex items-start justify-between gap-3">
          <h2 class="text-base font-semibold text-(--ui-text-highlighted)">{{ step.title }}</h2>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-x"
            :aria-label="t('common.cancel')"
            @click="close"
          />
        </div>

        <p
          v-if="step.description"
          class="text-sm leading-relaxed text-(--ui-text-muted)"
          aria-live="polite"
        >
          {{ step.description }}
        </p>

        <div class="mt-4 flex items-center justify-between gap-3">
          <span class="text-xs tabular text-(--ui-text-dimmed)" aria-live="polite">
            {{ current + 1 }} {{ t('common.of') }} {{ steps.length }}
          </span>

          <div class="flex items-center gap-2">
            <UButton
              v-if="!isFirst"
              color="neutral"
              variant="ghost"
              size="sm"
              :label="t('tour.back')"
              @click="prev"
            />
            <UButton
              color="primary"
              size="sm"
              :label="isLast ? t('tour.finish') : t('tour.next')"
              @click="next"
            />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
