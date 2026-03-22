import { MetadataRoute } from 'next'

// Dynamically generate the Next.js robots configuration
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Prevent crawlers and AI bots from scraping private/dashboard routes and API boundaries
      disallow: ['/dashboard/', '/api/'],
    },
    sitemap: 'https://tripzy.dev/sitemap.xml',
  }
}
