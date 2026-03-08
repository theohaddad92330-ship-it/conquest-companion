import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_QUERY_LENGTH = 100
const SEARCH_RATE_LIMIT_PER_15MIN = 60

function getCorsHeaders(): Record<string, string> {
  const origin = Deno.env.get('ALLOWED_ORIGINS')?.trim()
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }
}

function jsonResponse(data: unknown, status: number, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(), ...headers },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: getCorsHeaders() })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ results: [], error: 'Non authentifié' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '').trim()
    )
    if (authError || !user) {
      return jsonResponse({ results: [], error: 'Non authentifié' }, 401)
    }

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return jsonResponse({ results: [], error: 'Content-Type invalide' }, 400)
    }

    const rawBody = await req.text()
    if (rawBody.length > 2048) {
      return jsonResponse({ results: [], error: 'Payload trop volumineux' }, 400)
    }

    let body: { query?: unknown }
    try {
      body = JSON.parse(rawBody) as { query?: unknown }
    } catch {
      return jsonResponse({ results: [], error: 'JSON invalide' }, 400)
    }

    const rawQuery = body?.query
    const query =
      typeof rawQuery === 'string'
        ? rawQuery.trim().slice(0, MAX_QUERY_LENGTH)
        : ''

    if (query.length < 2) {
      return jsonResponse({ results: [] }, 200)
    }

    const { data: rateLimitOk } = await supabase.rpc('check_and_record_search_rate_limit', {
      p_user_id: user.id,
      p_max_per_15min: SEARCH_RATE_LIMIT_PER_15MIN,
    })
    if (rateLimitOk === false) {
      return jsonResponse(
        { results: [], error: 'Trop de recherches. Réessayez dans quelques minutes.' },
        429,
        { 'Retry-After': '60' }
      )
    }

    const PAPPERS_API_KEY = Deno.env.get('PAPPERS_API_KEY') || ''

    if (!PAPPERS_API_KEY) {
      const demoResults = generateDemoSuggestions(query)
      return jsonResponse({ results: demoResults }, 200)
    }

    const res = await fetch(
      `https://api.pappers.fr/v2/recherche?api_token=${PAPPERS_API_KEY}&q=${encodeURIComponent(query)}&par_page=5`,
      { signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json()

    const results = (data.resultats || []).map((r: Record<string, unknown>) => ({
      name: r.nom_entreprise || r.denomination || query,
      siren: r.siren || null,
      city: (r.siege as { ville?: string })?.ville || null,
      postalCode: (r.siege as { code_postal?: string })?.code_postal || null,
      sector: r.libelle_code_naf || null,
      employees: r.tranche_effectif || null,
      legalForm: r.forme_juridique || null,
    }))

    return jsonResponse({ results }, 200)
  } catch (err) {
    console.error('search-companies error:', err instanceof Error ? err.message : 'unknown')
    return jsonResponse(
      { results: [], error: 'Erreur serveur' },
      500
    )
  }
})

function generateDemoSuggestions(query: string) {
  const allCompanies = [
    { name: 'Société Générale', siren: '552120222', city: 'Paris La Défense', sector: 'Banque', employees: '117 000', postalCode: null, legalForm: null },
    { name: 'Sopra Steria', siren: '326820065', city: 'Paris', sector: 'ESN', employees: '56 000', postalCode: null, legalForm: null },
    { name: 'BNP Paribas', siren: '662042449', city: 'Paris 9ème', sector: 'Banque', employees: '185 000', postalCode: null, legalForm: null },
    { name: 'Capgemini', siren: '330703844', city: 'Paris', sector: 'ESN', employees: '360 000', postalCode: null, legalForm: null },
    { name: 'Airbus', siren: '383474814', city: 'Toulouse', sector: 'Aéronautique', employees: '130 000', postalCode: null, legalForm: null },
    { name: 'SNCF', siren: '552049447', city: 'Saint-Denis', sector: 'Transport', employees: '270 000', postalCode: null, legalForm: null },
    { name: 'TotalEnergies', siren: '542051180', city: 'La Défense', sector: 'Énergie', employees: '100 000', postalCode: null, legalForm: null },
    { name: 'Orange', siren: '380129866', city: 'Paris', sector: 'Telecom', employees: '137 000', postalCode: null, legalForm: null },
    { name: 'Crédit Agricole', siren: '784608416', city: 'Montrouge', sector: 'Banque', employees: '75 000', postalCode: null, legalForm: null },
    { name: 'Accenture France', siren: '732829320', city: 'Paris', sector: 'Conseil', employees: '12 000', postalCode: null, legalForm: null },
    { name: 'Atos', siren: '323623603', city: 'Bezons', sector: 'ESN', employees: '95 000', postalCode: null, legalForm: null },
    { name: 'Thales', siren: '552059024', city: 'La Défense', sector: 'Défense', employees: '81 000', postalCode: null, legalForm: null },
    { name: 'Devoteam', siren: '402490830', city: 'Levallois-Perret', sector: 'ESN', employees: '10 000', postalCode: null, legalForm: null },
    { name: 'Alten', siren: '348607417', city: 'Boulogne-Billancourt', sector: 'Ingénierie', employees: '57 000', postalCode: null, legalForm: null },
    { name: 'CGI France', siren: '702042755', city: 'Paris', sector: 'ESN', employees: '90 000', postalCode: null, legalForm: null },
  ]
  const q = query.toLowerCase()
  return allCompanies
    .filter(c => c.name.toLowerCase().includes(q))
    .slice(0, 5)
}
