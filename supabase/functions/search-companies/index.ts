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
      console.log(JSON.stringify({ event: 'search_no_pappers_key', query: query.slice(0, 50) }))
      return jsonResponse({ results: [], warning: 'Recherche enrichie indisponible (clé Pappers non configurée). Tapez le nom exact de l\'entreprise et lancez l\'analyse.' }, 200)
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
