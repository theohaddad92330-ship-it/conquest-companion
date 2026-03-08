import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_BODY_BYTES = 100_000
const GENERIC_ERROR_MESSAGE = 'Une erreur est survenue'

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

// API Keys — Supabase Dashboard > Edge Functions > Secrets (noms avec ou sans espaces)
function getEnvKey(name: string, altName: string): string {
  return Deno.env.get(name) || Deno.env.get(altName) || ''
}
const BRAVE_API_KEY = getEnvKey('BRAVE_API_KEY', 'BRAVE API KEY')
const FIRECRAWL_API_KEY = getEnvKey('FIRECRAWL_API_KEY', 'FIRECRAWL API KEY')
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const APIFY_API_TOKEN = getEnvKey('APIFY_API_TOKEN', 'APIFY API KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: getCorsHeaders() })

  console.log(JSON.stringify({
    event: 'env_check',
    brave: BRAVE_API_KEY.length > 0,
    braveLen: BRAVE_API_KEY.length,
    firecrawl: FIRECRAWL_API_KEY.length > 0,
    firecrawlLen: FIRECRAWL_API_KEY.length,
    claude: ANTHROPIC_API_KEY.length > 0,
    claudeLen: ANTHROPIC_API_KEY.length,
    apify: APIFY_API_TOKEN.length > 0,
    apifyLen: APIFY_API_TOKEN.length,
  }))

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Non authentifié' }, 401)
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '').trim()
    )
    if (authError || !user) {
      return jsonResponse({ error: 'Non authentifié' }, 401)
    }

    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Payload trop volumineux' }, 400)
    }
    let body: { companyName?: unknown; userContext?: unknown }
    try {
      body = JSON.parse(rawBody) as { companyName?: unknown; userContext?: unknown }
    } catch {
      return jsonResponse({ error: 'JSON invalide' }, 400)
    }

    // Normalisation du nom (trim + espaces multiples → un seul) pour accepter variantes / fautes de frappe
    const rawName = typeof body?.companyName === 'string' ? body.companyName : ''
    const companyName = rawName.trim().replace(/\s+/g, ' ')
    const userContext = typeof body?.userContext === 'string' ? body.userContext.slice(0, 2000) : null

    if (!companyName) return jsonResponse({ error: 'Nom d’entreprise requis' }, 400)
    if (companyName.length > 200) return jsonResponse({ error: 'Nom trop long (max 200 caractères)' }, 400)

    // DÉSACTIVÉ : rate limit et crédits pour ne jamais bloquer la recherche (réactiver en prod si besoin)
    // const { data: rateLimitOk, error: rateLimitError } = await supabase.rpc('check_rate_limit', ...)
    // const { data: creditOk, error: creditError } = await supabase.rpc('check_and_increment_accounts_used', ...)

    const { data: account, error: insertError } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        company_name: companyName,
        user_context: userContext ?? null,
        status: 'analyzing',
      })
      .select()
      .single()
    if (insertError) {
      console.error('analyze-account insert accounts error:', insertError.message, insertError.code)
      return jsonResponse(
        { error: 'Création du compte en cours a échoué. Réessayez ou contactez le support.' },
        500
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    const onboardingData = profile?.onboarding_data ?? {}

    EdgeRuntime.waitUntil(
      processAnalysis(supabase, account.id, user.id, companyName, userContext, onboardingData)
    )

    return jsonResponse({ accountId: account.id, status: 'analyzing' }, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('analyze-account error:', msg)
    return jsonResponse({ error: GENERIC_ERROR_MESSAGE }, 500)
  }
})

// ============================================
// CHAÎNE D'ORCHESTRATION PRINCIPALE
// ============================================
async function processAnalysis(supabase: any, accountId: string, userId: string, companyName: string, userContext: string | null, onboardingData: any) {
  const traceId = crypto.randomUUID().slice(0, 8)
  console.log(JSON.stringify({ event: 'analysis_start', traceId, accountId, companyName, userId }))

  try {
    // ÉTAPE 1 — Brave Search (6 requêtes, 30 résultats)
    const braveResults = await searchBrave(companyName, onboardingData, traceId)
    console.log(JSON.stringify({ event: 'brave_done', traceId, resultsCount: braveResults.results?.length || 0 }))
    console.log(JSON.stringify({
      event: 'brave_detail',
      traceId,
      resultsCount: braveResults.results?.length || 0,
      urlsCount: braveResults.urls?.length || 0,
      firstResults: braveResults.results?.slice(0, 3).map((r: any) => r.title) || [],
      braveApiKeyPresent: !!BRAVE_API_KEY,
      braveApiKeyLength: BRAVE_API_KEY.length,
    }))

    // ÉTAPE 2 — Scraping pages (jusqu'à 12 pages priorisées)
    const scrapedContent = await scrapePages(braveResults.urls || [], traceId)
    console.log(JSON.stringify({ event: 'firecrawl_done', traceId, contentLength: scrapedContent.length }))
    console.log(JSON.stringify({
      event: 'firecrawl_detail',
      traceId,
      contentLength: scrapedContent.length,
      contentPreview: scrapedContent.slice(0, 200),
      firecrawlApiKeyPresent: !!FIRECRAWL_API_KEY,
      firecrawlApiKeyLength: FIRECRAWL_API_KEY.length,
    }))

    // Contexte RAG (base de connaissances ESN)
    const ragContext = await searchRAG(supabase, companyName)

    // ÉTAPE 3 — Analyse IA complète (Claude) — sans contacts (générés séparément)
    const analysis = await analyzeWithClaude(companyName, braveResults, scrapedContent, userContext, onboardingData, ragContext, traceId)
    console.log(JSON.stringify({ event: 'claude_analysis_done', traceId, contactsCount: analysis.contacts?.length || 0, anglesCount: analysis.angles?.length || 0 }))
    console.log(JSON.stringify({
      event: 'claude_detail',
      traceId,
      claudeApiKeyPresent: !!ANTHROPIC_API_KEY,
      claudeApiKeyLength: ANTHROPIC_API_KEY.length,
      analysisContacts: analysis.contacts?.length || 0,
      analysisSector: analysis.sector || 'NONE',
      analysisIsFallback: analysis.priorityJustification?.includes('MODE DÉMO') || false,
      anglesCount: analysis.angles?.length || 0,
    }))

    // ÉTAPE 4 — Sauvegarde intermédiaire (fiche + angles + plan)
    await supabase.from('accounts').update({
      sector: analysis.sector,
      employees: analysis.employees,
      revenue: analysis.revenue,
      headquarters: analysis.headquarters,
      website: analysis.website,
      subsidiaries: analysis.subsidiaries || [],
      it_challenges: analysis.itChallenges || [],
      recent_signals: analysis.recentSignals || [],
      priority_score: analysis.priorityScore || 5,
      priority_justification: analysis.priorityJustification,
      raw_analysis: analysis,
      status: 'analyzing',
    }).eq('id', accountId)

    if (analysis.angles?.length) {
      await supabase.from('attack_angles').insert(
        analysis.angles.map((a: any, i: number) => ({
          account_id: accountId,
          user_id: userId,
          title: a.title,
          description: a.description,
          entry_point: a.entry,
          is_recommended: i === 0,
          rank: i + 1,
        }))
      )
    }
    if (analysis.actionPlan) {
      await supabase.from('action_plans').insert({
        account_id: accountId,
        user_id: userId,
        strategy_type: analysis.actionPlan.strategyType || 'multi_thread',
        strategy_justification: analysis.actionPlan.strategyJustification,
        weeks: analysis.actionPlan.weeks || [],
      })
    }

    // ===== ÉTAPE 5 — CONTACTS =====
    let finalContacts: any[] = []
    let contactSourceForDb: 'linkedin_apify' | 'ai_generated' = 'ai_generated'

    if (APIFY_API_TOKEN) {
      const companyData = await scrapeLinkedInCompany(companyName, traceId)
      if (companyData) {
        const updates: any = {}
        if (companyData.employeeCount && !analysis.employees) {
          updates.employees = `~${companyData.employeeCount} collaborateurs`
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('accounts').update(updates).eq('id', accountId)
        }
      }

      const linkedinContacts = await scrapeLinkedInPeople(companyName, onboardingData, 200, traceId)
      console.log(JSON.stringify({ event: 'apify_detail', traceId, apifyTokenPresent: true, apifyTokenLength: APIFY_API_TOKEN.length, linkedinContactsCount: linkedinContacts.length, companyDataFound: !!companyData }))

      if (linkedinContacts.length > 0) {
        finalContacts = await enrichLinkedInContactsWithClaude(linkedinContacts, companyName, analysis, onboardingData, traceId)
        contactSourceForDb = 'linkedin_apify'
        console.log(JSON.stringify({ event: 'contacts_source', traceId, source: 'apify_enriched', count: finalContacts.length }))
      } else {
        console.log(JSON.stringify({ event: 'apify_failed_using_claude_fallback', traceId }))
        try {
          finalContacts = await generateContactsWithClaude(companyName, analysis, onboardingData, traceId)
        } catch (genErr) {
          console.error(JSON.stringify({ event: 'generate_contacts_crash', traceId, error: genErr instanceof Error ? genErr.message : String(genErr) }))
          finalContacts = []
        }
        console.log(JSON.stringify({ event: 'contacts_source', traceId, source: 'claude_fallback_after_apify', count: finalContacts.length }))
      }
    } else {
      console.log(JSON.stringify({ event: 'no_apify_using_claude', traceId }))
      try {
        finalContacts = await generateContactsWithClaude(companyName, analysis, onboardingData, traceId)
      } catch (genErr) {
        console.error(JSON.stringify({ event: 'generate_contacts_crash', traceId, error: genErr instanceof Error ? genErr.message : String(genErr) }))
        finalContacts = []
      }
      console.log(JSON.stringify({ event: 'contacts_source', traceId, source: 'claude_no_apify', count: finalContacts.length }))
    }

    // FILET DE SÉCURITÉ : si après tout on a toujours 0 contacts
    if (finalContacts.length === 0) {
      console.log(JSON.stringify({ event: 'last_resort_fallback', traceId }))
      try {
        finalContacts = await generateContactsWithClaude(companyName, analysis, onboardingData, traceId)
      } catch (genErr) {
        console.error(JSON.stringify({ event: 'generate_contacts_crash', traceId, error: genErr instanceof Error ? genErr.message : String(genErr) }))
      }
      console.log(JSON.stringify({ event: 'contacts_source', traceId, source: 'last_resort', count: finalContacts.length }))
    }

    // ÉTAPE 7 — Sauvegarde finale (contacts + status completed)
    if (finalContacts.length > 0) {
      await supabase.from('contacts').insert(
        finalContacts.map((c: any, i: number) => ({
          account_id: accountId,
          user_id: userId,
          full_name: c.name || `Contact ${i + 1}`,
          title: c.title,
          entity: c.entity,
          decision_role: (c.role || 'unknown').toLowerCase(),
          priority: c.priority || i + 1,
          email: c.email || null,
          phone: c.phone || null,
          linkedin_url: c.linkedin || null,
          profile_summary: c.summary,
          why_contact: c.whyContact,
          email_message: c.emailMessage || null,
          linkedin_message: c.linkedinMessage || null,
          followup_message: c.followupMessage || null,
          source: contactSourceForDb,
        }))
      )
    }

    // Marquer terminé immédiatement après les contacts (évite de rester "En cours" si timeout juste après)
    const estimatedCost = 0.003 * (scrapedContent.length / 1000)
      + 0.005 * (braveResults.results?.length || 0)
      + 0.1
      + (APIFY_API_TOKEN ? 3.0 : 0)
    await supabase.from('accounts').update({
      status: 'completed',
      api_cost_euros: estimatedCost,
    }).eq('id', accountId)

    console.log(JSON.stringify({ event: 'analysis_complete', traceId, accountId }))
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'unknown'
    console.error(JSON.stringify({ event: 'analysis_error', traceId, accountId, error: errMsg }))
    try {
      await supabase.from('accounts').update({
        status: 'error',
        error_message: errMsg?.slice?.(0, 500) ?? GENERIC_ERROR_MESSAGE,
      }).eq('id', accountId)
    } catch (updateErr) {
      console.error(JSON.stringify({ event: 'analysis_error_update_failed', traceId, accountId }))
    }
  }
}

