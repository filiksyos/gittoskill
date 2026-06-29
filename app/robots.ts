import type { MetadataRoute } from 'next'

const siteUrl = 'https://gittoskill.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/favicon.png', '/icon.png', '/apple-icon.png'],
        disallow: ['/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
