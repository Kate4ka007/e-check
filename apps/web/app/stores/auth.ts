import { defineStore } from 'pinia'
import type { UserProfile } from '@receipt-tracker/contracts'
import type { ApiClientError } from '~/composables/useApi'
import { messageKeyForError } from '~/utils/apiErrors'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)
  const status = ref<'idle' | 'loading' | 'authenticated' | 'guest'>('idle')
  const lastErrorKey = ref<string | null>(null)

  const api = useApi()
  const { t } = useT()

  const isAuthenticated = computed(() => status.value === 'authenticated' && !!user.value)

  async function fetchMe() {
    status.value = 'loading'
    lastErrorKey.value = null

    try {
      user.value = await api.me()
      status.value = 'authenticated'
    } catch {
      user.value = null
      status.value = 'guest'
    }
  }

  async function login(email: string, password: string) {
    status.value = 'loading'
    lastErrorKey.value = null

    try {
      user.value = await api.login(email, password)
      status.value = 'authenticated'
    } catch (error) {
      status.value = 'guest'
      lastErrorKey.value = resolveErrorKey(error)
      throw error
    }
  }

  async function register(input: {
    email: string
    password: string
    timezone: string
    baseCurrency: string
  }) {
    status.value = 'loading'
    lastErrorKey.value = null

    try {
      user.value = await api.register(input)
      status.value = 'authenticated'
    } catch (error) {
      status.value = 'guest'
      lastErrorKey.value = resolveErrorKey(error)
      throw error
    }
  }

  async function logout() {
    await api.logout().catch(() => undefined)
    user.value = null
    status.value = 'guest'
    await navigateTo('/')
  }

  function resolveErrorKey(error: unknown): string {
    const apiError = error as ApiClientError
    const code = apiError.body?.code
    return code ? t(messageKeyForError(code)) : t('auth.error.internal')
  }

  const errorMessage = computed(() => lastErrorKey.value)

  return {
    user,
    status,
    isAuthenticated,
    errorMessage,
    fetchMe,
    login,
    register,
    logout,
  }
})