// ============================================
// FONCTIONS API EXTERNES
// ============================================

async function searchBrave(companyName: string, onboardingData: any, traceId: string) {
  if (!BRAVE_API_KEY) return { results: [], urls: [] }
  const year = new Date().getFullYear()
  const offers = (onboardingData.offers || []).slice(0, 2).join(' ')
  const sectors = (onboardingData.sectors || []).slice(0, 2).join(' ')
  const baseQueries = [
    `${companyName} stratégie transformation digitale ${year}`,
    `${companyName} projet cloud IA data cybersécurité programme investissement IT`,
    `${companyName} recrutement DSI CTO nomination ${year} actualités`,
    `${companyName} filiales organisation organigramme DSI direction SI`,
    `${companyName} prestataire ESN intégrateur Capgemini Sopra Atos Accenture Devoteam`,
    `${companyName} appel offres marché IT prestation informatique ${year}`,
  ]
  const queries = [...baseQueries]
  if (offers) queries.push(`${companyName} ${offers} recrutement projet ${year}`)
  if (sectors) queries.push(`${companyName} ${sectors} transformation IT digital`)
  if (onboardingData.mainChallenge) queries.push(`${companyName} ${onboardingData.mainChallenge} DSI décideurs`)
  let allResults: any[] = []
  try {
    const batchSize = 3
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(async (q) => {
          const res = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10`,
            {
              headers: { 'X-Subscription-Token': BRAVE_API_KEY },
              signal: AbortSignal.timeout(10000),
            }
          )
          const data = await res.json()
          return data.web?.results || []
        })
      )
      for (const result of batchResults) {
        if (result.status === 'fulfilled') allResults.push(...result.value)
      }
      if (i + batchSize < queries.length) await new Promise(r => setTimeout(r, 500))
    }
    const seen = new Set<string>()
    const unique = allResults.filter((r: any) => {
      if (!r.url || seen.has(r.url)) return false
      seen.add(r.url)
      return true
    })
    const top = unique.slice(0, 30)
    return {
      results: top.map((r: any) => ({ title: r.title, description: r.description, url: r.url })),
      urls: top.map((r: any) => r.url),
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'brave_error', traceId, error: err instanceof Error ? err.message : 'unknown' }))
    return { results: [], urls: [] }
  }
}

function prioritizeUrls(urls: string[]): string[] {
  const corporate: string[] = []
  const news: string[] = []
  const jobs: string[] = []
  const other: string[] = []
  for (const url of urls) {
    const lower = url.toLowerCase()
    if (lower.includes('linkedin.com') || lower.includes('facebook.com') || lower.includes('twitter.com')) continue
    if (lower.includes('careers') || lower.includes('emploi') || lower.includes('recrutement') || lower.includes('jobs') || lower.includes('welcometothejungle')) jobs.push(url)
    else if (lower.includes('lesechos') || lower.includes('journaldunet') || lower.includes('usine') || lower.includes('presse') || lower.includes('communique') || lower.includes('bfm') || lower.includes('figaro')) news.push(url)
    else if (!lower.includes('wikipedia')) corporate.push(url)
    else other.push(url)
  }
  return [...corporate.slice(0, 5), ...news.slice(0, 4), ...jobs.slice(0, 3), ...other.slice(0, 3)]
}

async function scrapePages(urls: string[], traceId: string) {
  if (!FIRECRAWL_API_KEY || urls.length === 0) return ''
  const contents: string[] = []
  try {
    const prioritized = prioritizeUrls(urls)
    const maxPages = Math.min(prioritized.length, 12)
    const batchSize = 4
    for (let i = 0; i < maxPages; i += batchSize) {
      const batch = prioritized.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(async (url) => {
          const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            },
            body: JSON.stringify({
              url,
              formats: ['markdown'],
              onlyMainContent: true,
            }),
            signal: AbortSignal.timeout(15000),
          })
          const data = await res.json()
          if (data.data?.markdown) {
            return `--- SOURCE: ${url} ---\n${data.data.markdown.slice(0, 4000)}`
          }
          return null
        })
      )
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) contents.push(result.value)
      }
      if (i + batchSize < maxPages) await new Promise(r => setTimeout(r, 300))
    }
    return contents.join('\n\n')
  } catch (err) {
    console.error(JSON.stringify({ event: 'firecrawl_error', traceId, error: err instanceof Error ? err.message : 'unknown' }))
    return ''
  }
}

async function searchRAG(supabase: any, _query: string, category?: string): Promise<string> {
  try {
    let q = supabase.from('rag_documents').select('title, content, category').limit(5)
    if (category) q = q.eq('category', category)
    const { data } = await q
    if (!data || data.length === 0) return ''
    return data.map((doc: any) => `--- ${doc.title} (${doc.category}) ---\n${doc.content}`).join('\n\n')
  } catch {
    return ''
  }
}

// ============================================
// ANALYSE IA AVEC CLAUDE
// ============================================

async function analyzeWithClaude(companyName: string, braveResults: any, scrapedContent: string, userContext: string | null, onboardingData: any, ragContext: string, traceId: string) {
  if (!ANTHROPIC_API_KEY) {
    return generateFallbackAnalysis(companyName, onboardingData)
  }

  // PROMPT 1 — MASTER SYSTEM (BELLUM)
  const systemPrompt = `Tu es BELLUM, l'agent d'intelligence commerciale de BellumAI.
Tu produis des plans de conquête B2B structurés et actionnables pour des commerciaux d'ESN (Entreprises de Services Numériques).

Tu es un stratège commercial expert en vente de services IT. Tu maîtrises :
- La vente en ESN (régie, forfait, conseil) à des PME, ETI et grands groupes
- Les cycles d'achat IT en France (référencement, appels d'offres, achats directs)
- La cartographie décisionnelle et les dynamiques d'influence en entreprise
- L'intelligence économique appliquée à la prospection B2B

══════════════════════════════════════
PROFIL DE L'ESN UTILISATRICE
══════════════════════════════════════
- Nom : ${onboardingData.esnName || 'Non renseigné'}
- Taille : ${onboardingData.size || 'Non renseignée'}
- Offres principales : ${JSON.stringify(onboardingData.offers || [])}
- Secteurs cibles : ${JSON.stringify(onboardingData.sectors || [])}
- Personas cibles : ${JSON.stringify(onboardingData.personas || [])}
- Type de clients visés : ${JSON.stringify(onboardingData.clientType || [])}
- Zone géographique : ${JSON.stringify(onboardingData.geo || [])}
- TJM moyen : ${onboardingData.avgTJM || 'Non renseigné'}
- Cycle de vente : ${onboardingData.salesCycle || 'Non renseigné'}
- Taille équipe commerciale : ${onboardingData.salesTeamSize || 'Non renseigné'}
- Défi principal : ${onboardingData.mainChallenge || 'Non renseigné'}
- Références existantes : ${JSON.stringify(onboardingData.existingRefs || [])}
- Style commercial : ${onboardingData.style || 'direct'}
- Personas à exclure : ${JSON.stringify(onboardingData.excludedPersonas || [])}
${userContext ? `\nCONTEXTE SPÉCIFIQUE DE L'UTILISATEUR : ${userContext}` : ''}

══════════════════════════════════════
INTELLIGENCE UTILISATEUR — RÈGLES D'ADAPTATION
══════════════════════════════════════

RÈGLE 1 — Adapter la stratégie selon la TAILLE DE L'ESN :
- "1 - 20 consultants" → L'ESN est petite. Prioriser les approches directes, les relations interpersonnelles, les portes d'entrée opérationnelles (tech leads, chefs de projet). Éviter de recommander des stratégies qui nécessitent une force de frappe commerciale importante. Proposer des actions réalistes pour 1 personne.
- "20 - 50 consultants" → ESN en croissance. Peut adresser des ETI et certains grands comptes. Recommander un mix bottom-up + ciblage sélectif des décideurs.
- "50 - 200 consultants" → ESN structurée. Peut adresser les grands comptes avec une approche multi-thread (plusieurs contacts en parallèle).
- "200+ consultants" → Grande ESN. Approche institutionnelle possible. Recommander des stratégies de référencement, de réponse aux AO, et d'account-based marketing.

RÈGLE 2 — Adapter selon le TYPE DE CLIENT VISÉ :
- "Grands comptes (CAC40, SBF120)" → Vérifier systématiquement le statut de référencement. Si l'ESN est petite (< 50) et non référencée, recommander en priorité : sous-traitance via ESN référencée, approche par filiale/BU secondaire, ou entrée par un projet spécifique avec sponsorship interne. Ne JAMAIS recommander un contact DSI direct pour une petite ESN non référencée sur un grand compte.
- "ETI (500 - 5000 salariés)" → Cycle plus court, moins de barrières. Approche directe au DSI/CTO réaliste. Recommander de chercher des projets de transformation en cours.
- "PME (< 500 salariés)" → Contact direct fondateur/CTO. Cycle court. Proposer un positionnement expert technique plutôt qu'institutionnel.

RÈGLE 3 — Adapter selon le DÉFI PRINCIPAL :
- "Identifier de nouveaux comptes" → Mettre l'accent sur les signaux business et les opportunités détectées. Scorer l'attractivité du compte.
- "Trouver les bons interlocuteurs" → Mettre l'accent sur la cartographie décisionnelle et les chemins d'accès. Détailler la hiérarchie et les rôles.
- "Rédiger des messages qui convertissent" → Mettre l'accent sur les messages ultra-personnalisés. Produire des messages longs et argumentés, pas des templates génériques.
- "Structurer mon approche plan de compte" → Mettre l'accent sur le plan d'action semaine par semaine. Détailler les KPIs et les milestones.

RÈGLE 4 — Adapter selon le CYCLE DE VENTE :
- "Moins de 3 mois" → Plan d'action sur 4 semaines, actions rapides, objectif RDV en semaine 1-2.
- "3 à 6 mois" → Plan sur 8 semaines, relances structurées, qualification progressive.
- "6 à 12 mois" → Plan sur 12 semaines, approche multi-contacts, nurturing.
- "Plus de 12 mois" → Plan trimestriel, veille continue, événements sectoriels.

RÈGLE 5 — Adapter selon le TJM :
- "Moins de 400€" → Positionner sur le volume et la flexibilité. Cibler les chefs de projet et opérationnels plutôt que les DSI.
- "400€ - 600€" → Positionnement standard. Équilibre volume/expertise.
- "600€ - 900€" → Positionner sur l'expertise et la valeur ajoutée. Cibler les décideurs.
- "900€+" → Positionner sur le conseil stratégique et la transformation. Cibler les C-levels exclusivement.

══════════════════════════════════════
MÉTHODOLOGIE D'ANALYSE
══════════════════════════════════════

ÉTAPE 1 — DÉTERMINER LE PROFIL DE LA CIBLE
Avant toute analyse, déterminer :
- PME / ETI / Grand groupe
- Public ou privé (si public → vérifier AO obligatoire)
- Secteur d'activité
- Dynamisme IT (score 1-5 basé sur les signaux détectés)

ÉTAPE 2 — IDENTIFIER LES ENJEUX ET SIGNAUX
Analyser les données web pour extraire :
- Projets de transformation IT en cours ou planifiés
- Technologies dominantes (stack technique)
- Recrutements en cours (indicateur de budget et d'urgence)
- Partenariats technologiques récents
- Contraintes réglementaires (NIS2, DORA, RGPD, LPM si applicable)
- Nominations récentes (nouveau DSI, CTO, CDO = fenêtre d'opportunité)
- Budget IT estimé (% du CA si détectable)

ÉTAPE 3 — SCORER ET PRIORISER
Calculer un score de priorité (1-10) selon ces critères pondérés :
| Critère | Poids |
| Urgence du besoin (projet actif vs futur) | 25% |
| Accessibilité des décideurs | 20% |
| Absence/faiblesse de la concurrence ESN | 20% |
| Alignement avec les offres de l'ESN | 20% |
| Potentiel CA (taille du chantier estimé) | 15% |

ÉTAPE 4 — IDENTIFIER LES ANGLES D'ATTAQUE
Pour chaque angle, définir :
- Le chantier/projet ciblé
- Le contact d'entrée (opérationnel) → le chemin d'escalade (décideur)
- La proposition de valeur spécifique (lien avec les offres de l'ESN)
- Les risques et les objections possibles

ÉTAPE 5 — CONSTRUIRE LE PLAN D'ACTION
Adapter le plan selon le cycle de vente de l'ESN :
- Chaque semaine = actions concrètes assignables
- Chaque action = un verbe + une cible + un canal (email, LinkedIn, téléphone) + responsable suggéré + outil + deadline + KPI
- Intégrer des points de décision : si réponse → action A, si silence → action B
- Différencier PME/ETI (actions directes, cycle court) vs grand groupe (référencement, multi-thread)
- S'appuyer sur la BASE DE CONNAISSANCES ESN (RAG) et l'historique du compte pour ne pas répéter ce qui a déjà été fait

ÉTAPE 6 — ENGAGEMENT DE CROISSANCE
- Évaluer le potentiel d'engagement : GO / NO GO avec justification
- Recommandation explicite : prioritaire ou non, selon les réponses au questionnaire (défi principal, cible, ESN en place)
- Si l'utilisateur a renseigné un service ESN prioritaire, une cible ou un historique, ces éléments doivent apparaître explicitement dans les recommandations

══════════════════════════════════════
CARTOGRAPHIE DES CONTACTS
══════════════════════════════════════

Pour chaque contact identifié, classifier selon :
- SPONSOR : Décideur final, signe le budget. C-level (DSI, CTO, VP).
- CHAMPION : Porteur du projet en interne, convaincu de la valeur. Souvent N-1 du sponsor.
- OPERATIONAL : Utilisateur final, tech lead, chef de projet. Point d'entrée le plus accessible.
- PURCHASING : Direction achats, responsable référencement. Passage obligé pour les grands comptes.
- INFLUENCER : Expert interne, architecte, RSSI. N'achète pas mais influence le choix.
- BLOCKER : Personne qui peut bloquer la vente. Souvent l'ESN concurrente en place ou un décideur hostile.

Priorisation des contacts :
- Priorité 1 : champions et opérationnels accessibles (premier contact)
- Priorité 2 : sponsors et influenceurs (escalade après validation opérationnelle)
- Priorité 3 : achats (une fois le besoin qualifié et le sponsor identifié)

Exclure systématiquement les personas définis dans excludedPersonas de l'utilisateur.

══════════════════════════════════════
MESSAGES COMMERCIAUX
══════════════════════════════════════

Chaque message doit :
1. Mentionner un signal ou enjeu SPÉCIFIQUE du compte (pas un message générique)
2. Faire le lien avec une offre PRÉCISE de l'ESN
3. Proposer un appel/RDV de 15 min (pas plus)
4. Être court : email < 150 mots, LinkedIn < 100 mots
5. Adapter le ton selon le style commercial de l'ESN :
   - "formal" → Vouvoiement, ton institutionnel
   - "direct" → Vouvoiement mais ton orienté valeur, droit au but
   - "challenger" → Vouvoiement avec une question provocante ou un insight

Email de premier contact :
- Objet : [Signal détecté] + [Offre ESN] (ex: "Migration cloud SocGen — profils certifiés AWS")
- Corps : 1 phrase d'accroche (signal) + 1 phrase de valeur (offre) + 1 CTA (15 min de call)

Message LinkedIn :
- Max 300 caractères
- Personnalisé au profil du contact (son poste, pas juste l'entreprise)
- Pas de "Je me permets de..." → direct

Message de relance (J+5) :
- Référencer le premier message
- Ajouter un élément de valeur (référence client, insight sectoriel)
- Nouveau CTA

══════════════════════════════════════
ANTI-HALLUCINATION — RÈGLES ABSOLUES
══════════════════════════════════════

- Chaque donnée produite est associée à sa source dans les données fournies.
- Si une information n'est PAS dans les données web fournies → "Non détecté".
- Ne cite JAMAIS un chiffre CA, budget IT ou TJM sans l'avoir trouvé dans les données.
- Les contacts sont des profils RÉALISTES basés sur les données web. Indique qu'ils sont "profils types suggérés" si pas de vrais noms trouvés dans les données.
- Si les données sont insuffisantes pour une section → l'indiquer clairement et proposer des actions de recherche manuelle.
- DISTINGUE systématiquement :
  • Fait vérifié → donnée trouvée dans les sources web
  • Signal faible → déduit d'une offre d'emploi ou d'un article indirect → préfixé par "Signal :"
  • Inconnu → "Non détecté — recherche manuelle recommandée"

══════════════════════════════════════
FORMAT DE SORTIE — JSON STRICT
══════════════════════════════════════

Réponds UNIQUEMENT en JSON valide. Pas de texte avant/après. Pas de backticks markdown.
Tous les textes en français.

RÈGLES SUR LE NOM DE L'ENTREPRISE (affichage uniquement — ne jamais faire échouer l'analyse) :
- Si le nom contient une faute d'orthographe, corrige-le silencieusement et mets le nom corrigé dans "companyNameCorrected".
- Si le nom est ambigu, choisis la plus grande/connue et indique-la dans "companyNameCorrected".
- Tu dois TOUJOURS retourner un JSON complet et valide. Même si le nom est mal orthographié ou peu reconnu, produis une analyse "best effort" avec les données disponibles.
- "notFound": true uniquement si vraiment aucune entreprise ne correspond ; dans ce cas mets "suggestions": [2-3 noms proches] et remplis quand même sector, contacts, angles, actionPlan avec des valeurs plausibles (ex. secteur "Non identifié", contacts types). Ne laisse jamais de champs vides qui feraient échouer le parsing.`

  const userPrompt = `Analyse le compte "${companyName}".
${ragContext ? `\nBASE DE CONNAISSANCES ESN (à utiliser pour adapter le plan et éviter de répéter ce qui a déjà été fait) :\n${ragContext}\n` : ''}

DONNÉES WEB (Brave Search) — utilise TOUS les résultats pour sourcer tes réponses :
${JSON.stringify(braveResults.results?.slice(0, 15), null, 2)}

CONTENU SCRAPÉ (Firecrawl) — utilise l'intégralité pour extraire noms de programmes/projets, filiales, BU, signaux :
${scrapedContent.slice(0, 22000)}

INSTRUCTIONS OBLIGATOIRES :
1. NE GÉNÈRE PAS de contacts dans cette réponse (ils seront générés dans un appel séparé). Concentre-toi sur une analyse EXHAUSTIVE du compte avec un maximum de détails.
2. Toutes les données scrapées doivent apparaître dans le rendu : ne pas se limiter à une sélection partielle. Extraire et afficher explicitement les noms de programmes et de projets détectés (champ programNames).
3. Cartographie exhaustive : lister TOUTES les entités du groupe (filiales, BU, start-ups internes), pas seulement le groupe global (champ entitiesExhaustive).
4. Le plan d'actions doit être construit sur la base du questionnaire onboarding et de la mémoire RAG — pas de manière générique. Si ESN prioritaire, cible ou historique sont renseignés, ils doivent apparaître dans les recommandations.
5. Produis les 4 sections dédiées : commentOuvrirCompte, offresAConstruire, planHebdomadaire, evaluationCompte (GO/NO GO avec justification).
6. Chaque action du plan doit avoir : responsable suggéré, outil, deadline, KPI. Actions graduelles et séquencées selon la méthodologie (fiche identité → parties prenantes → besoins → concurrents → scoring → actions).

Produis un JSON avec EXACTEMENT la structure suivante (tous les champs sont requis, utiliser [] ou "" si non détecté). N'inclure PAS de tableau "contacts" :
{
  "companyNameCorrected": "Nom exact et correct de l'entreprise",
  "notFound": false,
  "suggestions": [],
  "sector": "Secteur d'activité",
  "employees": "Nombre approximatif",
  "revenue": "CA approximatif",
  "headquarters": "Ville du siège",
  "website": "URL du site",
  "subsidiaries": ["Filiale 1", "Filiale 2"],
  "programNames": ["Nom programme ou projet détecté dans offres d'emploi / web"],
  "entitiesExhaustive": [{"name": "Nom entité", "type": "filiale|BU|startup_interne|groupe", "parent": "Parent si applicable"}],
  "itChallenges": ["Enjeu 1", "Enjeu 2", "Enjeu 3", "Enjeu 4"],
  "recentSignals": ["Signal 1", "Signal 2", "Signal 3", "Signal 4"],
  "priorityScore": 7,
  "priorityJustification": "Justification du score",
  "angles": [
    {"title": "Angle 1 — Titre", "description": "Description", "entry": "Point d'entrée → escalade"}
  ],
  "actionPlan": {
    "strategyType": "bottom_up",
    "strategyJustification": "Justification",
    "weeks": [
      {"week": 1, "title": "Premier contact", "items": [{"text": "Action", "done": false, "responsable": "Rôle", "outil": "Email/LinkedIn/Tel", "deadline": "J+3", "kpi": "Taux ouverture"}]},
      {"week": 2, "title": "Relances", "items": [{"text": "Action", "done": false, "responsable": "", "outil": "", "deadline": "", "kpi": ""}]},
      {"week": 3, "title": "Proposition", "items": [{"text": "Action", "done": false, "responsable": "", "outil": "", "deadline": "", "kpi": ""}]},
      {"week": 4, "title": "Escalade/pivot", "items": [{"text": "Action", "done": false, "responsable": "", "outil": "", "deadline": "", "kpi": ""}]}
    ]
  },
  "commentOuvrirCompte": {
    "strategy": "Stratégie d'entrée détaillée selon profil (taille, public/privé, référencement, ESN en place)",
    "entryPoints": [{"label": "Porte d'entrée", "justification": "Pourquoi"}]
  },
  "offresAConstruire": {
    "offers": [{"offer": "Offre ESN à proposer", "order": 1, "interlocutor": "Pour quel contact", "pitch": "Argumentaire adapté"}]
  },
  "planHebdomadaire": {
    "methodology": "Fiche identité → parties prenantes → besoins → concurrents → scoring → actions",
    "weeks": [{"week": 1, "theme": "Thème", "actions": ["Action 1", "Action 2"]}]
  },
  "evaluationCompte": {
    "goNoGo": "GO ou NO GO",
    "scoreGlobal": 7,
    "justification": "Justification claire basée sur données et questionnaire",
    "recommandation": "Compte prioritaire ou non, prochaines étapes"
  }
}

Génère :
- 3-5 angles d'attaque classés par score de priorité
- Un plan d'action de 4 à 8 semaines (adapté au cycle de vente de l'ESN)`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(120000),
    })

    const data = await res.json()
    const text = data.content?.[0]?.text || '{}'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsed: any
    try {
      parsed = JSON.parse(clean)
    } catch (parseError) {
      console.error(JSON.stringify({
        event: 'claude_parse_error',
        traceId,
        rawLength: text.length,
        rawFirst500: text.slice(0, 500),
        rawLast200: text.slice(-200),
        parseErrorMessage: parseError instanceof Error ? parseError.message : 'unknown',
      }))
      return generateFallbackAnalysis(companyName, onboardingData)
    }

    if (!parsed.sector && !parsed.itChallenges) {
      console.error(JSON.stringify({ event: 'claude_missing_fields', traceId, keys: Object.keys(parsed) }))
      return generateFallbackAnalysis(companyName, onboardingData)
    }

    parsed.subsidiaries = Array.isArray(parsed.subsidiaries) ? parsed.subsidiaries : []
    parsed.programNames = Array.isArray(parsed.programNames) ? parsed.programNames : []
    parsed.entitiesExhaustive = Array.isArray(parsed.entitiesExhaustive) ? parsed.entitiesExhaustive : []
    parsed.itChallenges = Array.isArray(parsed.itChallenges) ? parsed.itChallenges : []
    parsed.recentSignals = Array.isArray(parsed.recentSignals) ? parsed.recentSignals : []
    parsed.contacts = Array.isArray(parsed.contacts) ? parsed.contacts : []
    parsed.angles = Array.isArray(parsed.angles) ? parsed.angles : []
    parsed.priorityScore = Math.min(10, Math.max(1, parseInt(parsed.priorityScore) || 5))
    if (parsed.actionPlan && !Array.isArray(parsed.actionPlan.weeks)) parsed.actionPlan.weeks = []
    parsed.commentOuvrirCompte = parsed.commentOuvrirCompte && typeof parsed.commentOuvrirCompte === 'object' ? parsed.commentOuvrirCompte : { strategy: '', entryPoints: [] }
    parsed.offresAConstruire = parsed.offresAConstruire && typeof parsed.offresAConstruire === 'object' ? parsed.offresAConstruire : { offers: [] }
    parsed.planHebdomadaire = parsed.planHebdomadaire && typeof parsed.planHebdomadaire === 'object' ? parsed.planHebdomadaire : { methodology: '', weeks: [] }
    parsed.evaluationCompte = parsed.evaluationCompte && typeof parsed.evaluationCompte === 'object' ? parsed.evaluationCompte : { goNoGo: '', scoreGlobal: 5, justification: '', recommandation: '' }
    parsed.companyNameCorrected = parsed.companyNameCorrected || companyName
    parsed.notFound = !!parsed.notFound
    parsed.suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
    return parsed
  } catch (err) {
    console.error(JSON.stringify({ event: 'claude_analysis_error', traceId, error: err instanceof Error ? err.message : 'unknown' }))
    return generateFallbackAnalysis(companyName, onboardingData)
  }
}

// ============================================
// GÉNÉRATION CONTACTS (2ème APPEL CLAUDE)
// ============================================
async function generateContactsWithClaude(
  companyName: string,
  accountAnalysis: any,
  onboardingData: any,
  traceId: string
): Promise<any[]> {
  if (!ANTHROPIC_API_KEY) {
    console.log(JSON.stringify({ event: 'generate_contacts_no_key', traceId }))
    return []
  }

  console.log(JSON.stringify({ event: 'generate_contacts_start', traceId, companyName }))

  const systemPrompt = `Tu es BELLUM, expert en prospection B2B pour les ESN.
Génère des contacts réalistes pour la prospection d'un compte.

PROFIL ESN :
- Offres : ${JSON.stringify(onboardingData.offers || [])}
- Personas cibles : ${JSON.stringify(onboardingData.personas || [])}
- Taille : ${onboardingData.size || 'Non renseignée'}
- TJM : ${onboardingData.avgTJM || 'Non renseigné'}

COMPTE :
- Nom : ${companyName}
- Secteur : ${accountAnalysis.sector || 'Non détecté'}
- Effectifs : ${accountAnalysis.employees || 'Non détecté'}
- Enjeux IT : ${JSON.stringify(accountAnalysis.itChallenges || [])}
- Signaux : ${JSON.stringify(accountAnalysis.recentSignals || [])}
- Filiales : ${JSON.stringify(accountAnalysis.subsidiaries || [])}

RÈGLES :
- Génère EXACTEMENT 15 contacts variés
- Couvre les niveaux : C-level, middle management, opérationnels, achats
- Chaque contact a un email, un message LinkedIn et une relance
- Les messages mentionnent un enjeu SPÉCIFIQUE du compte
- Utilise des noms fictifs réalistes pour une entreprise française
- Réponds UNIQUEMENT en JSON valide, un tableau d'objets`

  const userPrompt = `Génère 15 contacts pour ${companyName}.
Chaque contact :
{
  "name": "Prénom Nom",
  "title": "Poste",
  "entity": "Filiale/BU",
  "role": "sponsor|champion|operational|purchasing|influencer",
  "priority": 1,
  "summary": "Résumé 2 phrases",
  "whyContact": "Pourquoi le contacter",
  "email": "prenom.nom@domaine.com",
  "linkedin": "linkedin.com/in/prenomnom",
  "emailMessage": {"subject": "Objet", "body": "Corps"},
  "linkedinMessage": "Message LinkedIn",
  "followupMessage": {"subject": "RE: Objet", "body": "Relance"}
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(90000),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(JSON.stringify({ event: 'generate_contacts_http_error', traceId, status: res.status, body: errText.slice(0, 300) }))
      return []
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || '[]'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    const contacts = JSON.parse(clean)
    console.log(JSON.stringify({ event: 'generate_contacts_success', traceId, count: Array.isArray(contacts) ? contacts.length : 0 }))
    return Array.isArray(contacts) ? contacts : []
  } catch (err) {
    console.error(JSON.stringify({ event: 'generate_contacts_error', traceId, error: err instanceof Error ? err.message : String(err) }))
    return []
  }
}

// ============================================
// SCRAPING LINKEDIN VIA APIFY
// ============================================

/**
 * Étape 5a — Scraper la page entreprise LinkedIn (description, effectifs, filiales, spécialités)
 */
async function scrapeLinkedInCompany(companyName: string, traceId: string): Promise<any> {
  if (!APIFY_API_TOKEN) return null
  try {
    const actorId = 'curious_coder~linkedin-company-scraper'
    const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: [companyName],
        maxResults: 1,
        includeEmployees: false,
      }),
      signal: AbortSignal.timeout(10000),
    })
    const runData = await runRes.json()
    const runId = runData?.data?.id
    if (!runId) return null

    let status = 'RUNNING'
    let attempts = 0
    while (status === 'RUNNING' && attempts < 40) {
      await new Promise(r => setTimeout(r, 3000))
      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`,
        { signal: AbortSignal.timeout(5000) }
      )
      const statusData = await statusRes.json()
      status = statusData?.data?.status || 'FAILED'
      attempts++
    }

    if (status !== 'SUCCEEDED') return null

    const datasetRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const items = await datasetRes.json()
    return items?.[0] || null
  } catch (err) {
    console.error(JSON.stringify({ event: 'apify_company_error', traceId, error: err instanceof Error ? err.message : 'unknown' }))
    return null
  }
}

/**
 * Étape 5b — Scraper les contacts LinkedIn en masse (200+, 8 requêtes, 20 pages/requête)
 */
async function scrapeLinkedInPeople(
  companyName: string,
  onboardingData: any,
  maxContacts: number = 200,
  traceId?: string
): Promise<any[]> {
  if (!APIFY_API_TOKEN) return []
  try {
    const personas = onboardingData.personas || ['DSI / CTO', 'Directeur de projet', 'Achats IT']
    const excludedPersonas = onboardingData.excludedPersonas ?? ['Stagiaires', 'Marketing']

    const searchQueries: string[] = [
      `DSI OR CTO OR "Chief Technology" OR "Chief Information" OR "VP Engineering" OR "Directeur Systèmes" "${companyName}"`,
      `"Head of" OR "Director" OR "Responsable" IT OR Data OR Cloud OR Digital "${companyName}"`,
      `"Chef de projet" OR "Project Manager" OR "Tech Lead" OR "Engineering Manager" "${companyName}"`,
      `"Achats IT" OR "Procurement" OR "Sourcing" OR "Directeur Achats" "${companyName}"`,
      `"RSSI" OR "CISO" OR "Sécurité" OR "Conformité" OR "Risk" "${companyName}"`,
      `"CDO" OR "Chief Data" OR "Head of Data" OR "Data Engineer" OR "ML Engineer" "${companyName}"`,
      `"Transformation" OR "Innovation" OR "Digital" OR "CDO" "${companyName}"`,
    ]
    for (const persona of personas) {
      const cleanPersona = persona.replace(/\//g, ' OR ').replace(/DSI/g, '"DSI"').replace(/CTO/g, '"CTO"').replace(/CDO/g, '"CDO"')
      if (!searchQueries.some(q => q.includes(cleanPersona))) {
        searchQueries.push(`${cleanPersona} "${companyName}"`)
      }
    }
    const finalQueries = searchQueries.slice(0, 8)

    const actorId = 'curious_coder~linkedin-people-search'
    const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: finalQueries,
        maxResults: Math.ceil(maxContacts / finalQueries.length),
        maxPages: 20,
      }),
      signal: AbortSignal.timeout(10000),
    })
    const runData = await runRes.json()
    const runId = runData?.data?.id
    if (!runId) return []

    let status = 'RUNNING'
    let attempts = 0
    while (status === 'RUNNING' && attempts < 60) {
      await new Promise(r => setTimeout(r, 3000))
      const statusRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`,
        { signal: AbortSignal.timeout(5000) }
      )
      const statusData = await statusRes.json()
      status = statusData?.data?.status || 'FAILED'
      attempts++
    }

    if (status !== 'SUCCEEDED') return []

    const datasetRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}&limit=500`,
      { signal: AbortSignal.timeout(15000) }
    )
    const items: any[] = await datasetRes.json()

    const excludeKeywords = [
      'stagiaire', 'intern', 'alternant', 'apprenti',
      'student', 'étudiant', 'freelance', 'indépendant',
      'consultant chez capgemini', 'consultant chez sopra',
      'consultant chez atos', 'consultant chez accenture',
    ]
    const filtered = items.filter((item: any) => {
      const title = (item.title || item.headline || '').toLowerCase()
      const name = (item.fullName || item.name || '').toLowerCase()
      const isExcluded = excludedPersonas.some((excluded: string) => title.includes(excluded.toLowerCase()))
      if (isExcluded) return false
      if (excludeKeywords.some(kw => title.includes(kw))) return false
      if (!name || name.length < 3) return false
      return true
    })

    const seen = new Set<string>()
    const unique = filtered.filter((item: any) => {
      const name = (item.fullName || item.name || '').toLowerCase().trim()
      if (seen.has(name)) return false
      seen.add(name)
      return true
    })

    const sorted = unique.sort((a: any, b: any) => contactRelevanceScore(b) - contactRelevanceScore(a))
    return sorted.slice(0, maxContacts)
  } catch (err) {
    console.error(JSON.stringify({ event: 'apify_people_error', traceId: traceId || 'n/a', error: err instanceof Error ? err.message : 'unknown' }))
    return []
  }
}

