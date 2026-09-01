import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))
const contractsEntry = resolve(rootDir, '../../packages/contracts/src/index.ts')

export default defineNuxtConfig({
  compatibilityDate: '2026-08-30',

  // Приложение целиком за логином: индексировать нечего, первый экран
  // всё равно рисуется после проверки сессии. См. ADR-0008.
  ssr: false,

  modules: ['@nuxt/ui', '@pinia/nuxt'],

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1',
      sentryDsn: process.env.NUXT_PUBLIC_SENTRY_DSN ?? '',
    },
  },

  css: ['~/assets/css/main.css'],

  alias: {
    '@receipt-tracker/contracts': contractsEntry,
  },

  vite: {
    resolve: {
      alias: {
        '@receipt-tracker/contracts': contractsEntry,
      },
    },
  },

  devtools: { enabled: true },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  ui: {
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'],
    },
  },

  app: {
    head: {
      title: 'Чеки',
      htmlAttrs: { lang: 'ru' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
