<script setup lang="ts">
import { currencyOptions } from '~/utils/currencyOptions'

definePageMeta({
  layout: false,
})

const { t } = useT()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const baseCurrency = ref('BYN')
const pending = ref(false)
const showPassword = ref(false)

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

const fieldUi = {
  base: 'bg-(--ui-bg)/70',
  leadingIcon: 'text-(--ui-primary)',
  trailingIcon: 'text-(--ui-primary)',
}

const selectUi = {
  base: 'w-full',
  leadingIcon: 'text-(--ui-primary)',
  trailingIcon: 'text-(--ui-primary)',
}

async function submit() {
  pending.value = true
  try {
    await auth.register({
      email: email.value,
      password: password.value,
      timezone,
      baseCurrency: baseCurrency.value,
    })
    await navigateTo('/receipts')
  } catch {
    // Ошибка уже в auth.errorMessage
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <AuthScreen :title="t('auth.register.title')" :subtitle="t('auth.register.subtitle')">
    <form class="space-y-2.5 sm:space-y-3.5" @submit.prevent="submit">
      <UFormField :label="t('auth.field.email')">
        <UInput
          v-model="email"
          type="email"
          autocomplete="email"
          required
          size="md"
          icon="i-lucide-mail"
          class="w-full"
          :ui="fieldUi"
        />
      </UFormField>

      <UFormField :label="t('auth.field.password')" :help="t('auth.field.passwordHint')">
        <UInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          required
          minlength="10"
          size="md"
          icon="i-lucide-lock"
          class="w-full"
          :ui="fieldUi"
        >
          <template #trailing>
            <button
              type="button"
              class="inline-flex text-(--ui-primary) outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-(--ui-primary)"
              :aria-label="
                showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')
              "
              @click="showPassword = !showPassword"
            >
              <UIcon :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-4" />
            </button>
          </template>
        </UInput>
      </UFormField>

      <UFormField :label="t('auth.field.baseCurrency')">
        <USelect
          v-model="baseCurrency"
          :items="currencyOptions"
          value-key="value"
          size="md"
          icon="i-lucide-wallet"
          class="w-full"
          :ui="selectUi"
        />
      </UFormField>

      <p class="text-[11px] leading-snug text-(--ui-text-dimmed) sm:text-xs">
        {{ t('auth.register.timezoneHint', { timezone }) }}
      </p>

      <UAlert v-if="auth.errorMessage" color="error" variant="soft" :title="auth.errorMessage" />

      <UButton
        type="submit"
        block
        size="md"
        color="primary"
        :loading="pending"
        :label="t('auth.register.action')"
        class="mt-1 font-semibold text-(--ui-bg) sm:mt-2"
        :ui="{ leadingIcon: 'text-(--ui-bg)' }"
      />
    </form>

    <template #links>
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-2 font-medium text-(--ui-primary) hover:underline"
      >
        <UIcon name="i-lucide-home" class="size-4 shrink-0" />
        {{ t('landing.action.back') }}
      </NuxtLink>

      <p class="text-(--ui-text-muted)">
        {{ t('auth.register.hasAccount') }}
        <NuxtLink to="/login" class="font-medium text-(--ui-primary) hover:underline">
          {{ t('auth.register.loginLink') }}
        </NuxtLink>
      </p>

      <NuxtLink
        to="/demo"
        class="inline-flex items-center gap-2 font-medium text-(--ui-primary) hover:underline"
      >
        <UIcon name="i-lucide-monitor-play" class="size-4 shrink-0" />
        {{ t('auth.register.demoLink') }}
      </NuxtLink>
    </template>
  </AuthScreen>
</template>
