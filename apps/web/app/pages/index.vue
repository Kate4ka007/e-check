<script setup lang="ts">
definePageMeta({
  layout: false,
})

const colorMode = useColorMode()

if (colorMode.preference !== 'light') {
  colorMode.preference = 'dark'
}

const { t } = useT()

const features = [
  {
    icon: 'i-lucide-scan-line',
    titleKey: 'landing.feature.scan.title' as const,
    descriptionKey: 'landing.feature.scan.description' as const,
  },
  {
    icon: 'i-lucide-calculator',
    titleKey: 'landing.feature.review.title' as const,
    descriptionKey: 'landing.feature.review.description' as const,
  },
  {
    icon: 'i-lucide-list-checks',
    titleKey: 'landing.feature.track.title' as const,
    descriptionKey: 'landing.feature.track.description' as const,
  },
  {
    icon: 'i-lucide-wallet',
    titleKey: 'landing.feature.analytics.title' as const,
    descriptionKey: 'landing.feature.analytics.description' as const,
  },
  {
    icon: 'i-lucide-chart-column',
    titleKey: 'landing.feature.charts.title' as const,
    descriptionKey: 'landing.feature.charts.description' as const,
  },
  {
    icon: 'i-lucide-tags',
    titleKey: 'landing.feature.categories.title' as const,
    descriptionKey: 'landing.feature.categories.description' as const,
  },
]
</script>

