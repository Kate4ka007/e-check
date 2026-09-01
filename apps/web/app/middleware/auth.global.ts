const guestRoutes = new Set(['/login', '/register'])

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  if (auth.status === 'idle') {
    await auth.fetchMe()
  }

  const isGuestRoute = guestRoutes.has(to.path)

  if (isGuestRoute && auth.isAuthenticated) {
    return navigateTo('/')
  }

  if (!isGuestRoute && !auth.isAuthenticated) {
    return navigateTo('/login')
  }
})
