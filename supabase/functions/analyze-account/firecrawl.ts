// ============================================================
// FIRECRAWL — Scraping de pages web
// ============================================================
import { timeoutSignal } from './utils.ts'

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY') || ''

export async function scrapePages(urls: string[], traceId: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY manquante — impossible de scraper les pages')
  }
  if (urls.length === 0) {
    console.log(JSON.stringify({ event: 'firecrawl_no_urls', traceId }))
    return ''
  }

  const skip = ['linkedin.com', 'facebook.com', 'twitter.com', 'youtube.com']
  const filtered = urls.filter(u => !skip.some(s => u.toLowerCase().includes(s))).slice(0, 15)

  const CHARS_PER_PAGE = 6000
  try {
    const all = await Promise.allSettled(filtered.map(url =>
      fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_API_KEY}` },
        body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
        signal: timeoutSignal(15000),
      }).then(r => r.json()).then(d => d.data?.markdown ? `--- SOURCE: ${url} ---\n${d.data.markdown.slice(0, CHARS_PER_PAGE)}` : null)
    ))
    const contents = all.filter(r => r.status === 'fulfilled' && r.value).map(r => (r as any).value)
    const result = contents.join('\n\n')
    console.log(JSON.stringify({ event: 'firecrawl_done', traceId, pages: contents.length, chars: result.length }))
    return result
  } catch (err) {
    console.error(JSON.stringify({ event: 'firecrawl_error', traceId, error: (err as Error).message }))
    return ''
  }
}
