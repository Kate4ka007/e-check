export default defineNuxtConfig({
  compatibilityDate: '2026-08-30',

  // Приложение целиком за логином: индексировать нечего, первый экран
  // всё равно рисуется после проверки сессии. См. ADR-0008.
  ssr: false,

  // Pinia появится вместе с авторизацией: хранить в сторе нечего,
  // пока нет ни сессии, ни глобального состояния интерфейса.
  modules: ['@nuxt/ui'],

  css: ['~/assets/css/main.css'],

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
