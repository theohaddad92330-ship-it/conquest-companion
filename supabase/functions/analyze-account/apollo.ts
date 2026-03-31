// ============================================================
// APOLLO — People Search (0 crédits) + Enrichment (payant, à la demande)
// Doc: https://docs.apollo.io/reference/people-api-search
// ============================================================
import { timeoutSignal } from './utils.ts'

const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY') || ''

export interface ApolloContact {
  apolloId: string
  firstName: string
  lastName: string
  name: string
  title: string
  linkedinUrl: string | null
  city: string | null
  country: string | null
  organizationName: string | null
  hasEmail: boolean
  hasPhone: boolean
}

/**
 * People Search — GRATUIT (0 crédits)
 * Retourne noms, postes, LinkedIn URLs mais PAS emails/téléphones.
 * Sur le plan gratuit, les noms de famille peuvent être masqués ("Po***r").
 * Sur les plans payants, les noms complets sont retournés.
 */
export async function searchApolloContacts(
  companyName: string,
  companyDomain: string | null,
  titleKeywords: string[],
  traceId: string,
  maxResults = 100,
): Promise<ApolloContact[]> {
  if (!APOLLO_API_KEY) {
    console.log(JSON.stringify({ event: 'apollo_skip', traceId, reason: 'no_key' }))
    return []
  }

  try {
    const allContacts: ApolloContact[] = []
    const perPage = 25
    const maxPages = Math.ceil(maxResults / perPage)

    for (let page = 1; page <= maxPages; page++) {
      // Construire les query params
      const params = new URLSearchParams()
      params.set('q_organization_name', companyName)
      if (companyDomain) params.set('q_organization_domains', companyDomain)
      params.set('per_page', String(perPage))
      params.set('page', String(page))

      // Ajouter les filtres de titres pour cibler les profils pertinents
      for (const title of titleKeywords.slice(0, 8)) {
        params.append('person_titles[]', title)
      }

      const url = `https://api.apollo.io/api/v1/mixed_people/api_search?${params.toString()}`

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'x-api-key': APOLLO_API_KEY,
        },
        signal: timeoutSignal(15000),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.error(JSON.stringify({ event: 'apollo_search_error', traceId, status: res.status, body: errText.slice(0, 300), page }))
        break
      }

      const data = await res.json()
      const people = Array.isArray(data.people) ? data.people : []

      if (people.length === 0) break

      for (const p of people) {
        const firstName = p.first_name || ''
        // Sur plan gratuit, last_name peut être masqué. On prend ce qui est disponible.
        const lastName = p.last_name || p.last_name_obfuscated || ''
        const name = `${firstName} ${lastName}`.trim()

        if (!name || name.length < 2) continue

        allContacts.push({
          apolloId: p.id || '',
          firstName,
          lastName,
          name,
          title: p.title || p.headline || '',
          linkedinUrl: p.linkedin_url || null,
          city: p.city || null,
          country: p.country || null,
          organizationName: p.organization?.name || null,
          hasEmail: !!p.has_email,
          hasPhone: p.has_direct_phone === 'Yes',
        })
      }

      console.log(JSON.stringify({ event: 'apollo_search_page', traceId, page, found: people.length, total: allContacts.length }))

      // Si on a moins de résultats que demandé, c'est la dernière page
      if (people.length < perPage) break

      // Petit délai entre les pages pour respecter le rate limit
      if (page < maxPages) await new Promise(r => setTimeout(r, 500))
    }

    console.log(JSON.stringify({ event: 'apollo_search_done', traceId, totalContacts: allContacts.length }))
    return allContacts

  } catch (err) {
    console.error(JSON.stringify({ event: 'apollo_search_fetch_error', traceId, error: (err as Error).message }))
    return []
  }
}

/**
 * Construit les mots-clés de titres à partir du profil utilisateur et des données du compte
 */
export function buildApolloTitleKeywords(onboardingData: any): string[] {
  const defaults = ['DSI', 'CTO', 'Directeur IT', 'Directeur Digital', 'Head of Data', 'RSSI', 'Directeur Achats IT', 'Chef de projet IT', 'Responsable Data', 'Architecte Cloud']
  const offers = onboardingData.offers || []
  const extra: string[] = []

  for (const offer of offers) {
    const o = String(offer).toLowerCase()
    if (o.includes('data')) extra.push('Head of Data', 'Data Manager', 'Chief Data Officer')
    if (o.includes('cyber') || o.includes('sécu')) extra.push('RSSI', 'CISO', 'Responsable Sécurité')
    if (o.includes('cloud')) extra.push('Directeur Cloud', 'Architecte Cloud', 'Head of Infrastructure')
    if (o.includes('agile') || o.includes('dev')) extra.push('Directeur Technique', 'VP Engineering', 'Scrum Master')
    if (o.includes('digital')) extra.push('Chief Digital Officer', 'Directeur Transformation')
  }

  // Dédupliquer et limiter
  const all = [...new Set([...defaults, ...extra])]
  return all.slice(0, 15)
}
