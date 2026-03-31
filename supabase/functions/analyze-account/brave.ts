// ============================================================
// BRAVE SEARCH — Recherche web multi-requêtes
// ============================================================
import { timeoutSignal } from './utils.ts'

const BRAVE_API_KEY = Deno.env.get('BRAVE_API_KEY') || ''

export async function searchBrave(companyName: string, onboardingData: any, traceId: string): Promise<{ results: any[], urls: string[], linkedinCompanyUrl: string | null }> {
  if (!BRAVE_API_KEY) {
    throw new Error('BRAVE_API_KEY manquante — impossible de lancer la recherche web')
  }
  const year = new Date().getFullYear()
  const offers = (onboardingData.offers || []).slice(0, 2).join(' ')
  const geo = onboardingData.geo || []
  const hasInternational = Array.isArray(geo) && geo.includes('International')

  const queries = [
    `${companyName} stratégie transformation digitale projet IT ${year}`,
    `${companyName} recrutement DSI CTO nomination filiales ${year}`,
    `${companyName} prestataire ESN budget IT investissement`,
    `${companyName} site:linkedin.com/company`,
    `${companyName} DSI directeur digital nommé nomination`,
    `${companyName} équipe direction dirigeants management ${year}`,
    `${companyName} annuaire organigramme DSI CTO RSSI`,
    `${companyName} nomination directeur chef de projet IT`,
  ]
  if (offers) queries.push(`${companyName} ${offers} programme projet`)
  if (!hasInternational) queries.push(`${companyName} France siège filiales`)

  try {
    const all = await Promise.allSettled(queries.map(q =>
      fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=15`, {
        headers: { 'X-Subscription-Token': BRAVE_API_KEY },
        signal: timeoutSignal(10000),
      }).then(r => r.json()).then(d => d.web?.results || [])
    ))
    const flat = all.flatMap(r => r.status === 'fulfilled' ? r.value : [])
    const seen = new Set<string>()
    const unique = flat.filter((r: any) => { if (!r.url || seen.has(r.url)) return false; seen.add(r.url); return true })
    console.log(JSON.stringify({ event: 'brave_done', traceId, count: unique.length }))
    const linkedinUrl = unique.find((r: any) => r.url?.includes('linkedin.com/company/'))?.url || null
    return {
      results: unique.map((r: any) => ({ title: r.title, description: r.description, url: r.url })),
      urls: unique.map((r: any) => r.url),
      linkedinCompanyUrl: linkedinUrl,
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'brave_error', traceId, error: (err as Error).message }))
    return { results: [], urls: [], linkedinCompanyUrl: null }
  }
}
