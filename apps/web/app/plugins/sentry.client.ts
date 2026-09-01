import * as Sentry from '@sentry/vue'
import { sanitizeSentryEvent } from '~/utils/sentry'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const dsn = config.public.sentryDsn as string
  if (!dsn) return

  Sentry.init({
    app: nuxtApp.vueApp,
    dsn,
    environment: import.meta.dev ? 'development' : 'production',
    beforeSend: sanitizeSentryEvent,
  })

  nuxtApp.hook('vue:error', (error, _instance, info) => {
    Sentry.captureException(error, {
      extra: { vueInfo: info },
    })
  })
})
