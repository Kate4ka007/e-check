<script setup lang="ts">
const { t } = useT()
const auth = useAuthStore()
</script>

<template>
  <div class="flex min-h-screen w-full min-w-0 flex-col bg-(--ui-bg) text-(--ui-text)">
    <header class="w-full shrink-0 border-b border-(--ui-border)">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <NuxtLink
          to="/receipts"
          class="flex items-center gap-2 font-semibold text-(--ui-text-highlighted)"
        >
          <UIcon name="i-lucide-receipt-text" class="size-5 shrink-0 text-(--ui-primary)" />
          {{ t('app.title') }}
        </NuxtLink>

        <div class="flex shrink-0 items-center gap-1">
          <UButton
            v-if="auth.user"
            to="/receipts/new"
            color="primary"
            variant="soft"
            size="sm"
            icon="i-lucide-plus"
            :label="t('nav.add')"
          />
          <span v-if="auth.user" class="hidden truncate text-xs text-(--ui-text-dimmed) sm:block">
            {{ auth.user.email }}
          </span>
          <UButton
            v-if="auth.user"
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-log-out"
            :label="t('auth.action.logout')"
            @click="auth.logout()"
          />
          <UColorModeButton />
        </div>
      </div>
    </header>

    <main class="w-full min-w-0 flex-1">
      <slot />
    </main>
  </div>
</template>