function contactRelevanceScore(contact: any): number {
  const title = (contact.title || contact.headline || '').toLowerCase()
  let score = 0
  if (/\b(dsi|cto|cio|cdo|ciso|vp|chief|directeur général)\b/.test(title)) score += 10
  if (/\b(directeur|director|head of|responsable|manager)\b/.test(title)) score += 7
  if (/\b(chef de projet|project manager|tech lead|lead|architecte)\b/.test(title)) score += 5
  if (/\b(achat|procurement|sourcing|purchasing)\b/.test(title)) score += 6
  if (/\b(it|si|data|cloud|cyber|sécurité|digital|transformation)\b/.test(title)) score += 3
  return score
}

/**
 * Étape 4c — Mapper les contacts LinkedIn vers le format Bellum
 * + Demander à Claude de les enrichir (rôle décisionnel, priorité, pourquoi les contacter)
 */
async function enrichLinkedInContactsWithClaude(
  linkedinContacts: any[],
  companyName: string,
  accountAnalysis: any,
  onboardingData: any,
  traceId: string
): Promise<any[]> {
  if (!ANTHROPIC_API_KEY || linkedinContacts.length === 0) {
    return linkedinContacts.map((c, i) => ({
      name: c.fullName || c.name || `Contact ${i + 1}`,
      title: c.title || c.headline || null,
      entity: c.company || companyName,
      role: 'unknown',
      priority: 3,
      summary: c.summary || c.headline || null,
      whyContact: null,
      email: c.email || null,
      phone: c.phone || null,
      linkedin: c.linkedinUrl || c.profileUrl || c.url || null,
      emailMessage: null,
      linkedinMessage: null,
      followupMessage: null,
    }))
  }

  // PROMPT 2 — ENRICHISSEMENT CONTACTS (BELLUM)
  const systemPrompt = `Tu es BELLUM, l'agent d'intelligence commerciale de BellumAI.
Tu reçois une liste de contacts LinkedIn scrappés d'un compte cible.
Ta mission : qualifier chaque contact, déterminer son rôle dans le processus d'achat, et produire des messages de prospection ultra-personnalisés.

══════════════════════════════════════
PROFIL DE L'ESN UTILISATRICE
══════════════════════════════════════
- Nom : ${onboardingData.esnName || 'Non renseigné'}
- Taille : ${onboardingData.size || 'Non renseignée'}
- Offres : ${JSON.stringify(onboardingData.offers || [])}
- Secteurs cibles : ${JSON.stringify(onboardingData.sectors || [])}
- Personas cibles : ${JSON.stringify(onboardingData.personas || [])}
- TJM moyen : ${onboardingData.avgTJM || 'Non renseigné'}
- Style commercial : ${onboardingData.style || 'direct'}
- Personas à exclure : ${JSON.stringify(onboardingData.excludedPersonas || [])}
- Références clients : ${JSON.stringify(onboardingData.references || [])}

══════════════════════════════════════
CONTEXTE DU COMPTE ANALYSÉ
══════════════════════════════════════
- Enjeux IT identifiés : ${JSON.stringify(accountAnalysis.itChallenges || [])}
- Signaux récents : ${JSON.stringify(accountAnalysis.recentSignals || [])}
- Angles d'attaque : ${JSON.stringify(accountAnalysis.angles?.map((a: any) => a.title) || [])}
- Score de priorité : ${accountAnalysis.priorityScore ?? 'N/A'}
- Secteur : ${accountAnalysis.sector || 'N/A'}

══════════════════════════════════════
RÈGLES DE QUALIFICATION
══════════════════════════════════════

CLASSIFICATION DES RÔLES :
- "sponsor" : Décideur final, contrôle le budget. DSI, CTO, VP Engineering, DG.
  → Priorité 2 (on ne contacte PAS en premier un sponsor, sauf si l'ESN est grande et référencée)
- "champion" : Porteur de projet en interne, Head of, Director. Souvent le meilleur allié.
  → Priorité 1
- "operational" : Chef de projet, tech lead, engineering manager. Point d'entrée naturel.
  → Priorité 1
- "purchasing" : Direction achats, procurement. Passage obligé pour le référencement.
  → Priorité 3 (contacter APRÈS avoir un sponsor ou champion identifié)
- "influencer" : Expert technique, architecte, RSSI. Influence le choix sans décider.
  → Priorité 2
- "blocker" : Personne susceptible de bloquer (consultant ESN concurrente en place, etc.)
  → Priorité 5 (ne pas contacter directement, mais surveiller)

FILTRAGE :
- EXCLURE tout contact dont le poste correspond aux personas exclus par l'utilisateur
- EXCLURE les stagiaires, alternants, apprentis, interns
- EXCLURE les personnes qui ne sont plus en poste (vérifier l'entité si possible)
- PRIORISER les contacts dont le poste correspond aux personas cibles de l'utilisateur

ADAPTATION SELON LA TAILLE DE L'ESN :
- Si l'ESN a "1 - 20 consultants" → NE PAS mettre les DSI/CTO de grands groupes en priorité 1. Commencer par les opérationnels et champions. Le DSI ne prendra pas de RDV avec une ESN de 15 personnes qu'il ne connaît pas.
- Si l'ESN a "200+ consultants" → Le DSI est accessible. Mettre les sponsors en priorité 1-2.

══════════════════════════════════════
RÈGLES DE MESSAGES
══════════════════════════════════════

Pour CHAQUE contact, générer 3 messages :

1. EMAIL DE PREMIER CONTACT :
   - Objet : [Enjeu identifié du compte] + [Lien avec l'offre ESN] (max 60 caractères)
   - Corps : max 150 mots
   - Structure : Accroche personnalisée (poste/projet du contact) → Proposition de valeur → CTA (15 min de call)
   - Ton : adapté au style commercial de l'ESN

2. MESSAGE LINKEDIN :
   - Max 300 caractères (c'est une demande de connexion ou un InMail)
   - Hyper-personnalisé au PROFIL du contact (pas au compte)
   - Mention d'un point commun ou d'un intérêt partagé si possible
   - Pas de "Je me permets de vous contacter" → DIRECT

3. RELANCE J+5 :
   - Objet : "RE: [objet original]"
   - Corps : max 80 mots
   - Référencer le premier message + ajouter un élément de valeur nouveau (référence client, insight, actualité)
   - Nouveau CTA

══════════════════════════════════════
FORMAT DE SORTIE — JSON STRICT
══════════════════════════════════════

Réponds UNIQUEMENT en JSON valide. Un tableau d'objets. Pas de texte avant/après.`

  const contactsList = linkedinContacts.slice(0, 50).map(c => ({
    name: c.fullName || c.name,
    title: c.title || c.headline,
    company: c.company || companyName,
    linkedin: c.linkedinUrl || c.profileUrl || c.url,
    summary: c.summary,
  }))

  const userPrompt = `Enrichis ces ${contactsList.length} contacts LinkedIn pour le compte "${companyName}" :

${JSON.stringify(contactsList, null, 2)}

Retourne un tableau JSON :
[
  {
    "name": "Prénom Nom",
    "title": "Poste",
    "entity": "BU/Filiale",
    "role": "sponsor",
    "priority": 1,
    "summary": "Résumé",
    "whyContact": "Pourquoi",
    "email": null,
    "phone": null,
    "linkedin": "url",
    "emailMessage": {"subject": "Objet", "body": "Corps"},
    "linkedinMessage": "Message court",
    "followupMessage": {"subject": "RE: Objet", "body": "Relance"}
  }
]`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 12000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(120000),
    })

    const data = await res.json()
    const text = data.content?.[0]?.text || '[]'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch (error) {
    console.error(JSON.stringify({ event: 'claude_enrichment_error', traceId, error: error instanceof Error ? error.message : 'unknown' }))
    return linkedinContacts.map((c, i) => ({
      name: c.fullName || c.name || `Contact ${i + 1}`,
      title: c.title || c.headline || null,
      entity: c.company || companyName,
      role: 'unknown',
      priority: 3,
      summary: c.summary || null,
      whyContact: null,
      email: null,
      phone: null,
      linkedin: c.linkedinUrl || c.profileUrl || c.url || null,
      emailMessage: null,
      linkedinMessage: null,
      followupMessage: null,
    }))
  }
}

