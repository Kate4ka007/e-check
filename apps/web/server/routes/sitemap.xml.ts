const publicPaths = ['/', '/demo'] as const

export default defineEventHandler((event) => {
  const siteUrl = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')

  const urls = publicPaths.map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
})
