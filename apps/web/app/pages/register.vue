<script setup lang="ts">
definePageMeta({
  layout: false,
})

const { t } = useT()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const baseCurrency = ref('BYN')
const pending = ref(false)

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

const currencyOptions = ['BYN', 'EUR', 'USD', 'PLN', 'RUB', 'GBP', 'CZK'].map((code) => ({
  label: code,
  value: code,
}))

async function submit() {
  pending.value = true
  try {
    await auth.register({
      email: email.value,
      password: password.value,
      timezone,
      baseCurrency: baseCurrency.value,
    })
    await navigateTo('/')
  } catch {
    // Ошибка уже в auth.errorMessage
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-(--ui-bg) px-4 py-8">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-lg font-semibold text-(--ui-text-highlighted)">
          {{ t('auth.register.title') }}
        </h1>
        <p class="mt-1 text-sm text-(--ui-text-muted)">{{ t('auth.register.subtitle') }}</p>
      </template>

      <form class="space-y-4" @submit.prevent="submit">
        <UFormField :label="t('auth.field.email')">
          <UInput v-model="email" type="email" autocomplete="email" required class="w-full" />
        </UFormField>

        <UFormField :label="t('auth.field.password')" :help="t('auth.field.passwordHint')">
          <UInput
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
            minlength="10"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="t('auth.field.baseCurrency')">
          <USelect
            v-model="baseCurrency"
            :items="currencyOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <p class="text-xs text-(--ui-text-dimmed)">
          {{ t('auth.register.timezoneHint', { timezone }) }}
        </p>

        <UAlert
          v-if="auth.errorMessage"
          color="error"
          variant="soft"
          :title="auth.errorMessage"
        />

        <UButton type="submit" block :loading="pending" :label="t('auth.register.action')" />
      </form>

      <template #footer>
        <p class="text-sm text-(--ui-text-muted)">
          {{ t('auth.register.hasAccount') }}
          <NuxtLink to="/login" class="text-(--ui-primary) hover:underline">
            {{ t('auth.register.loginLink') }}
          </NuxtLink>
        </p>
      </template>
    </UCard>
  </div>
</template>
