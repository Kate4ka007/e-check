<script setup lang="ts">
const { t } = useT()

const links = [
  { to: '/', label: t('nav.receipts'), icon: 'i-lucide-receipt' },
]
</script>

<template>
  <div class="flex min-h-screen w-full min-w-0 flex-col bg-(--ui-bg) text-(--ui-text)">
    <header class="w-full max-w-full shrink-0 border-b border-(--ui-border)">
      <div
        class="flex w-full max-w-full items-center justify-between gap-4 px-4 py-3 lg:mx-auto lg:max-w-7xl"
      >
        <div class="flex min-w-0 items-center gap-1">
          <NuxtLink to="/" class="flex items-center gap-2 font-semibold text-(--ui-text-highlighted)">
            <UIcon name="i-lucide-receipt-text" class="size-5 shrink-0" />
            {{ t('app.title') }}
          </NuxtLink>

          <nav class="flex items-center gap-1">
            <UButton
              v-for="link in links"
              :key="link.to"
              :to="link.to"
              :label="link.label"
              :icon="link.icon"
              color="neutral"
              variant="ghost"
              size="sm"
            />
          </nav>
        </div>

        <UColorModeButton class="shrink-0" />
      </div>
    </header>

    <main class="w-full min-w-0 flex-1">
      <slot />
    </main>
  </div>
</template>
