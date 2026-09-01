export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  if (auth.status === 'idle') {
    await auth.fetchMe()
  }
})
