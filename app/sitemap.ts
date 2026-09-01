import type { MetadataRoute } from 'next'

// Internal operations platform — the entry page is the only public route.
// The marketing presence lives at theprhub.com.au, which has its own sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  return []
}