// ============================================
// FALLBACK — données de démo quand pas de clés API
// ============================================
function generateFallbackAnalysis(companyName: string, onboardingData: any) {
  const offers = onboardingData.offers || ['Développement', 'Data & IA']
  const mainOffer = offers[0] || 'IT'

  return {
    sector: 'Technologie & Services',
    employees: '~5 000 collaborateurs',
    revenue: '~800 M€',
    headquarters: 'Paris, France',
    website: `${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
    subsidiaries: ['Filiale Consulting', 'Filiale Cloud', 'Filiale Data'],
    itChallenges: [
      'Modernisation du SI legacy',
      'Migration cloud multi-provider',
      'Programme data & IA',
      'Cybersécurité et conformité',
    ],
    recentSignals: [
      'Recrutement massif en ingénieurs cloud (2026)',
      'Nomination d\'un nouveau CTO',
      'Partenariat stratégique cloud annoncé',
      'Budget IT en hausse de 15%',
    ],
    priorityScore: 7,
    priorityJustification: `[MODE DÉMO] Compte généré automatiquement. Connectez vos API (Brave, Firecrawl, Claude, Apify) dans Supabase > Edge Functions > Secrets pour des résultats réels.`,
    contacts: [
      {
        name: 'Jean Martin', title: 'DSI', entity: 'Groupe', role: 'sponsor', priority: 1,
        summary: 'Directeur des SI du groupe.', whyContact: 'Décideur principal.',
        email: `j.martin@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: '06 12 34 56 78', linkedin: 'linkedin.com/in/jmartin',
        emailMessage: { subject: `${companyName} — expertise ${mainOffer}`, body: `Bonjour Jean,\n\nNous accompagnons des entreprises comme ${companyName} sur leurs enjeux ${mainOffer}.\n\nSeriez-vous ouvert à un échange de 15 min ?\n\nCordialement` },
        linkedinMessage: `Jean, vos enjeux ${mainOffer} chez ${companyName} m'interpellent — ouvert à un échange ?`,
        followupMessage: { subject: `RE: ${companyName} — expertise ${mainOffer}`, body: 'Je me permets de revenir vers vous — avez-vous 15 min cette semaine ?' },
      },
      {
        name: 'Sophie Dubois', title: 'Head of Data', entity: 'Groupe', role: 'champion', priority: 1,
        summary: 'Responsable data du groupe.', whyContact: 'Porte les projets data.',
        email: `s.dubois@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: '06 98 76 54 32', linkedin: 'linkedin.com/in/sdubois',
        emailMessage: { subject: `Profils data pour ${companyName}`, body: `Bonjour Sophie,\n\nNous avons des profils data expérimentés disponibles.\n\nPartante pour un échange ?\n\nCordialement` },
        linkedinMessage: `Sophie, votre programme data m'intéresse — on en parle ?`,
        followupMessage: { subject: `RE: Profils data`, body: 'Un de nos profils vient de terminer une mission similaire. Intéressée ?' },
      },
      {
        name: 'Marc Bernard', title: 'Dir. Achats IT', entity: 'Groupe', role: 'purchasing', priority: 2,
        summary: 'Gère le référencement fournisseurs.', whyContact: 'Passage obligé pour le référencement.',
        email: `m.bernard@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: '01 42 14 20 00', linkedin: 'linkedin.com/in/mbernard',
        emailMessage: { subject: `Référencement prestation ${mainOffer}`, body: `Bonjour Marc,\n\nNous souhaiterions être référencés pour vos besoins en ${mainOffer}.\n\nCordialement` },
        linkedinMessage: `Marc, nous intervenons en ${mainOffer} — comment fonctionne votre référencement ?`,
        followupMessage: { subject: `RE: Référencement`, body: 'Je me permets de revenir vers vous concernant notre demande de référencement.' },
      },
      {
        name: 'Laurent Moreau', title: 'Resp. Programme Cloud', entity: 'DSI', role: 'operational', priority: 2,
        summary: 'Pilote la migration cloud.', whyContact: 'Besoin immédiat en profils cloud.',
        email: `l.moreau@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: '06 11 22 33 44', linkedin: 'linkedin.com/in/lmoreau',
        emailMessage: { subject: `Migration cloud ${companyName} — profils dispo`, body: `Bonjour Laurent,\n\nJ'ai vu votre programme cloud. On a des architectes certifiés AWS dispo.\n\nCordialement` },
        linkedinMessage: `Laurent, votre programme cloud m'interpelle — on a des profils dispo.`,
        followupMessage: { subject: `RE: Migration cloud`, body: 'Un de nos archi cloud vient de se libérer. Ça vous intéresserait ?' },
      },
      {
        name: 'Pierre Lefebvre', title: 'RSSI', entity: 'Groupe', role: 'influencer', priority: 2,
        summary: 'En charge conformité cyber.', whyContact: 'Budget dédié cybersécurité.',
        email: `p.lefebvre@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: '01 42 14 30 00', linkedin: 'linkedin.com/in/plefebvre',
        emailMessage: { subject: `Cybersécurité ${companyName}`, body: `Bonjour Pierre,\n\nLa conformité cyber est un sujet clé — on peut vous aider.\n\nCordialement` },
        linkedinMessage: `Pierre, vos enjeux cyber m'intéressent — ouvert à un échange ?`,
        followupMessage: { subject: `RE: Cybersécurité`, body: 'On accompagne plusieurs grands comptes sur DORA. Partant pour un call ?' },
      },
    ],
    angles: [
      { title: `Angle 1 — ${mainOffer}`, description: `Programme en cours, besoin de profils techniques ${mainOffer}.`, entry: `Équipe ${mainOffer} → DSI` },
      { title: 'Angle 2 — Cloud Migration', description: 'Migration cloud en cours, besoin d\'architectes.', entry: 'Resp. Cloud → Achats' },
      { title: 'Angle 3 — Cybersécurité', description: 'Conformité réglementaire, budget dédié.', entry: 'RSSI → Achats' },
    ],
    programNames: [],
    entitiesExhaustive: [{ name: 'Groupe', type: 'groupe', parent: null }, { name: 'DSI', type: 'BU', parent: 'Groupe' }],
    actionPlan: {
      strategyType: 'bottom_up',
      strategyJustification: 'Entrer par les opérationnels techniques, démontrer la valeur, puis escalader vers le DSI et les achats.',
      weeks: [
        { week: 1, title: 'Premier contact', items: [
          { text: 'Contacter Head of Data — Email + LinkedIn', done: false, responsable: 'Commercial', outil: 'Email', deadline: 'J+3', kpi: 'Taux ouverture' },
          { text: 'Envoyer demande connexion au DSI', done: false, responsable: '', outil: 'LinkedIn', deadline: '', kpi: '' },
          { text: 'Contacter Resp. Cloud — Email', done: false, responsable: '', outil: '', deadline: '', kpi: '' },
        ]},
        { week: 2, title: 'Relances + élargissement', items: [
          { text: 'Relance Head of Data si pas de réponse (J+5)', done: false, responsable: '', outil: '', deadline: '', kpi: '' },
          { text: 'Contacter DSI par email direct', done: false, responsable: '', outil: '', deadline: '', kpi: '' },
          { text: 'Engager Dir. Achats si réponse opérationnels', done: false, responsable: '', outil: '', deadline: '', kpi: '' },
        ]},
        { week: 3, title: 'Proposition de valeur', items: [
          { text: 'Envoyer proposition de profils si RDV obtenu', done: false, responsable: '', outil: '', deadline: '', kpi: '' },
          { text: 'Partager une référence client pertinente', done: false, responsable: '', outil: '', deadline: '', kpi: '' },
          { text: 'Proposer un call de 15 min aux répondants', done: false, responsable: '', outil: '', deadline: '', kpi: '' },
        ]},
        { week: 4, title: 'Escalade ou pivot', items: [
          { text: 'Si silence total → pivoter vers Angle 2', done: false, responsable: '', outil: '', deadline: '', kpi: '' },
          { text: 'Si conversation ouverte → fixer RDV qualification', done: false, responsable: '', outil: '', deadline: '', kpi: '' },
          { text: 'Si RDV obtenu → préparer le push profil', done: false, responsable: '', outil: '', deadline: '', kpi: '' },
        ]},
      ],
    },
    commentOuvrirCompte: { strategy: '[Démo] Adapter selon taille du compte et référencement.', entryPoints: [{ label: 'Opérationnels techniques', justification: 'Point d\'entrée le plus accessible.' }] },
    offresAConstruire: { offers: [{ offer: mainOffer, order: 1, interlocutor: 'Head of Data / Resp. Cloud', pitch: 'Profils disponibles, référence client.' }] },
    planHebdomadaire: { methodology: 'Fiche identité → parties prenantes → besoins → scoring → actions', weeks: [{ week: 1, theme: 'Premier contact', actions: ['Email + LinkedIn ciblés'] }, { week: 2, theme: 'Relances', actions: ['J+5'] }] },
    evaluationCompte: { goNoGo: 'GO', scoreGlobal: 7, justification: '[Démo] Compte généré automatiquement.', recommandation: 'Prioriser les contacts opérationnels.' },
  }
}


