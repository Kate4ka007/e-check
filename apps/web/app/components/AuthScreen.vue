<script setup lang="ts">
const { t } = useT()
const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')
const backgroundSrc = computed(() => (isDark.value ? '/login-bg-dark.svg' : '/login-bg-light.svg'))

defineProps<{
  title: string
  subtitle: string
}>()
</script>

<template>
  <div
    class="relative flex min-h-screen items-center justify-center overflow-x-hidden overflow-y-auto px-4 py-6 text-(--ui-text) sm:py-10"
    :class="isDark ? 'bg-[#050a12]' : 'bg-[#eef3f9]'"
  >
    <img
      :src="backgroundSrc"
      alt=""
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 size-full"
    />

    <div class="absolute top-3 right-3 z-20 sm:top-4 sm:right-4">
      <UColorModeButton />
    </div>

    <div class="relative z-10 flex w-full max-w-md flex-col items-center">
      <div
        class="mb-3 flex size-11 items-center justify-center rounded-xl bg-(--ui-primary)/15 text-(--ui-primary) sm:mb-6 sm:size-14 sm:rounded-2xl"
        :class="
          isDark ? 'shadow-[0_0_32px_color-mix(in_srgb,var(--ui-primary)_45%,transparent)]' : ''
        "
      >
        <UIcon name="i-lucide-receipt-text" class="size-6 sm:size-7" />
      </div>

      <div
        class="w-full rounded-2xl border border-(--ui-border) bg-(--ui-bg-elevated)/80 p-4 shadow-2xl backdrop-blur-md sm:p-8"
      >
        <header class="mb-4 text-center sm:mb-6">
          <h1 class="text-xl font-semibold tracking-tight text-(--ui-text-highlighted) sm:text-2xl">
            {{ title }}
          </h1>
          <p class="mt-1 text-sm leading-snug text-(--ui-text-muted) sm:mt-2 sm:leading-relaxed">
            {{ subtitle }}
          </p>
        </header>

        <slot />

        <div
          class="my-4 flex items-center gap-3 sm:my-6"
          role="separator"
          :aria-label="t('auth.login.or')"
        >
          <div class="h-px flex-1 bg-(--ui-border)" />
          <span class="text-xs uppercase tracking-wide text-(--ui-text-dimmed)">
            {{ t('auth.login.or') }}
          </span>
          <div class="h-px flex-1 bg-(--ui-border)" />
        </div>

        <nav class="flex flex-col items-center gap-2 text-sm sm:gap-3">
          <slot name="links" />
        </nav>
      </div>
    </div>
  </div>
</template>
