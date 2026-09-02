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
const showPassword = ref(false)

const fieldUi = {
  base: 'bg-(--ui-bg)/70',
  leadingIcon: 'text-(--ui-primary)',
  trailingIcon: 'text-(--ui-primary)',
}

async function submit() {
  pending.value = true
  try {
    await auth.login(email.value, password.value)
    await navigateTo(typeof route.query.redirect === 'string' ? route.query.redirect : '/receipts')
  } catch {
    // Ошибка уже в auth.errorMessage
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <AuthScreen :title="t('auth.login.title')" :subtitle="t('auth.login.subtitle')">
    <form class="space-y-4" @submit.prevent="submit">
      <UFormField :label="t('auth.field.email')">
        <UInput
          v-model="email"
          type="email"
          autocomplete="email"
          required
          size="lg"
          icon="i-lucide-mail"
          class="w-full"
          :ui="fieldUi"
        />
      </UFormField>

      <UFormField :label="t('auth.field.password')">
        <UInput
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          required
          size="lg"
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
              <UIcon :name="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" class="size-5" />
            </button>
          </template>
        </UInput>
      </UFormField>

      <UAlert v-if="auth.errorMessage" color="error" variant="soft" :title="auth.errorMessage" />

      <UButton
        type="submit"
        block
        size="lg"
        color="primary"
        :loading="pending"
        :label="t('auth.login.action')"
        class="mt-2 font-semibold text-(--ui-bg)"
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
        {{ t('auth.login.noAccount') }}
        <NuxtLink to="/register" class="font-medium text-(--ui-primary) hover:underline">
          {{ t('auth.login.registerLink') }}
        </NuxtLink>
      </p>

      <NuxtLink
        to="/demo"
        class="inline-flex items-center gap-2 font-medium text-(--ui-primary) hover:underline"
      >
        <UIcon name="i-lucide-monitor-play" class="size-4 shrink-0" />
        {{ t('auth.login.demoLink') }}
      </NuxtLink>
    </template>
  </AuthScreen>
</template>