<template>
  <div class="flex min-h-screen flex-col bg-(--ui-bg) text-(--ui-text)">
    <header class="border-b border-(--ui-border)">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div class="flex items-center gap-2 font-semibold text-(--ui-text-highlighted)">
          <UIcon name="i-lucide-receipt-text" class="size-5 shrink-0 text-(--ui-primary)" />
          {{ t('app.title') }}
        </div>

        <UColorModeButton />
      </div>
    </header>

    <main class="flex-1">
      <section class="relative overflow-hidden px-4 py-16 sm:py-24 lg:py-28">
        <div
          class="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--ui-primary)_18%,transparent),transparent_70%)]"
          aria-hidden="true"
        />

        <div class="relative mx-auto max-w-3xl text-center">
          <div
            class="mx-auto inline-flex items-center gap-2 rounded-full border border-(--ui-primary)/35 bg-(--ui-primary)/10 px-4 py-1.5 text-sm font-medium text-(--ui-primary)"
          >
            <UIcon name="i-lucide-receipt-text" class="size-4 shrink-0" />
            {{ t('landing.eyebrow') }}
          </div>

          <h1
            class="mt-8 text-4xl font-bold leading-[1.15] tracking-tight text-(--ui-text-highlighted) sm:text-5xl lg:text-[3.5rem]"
          >
            {{ t('landing.titleLine1') }}
            <br />
            {{ t('landing.titleLine2') }}
            <span class="relative inline-block whitespace-nowrap pb-[0.22em]">
              {{ t('landing.titleHighlight') }}
              <svg
                class="pointer-events-none absolute top-[1.1em] left-[-3%] h-[0.34em] w-[106%] text-(--ui-primary)"
                viewBox="0 0 952 73"
                fill="none"
                aria-hidden="true"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient
                    id="landing-title-underline"
                    x1="0"
                    y1="0"
                    x2="952"
                    y2="0"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stop-color="currentColor" stop-opacity="0.35" />
                    <stop offset="10%" stop-color="currentColor" stop-opacity="0.95" />
                    <stop offset="50%" stop-color="currentColor" stop-opacity="1" />
                    <stop offset="90%" stop-color="currentColor" stop-opacity="0.9" />
                    <stop offset="100%" stop-color="currentColor" stop-opacity="0.25" />
                  </linearGradient>
                </defs>
                <path
                  d="M4 66 L17 54 30 50 43 47 56 45 69 42 82 40 95 38 108 36 121 34 134 33 147 31 160 30 173 28 186 27 199 25 212 24 225 23 238 21 251 20 264 19 277 18 290 17 303 16 316 15 329 14 342 13 355 12 368 11 381 10 394 10 407 9 420 9 433 8 446 8 459 7 472 7 485 6 498 6 511 5 524 5 537 5 550 5 563 5 576 4 589 4 602 4 615 4 628 5 641 5 654 5 667 5 680 6 693 6 706 6 719 7 732 7 745 8 758 9 771 9 784 10 797 11 810 12 823 13 836 14 849 16 862 17 875 19 888 21 901 23 914 26 927 29 940 33 940 40 927 48 914 47 901 46 888 45 875 44 862 43 849 42 836 41 823 40 810 39 797 38 784 37 771 36 758 35 745 35 732 34 719 33 706 33 693 32 680 31 667 31 654 31 641 30 628 30 615 30 602 30 589 29 576 29 563 29 550 29 537 30 524 30 511 30 498 30 485 30 472 31 459 31 446 31 433 32 420 32 407 33 394 33 381 34 368 35 355 35 342 36 329 37 316 38 303 38 290 39 277 40 264 41 251 42 238 43 225 44 212 45 199 47 186 48 173 49 160 51 147 52 134 54 121 55 108 57 95 59 82 60 69 62 56 64 43 66 30 67 17 68 Z"
                  fill="url(#landing-title-underline)"
                />
              </svg>
            </span>
          </h1>

          <p
            class="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-(--ui-text-muted) sm:text-lg sm:leading-8"
          >
            {{ t('landing.subtitleLine1') }}
            <br />
            {{ t('landing.subtitleLine2') }}
          </p>

          <div
            class="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
          >
            <UButton
              to="/demo"
              color="primary"
              size="xl"
              icon="i-lucide-camera"
              :label="t('landing.action.demo')"
              class="min-w-56 justify-center font-semibold text-(--ui-bg)"
              :ui="{ leadingIcon: 'text-(--ui-bg)' }"
            />
            <UButton
              to="/register"
              color="neutral"
              variant="outline"
              size="xl"
              icon="i-lucide-user-plus"
              :label="t('landing.action.register')"
              class="min-w-56 justify-center border-(--ui-border-accented) font-medium"
            />
          </div>

          <p class="mt-6 text-sm text-(--ui-text-dimmed)">
            {{ t('landing.hasAccount') }}
            <NuxtLink to="/login" class="font-medium text-(--ui-primary) hover:underline">
              {{ t('landing.action.login') }}
            </NuxtLink>
          </p>
        </div>
      </section>

      <section class="border-t border-(--ui-border) bg-(--ui-bg-elevated)/50">
        <div class="mx-auto max-w-5xl px-4 py-12">
          <h2 class="mb-6 text-center text-lg font-semibold text-(--ui-text-highlighted)">
            {{ t('landing.features.title') }}
          </h2>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="feature in features"
              :key="feature.titleKey"
              class="rounded-xl border border-(--ui-border) bg-(--ui-bg) p-5"
            >
              <UIcon :name="feature.icon" class="mb-3 size-6 text-(--ui-primary)" />
              <h3 class="text-base font-semibold text-(--ui-text-highlighted)">
                {{ t(feature.titleKey) }}
              </h3>
              <p class="mt-2 text-sm leading-relaxed text-(--ui-text-muted)">
                {{ t(feature.descriptionKey) }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="mx-auto max-w-xl px-4 py-12 text-center">
        <h2 class="text-xl font-semibold text-(--ui-text-highlighted)">
          {{ t('landing.cta.title') }}
        </h2>
        <p class="mx-auto mt-2 text-sm leading-relaxed text-(--ui-text-muted)">
          {{ t('landing.cta.description') }}
        </p>
        <UButton
          class="mt-6"
          to="/register"
          color="primary"
          size="lg"
          icon="i-lucide-arrow-right"
          :label="t('landing.action.registerFree')"
        />
      </section>
    </main>

    <footer class="border-t border-(--ui-border) py-6 text-center text-xs text-(--ui-text-dimmed)">
      {{ t('landing.footer') }}
    </footer>
  </div>
</template>
