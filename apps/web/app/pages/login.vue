<script setup lang="ts">
definePageMeta({
  layout: false,
})

const { t } = useT()
const auth = useAuthStore()
const route = useRoute()

const email = ref('')
const password = ref('')
const pending = ref(false)

async function submit() {
  pending.value = true
  try {
    await auth.login(email.value, password.value)
    await navigateTo(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
  } catch {
    // Ошибка уже в auth.errorMessage
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-(--ui-bg) px-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-lg font-semibold text-(--ui-text-highlighted)">{{ t('auth.login.title') }}</h1>
        <p class="mt-1 text-sm text-(--ui-text-muted)">{{ t('auth.login.subtitle') }}</p>
      </template>

      <form class="space-y-4" @submit.prevent="submit">
        <UFormField :label="t('auth.field.email')">
          <UInput v-model="email" type="email" autocomplete="email" required class="w-full" />
        </UFormField>

        <UFormField :label="t('auth.field.password')">
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="auth.errorMessage"
          color="error"
          variant="soft"
          :title="auth.errorMessage"
        />

        <UButton type="submit" block :loading="pending" :label="t('auth.login.action')" />
      </form>

      <template #footer>
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('auth.login.noAccount') }}
          <NuxtLink to="/register" class="text-(--ui-primary) hover:underline">
            {{ t('auth.login.registerLink') }}
          </NuxtLink>
        </p>
        <p class="mt-2 text-sm text-(--ui-text-muted)">
          <NuxtLink to="/demo" class="text-(--ui-primary) hover:underline">
            {{ t('auth.login.demoLink') }}
          </NuxtLink>
        </p>
      </template>
    </UCard>
  </div>
</template>
