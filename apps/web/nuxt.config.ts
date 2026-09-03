import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))
const contractsEntry = resolve(rootDir, '../../packages/contracts/src/index.ts')

const vercelOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null

const siteUrl = (
  process.env.NUXT_PUBLIC_SITE_URL ??
  vercelOrigin ??
  'http://localhost:3000'
).replace(/\/$/, '')

const noIndexHeaders = { 'X-Robots-Tag': 'noindex, nofollow' }

export default defineNuxtConfig({
  compatibilityDate: '2026-08-30',

  // Публичные / и /demo — HTML на сборке. Приватные маршруты — SPA:
  // сессия остаётся клиентской, cookie на сервер Nuxt не пробрасываются.
  // Новый публичный путь: ssr/prerender здесь и в guestRoutes middleware.
  // Новый путь за сессией: ssr: false (как /receipts/**). Catch-all /** не
  // использовать — он превращает prerender в пустую SPA-оболочку. ADR-0016.
  routeRules: {
    '/': { ssr: true, prerender: true, headers: noIndexHeaders },
    '/demo': { ssr: true, prerender: true, headers: noIndexHeaders },
    '/login': { ssr: false, headers: noIndexHeaders },
    '/register': { ssr: false, headers: noIndexHeaders },
    '/receipts/**': { ssr: false, headers: noIndexHeaders },
    '/sitemap.xml': { prerender: true, headers: noIndexHeaders },
  },

  modules: ['@nuxt/ui', '@pinia/nuxt'],

  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1',
      siteUrl,
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
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.svg' },
      ],
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#16A34A' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
    },
  },
})
