const guestRoutes = new Set(['/', '/login', '/register', '/demo'])
const appHome = '/receipts'

export default defineNuxtRouteMiddleware(async (to) => {
  // Публичные страницы рендерятся как гостевые. Сессию читает только браузер —
  // иначе prerender ходил бы в API без cookie и падал на сборке. См. ADR-0016.
  if (import.meta.server) return

  const auth = useAuthStore()

  if (auth.status === 'idle') {
    await auth.fetchMe()
  }

  const isGuestRoute = guestRoutes.has(to.path)

  if (isGuestRoute && auth.isAuthenticated) {
    return navigateTo(appHome)
  }

  if (!isGuestRoute && !auth.isAuthenticated) {
    return navigateTo('/')
  }
})
