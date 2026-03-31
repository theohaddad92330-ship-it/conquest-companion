import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_QUERY_LENGTH = 100
const SEARCH_RATE_LIMIT_PER_15MIN = 60

function detectSearchIntent(normalizedQuery: string): { expectedNafKeywords: string[]; avoidSuffixEntities: boolean } {
  const q = ` ${normalizedQuery} `
  if (q.includes(' sncf ')) {
    return { expectedNafKeywords: ['transport', 'ferroviaire', 'voyageurs', 'logistique'], avoidSuffixEntities: true }
  }
  if (
    q.includes(' societe generale ') ||
    q.includes(' sg ') ||
    q.includes(' bnp ') ||
    q.includes(' credit agricole ') ||
    q.includes(' caisse d epargne ')
  ) {
    return { expectedNafKeywords: ['intermediation monetaire', 'banque', 'financier'], avoidSuffixEntities: true }
  }
  return { expectedNafKeywords: [], avoidSuffixEntities: false }
}

function isAcronymLikeQuery(normalizedQuery: string): boolean {
  const tokens = normalizedQuery.split(' ').filter(Boolean)
  if (tokens.length !== 1) return false
  const t = tokens[0]
  return /^[a-z0-9]{2,6}$/.test(t)
}

function normalizeCompanyName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function employeeWeight(tranche: unknown): number {
  if (typeof tranche !== 'string') return 0
  const s = tranche.toLowerCase()
  if (s.includes('10000')) return 100
  if (s.includes('5000')) return 90
  if (s.includes('2000')) return 80
  if (s.includes('1000')) return 70
  if (s.includes('500')) return 60
  if (s.includes('250')) return 50
  if (s.includes('100')) return 40
  if (s.includes('50')) return 30
  if (s.includes('20')) return 20
  if (s.includes('10')) return 10
  return 5
}

function legalFormWeight(form: unknown): number {
  if (typeof form !== 'string') return 0
  const s = form.toLowerCase()
  if (s.includes('sa') || s.includes('société anonyme')) return 30
  if (s.includes('sas')) return 28
  if (s.includes('sarl')) return 20
  if (s.includes('scop')) return 15
  if (s.includes('association')) return -10
  if (s.includes('sci')) return -20
  if (s.includes('micro') || s.includes('entrepreneur') || s.includes('individuelle')) return -25
  return 0
}

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
  const traceId = crypto.randomUUID().slice(0, 8)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ results: [], error: { message: 'Non authentifié', code: 'AUTH_REQUIRED', traceId } }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '').trim()
    )
    if (authError || !user) {
      return jsonResponse({ results: [], error: { message: 'Non authentifié', code: 'AUTH_INVALID', traceId } }, 401)
    }

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return jsonResponse({ results: [], error: { message: 'Content-Type invalide', code: 'BAD_CONTENT_TYPE', traceId } }, 400)
    }

    const rawBody = await req.text()
    if (rawBody.length > 2048) {
      return jsonResponse({ results: [], error: { message: 'Payload trop volumineux', code: 'PAYLOAD_TOO_LARGE', traceId } }, 400)
    }

    let body: { query?: unknown }
    try {
      body = JSON.parse(rawBody) as { query?: unknown }
    } catch {
      return jsonResponse({ results: [], error: { message: 'JSON invalide', code: 'BAD_JSON', traceId } }, 400)
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
        { results: [], error: { message: 'Trop de recherches. Réessayez dans quelques minutes.', code: 'RATE_LIMIT', traceId } },
        429,
        { 'Retry-After': '60' }
      )
    }

    const PAPPERS_API_KEY = Deno.env.get('PAPPERS_API_KEY') || ''

    if (!PAPPERS_API_KEY) {
      console.log(JSON.stringify({ event: 'search_no_pappers_key', query: query.slice(0, 50) }))
      return jsonResponse({ results: [], warning: 'Recherche enrichie indisponible (clé Pappers non configurée). Tapez le nom exact de l\'entreprise et lancez l\'analyse.', traceId }, 200)
    }

    const res = await fetch(
      `https://api.pappers.fr/v2/recherche?api_token=${PAPPERS_API_KEY}&q=${encodeURIComponent(query)}&par_page=20&entreprise_cessee=false`,
      { signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json()

    const normalizedQuery = normalizeCompanyName(query)
    const intent = detectSearchIntent(normalizedQuery)
    const acronymLike = isAcronymLikeQuery(normalizedQuery)
    const candidates = (data.resultats || []).map((r: Record<string, unknown>) => {
      const baseName = String(r.nom_entreprise || r.denomination || query)
      const legalForm = (r.forme_juridique || null) as string | null
      const city = ((r.siege as { ville?: string })?.ville || null) as string | null
      const nafLabel = (r.libelle_code_naf || null) as string | null
      const normalizedName = normalizeCompanyName(baseName)
      const exactMatch = normalizedName === normalizedQuery
      const beginsWith = normalizedName.startsWith(normalizedQuery)
      const queryTokens = normalizedQuery.split(' ').filter(Boolean)
      const allTokensMatch = queryTokens.every((t) => normalizedName.includes(t))
      const nameTokens = normalizedName.split(' ').filter(Boolean)
      const wordCountGap = Math.max(0, nameTokens.length - queryTokens.length)
      const hasExtraSuffix = beginsWith && !exactMatch && wordCountGap > 0
      const nafNorm = normalizeCompanyName(String(nafLabel || ''))
      const companyNorm = normalizeCompanyName(baseName)
      const isSci = companyNorm.startsWith('sci ') || normalizeCompanyName(String(legalForm || '')).includes('civile immobiliere')
      const isRealEstateRental = nafNorm.includes('location de terrains') || nafNorm.includes('biens immobiliers')
      const intentBonus = intent.expectedNafKeywords.some((k) => nafNorm.includes(normalizeCompanyName(k))) ? 140 : 0
      const intentPenalty = intent.expectedNafKeywords.length > 0 && intentBonus === 0 ? -80 : 0
      const suffixPenalty = intent.avoidSuffixEntities && hasExtraSuffix ? -280 : (hasExtraSuffix ? -220 : 0)
      const acronymPenalty =
        acronymLike && exactMatch && (isSci || isRealEstateRental)
          ? -420
          : 0
      const acronymParentBonus =
        acronymLike && beginsWith && !exactMatch && !isSci
          ? 220
          : 0
      const relevanceScore =
        (exactMatch ? 1000 : 0) +
        (beginsWith ? 150 : 0) +
        (allTokensMatch ? 80 : -250) +
        (wordCountGap > 0 ? -Math.min(400, wordCountGap * 90) : 0) +
        suffixPenalty +
        acronymPenalty +
        acronymParentBonus +
        intentBonus +
        intentPenalty +
        employeeWeight(r.tranche_effectif) +
        legalFormWeight(legalForm)

      return {
        name: baseName,
        siren: r.siren || null,
        city,
        postalCode: (r.siege as { code_postal?: string })?.code_postal || null,
        sector: legalForm ? (nafLabel ? `${legalForm} · ${nafLabel}` : legalForm) : nafLabel,
        employees: r.tranche_effectif || null,
        legalForm,
        _score: relevanceScore,
      }
    })

    const results = candidates
      .sort((a, b) => b._score - a._score)
      .slice(0, 5)
      .map(({ _score, ...rest }) => rest)

    return jsonResponse({ results, traceId }, 200)
  } catch (err) {
    console.error(JSON.stringify({ event: 'search_companies_error', traceId, error: err instanceof Error ? err.message : 'unknown' }))
    return jsonResponse(
      { results: [], error: { message: 'Erreur serveur', code: 'SERVER_ERROR', traceId } },
      500
    )
  }
})
