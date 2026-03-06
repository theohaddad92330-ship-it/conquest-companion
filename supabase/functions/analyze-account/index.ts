import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// API Keys — configurées dans Supabase Dashboard > Edge Functions > Secrets
// En attendant les vraies clés, la fonction utilise un mode fallback
const BRAVE_API_KEY = Deno.env.get('BRAVE_API_KEY') || ''
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY') || ''
const PAPPERS_API_KEY = Deno.env.get('PAPPERS_API_KEY') || ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN') || ''

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Non authentifié')
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Non authentifié')

    const body = await req.json()
    const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : ''
    const userContext = typeof body?.userContext === 'string' ? body.userContext.slice(0, 2000) : null

    if (!companyName) throw new Error('companyName requis')
    if (companyName.length > 200) throw new Error('companyName trop long')

    // Vérifier le rate limit (anti-spam)
    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', { p_user_id: user.id, p_max_per_hour: 10 })
    if (rateLimitOk === false) {
      throw new Error('Trop de recherches en peu de temps. Attendez quelques minutes.')
    }

    // Vérifier ET consommer un crédit en une seule transaction
    const { data: creditOk } = await supabase.rpc('check_and_increment_accounts_used', { p_user_id: user.id })
    if (creditOk === false) {
      throw new Error('Limite de crédits atteinte. Passez à un plan supérieur.')
    }

    // Créer le compte en BDD
    const { data: account, error: insertError } = await supabase
      .from('accounts')
      .insert({ user_id: user.id, company_name: companyName, user_context: userContext || null, status: 'analyzing' })
      .select()
      .single()
    if (insertError) throw insertError

    // Récupérer le profil de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    const onboardingData = profile?.onboarding_data || {}

    // Lancer le traitement en arrière-plan
    EdgeRuntime.waitUntil(
      processAnalysis(supabase, account.id, user.id, companyName, userContext, onboardingData)
    )

    return new Response(
      JSON.stringify({ accountId: account.id, status: 'analyzing' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    const message = error?.message && typeof error.message === 'string' ? error.message : 'Erreur serveur'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================
// CHAÎNE D'ORCHESTRATION PRINCIPALE
// ============================================
async function processAnalysis(supabase: any, accountId: string, userId: string, companyName: string, userContext: string | null, onboardingData: any) {
  const traceId = crypto.randomUUID().slice(0, 8)
  console.log(JSON.stringify({ event: 'analysis_start', traceId, accountId, companyName, userId }))

  try {
    // ÉTAPE 1 — Recherche web
    const braveResults = await searchBrave(companyName)
    console.log(JSON.stringify({ event: 'brave_done', traceId, resultsCount: braveResults.results?.length || 0 }))

    // ÉTAPE 2 — Scraping pages
    const scrapedContent = await scrapePages(braveResults.urls?.slice(0, 5) || [])
    console.log(JSON.stringify({ event: 'firecrawl_done', traceId, contentLength: scrapedContent.length }))

    // ÉTAPE 3 — Données entreprise FR
    const pappersData = await searchPappers(companyName)
    console.log(JSON.stringify({ event: 'pappers_done', traceId, found: !!pappersData }))

    // Récupérer le contexte RAG
    const ragContext = await searchRAG(supabase, companyName)

    // ÉTAPE 4 — Analyse IA complète (Claude)
    const analysis = await analyzeWithClaude(companyName, braveResults, scrapedContent, pappersData, userContext, onboardingData, ragContext)
    console.log(JSON.stringify({ event: 'claude_done', traceId, contactsCount: analysis.contacts?.length || 0, anglesCount: analysis.angles?.length || 0 }))

    // Sauvegarder le compte enrichi
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

    // ===== ÉTAPE 5 — SCRAPING LINKEDIN (Apify) =====
    let finalContacts: any[] = []

    if (APIFY_API_TOKEN) {
      // 5a. Scraper la page entreprise (infos complémentaires)
      const companyData = await scrapeLinkedInCompany(companyName)
      
      // Si on a des infos complémentaires, mettre à jour le compte
      if (companyData) {
        const updates: any = {}
        if (companyData.employeeCount && !analysis.employees) {
          updates.employees = `~${companyData.employeeCount} collaborateurs`
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('accounts').update(updates).eq('id', accountId)
        }
      }

      // 5b. Scraper les contacts LinkedIn
      const linkedinContacts = await scrapeLinkedInPeople(companyName, onboardingData, 100)

      if (linkedinContacts.length > 0) {
        // 5c. Enrichir les contacts LinkedIn avec Claude (rôles, priorités, messages)
        finalContacts = await enrichLinkedInContactsWithClaude(
          linkedinContacts,
          companyName,
          analysis,
          onboardingData
        )
      } else {
        // Fallback : utiliser les contacts générés par l'analyse IA initiale
        finalContacts = analysis.contacts || []
      }
      console.log(JSON.stringify({ event: 'apify_done', traceId, linkedinContactsCount: finalContacts.length }))
    } else {
      // Pas d'Apify : utiliser les contacts IA
      finalContacts = analysis.contacts || []
    }

    // Sauvegarder les contacts (vrais LinkedIn ou IA)
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
          source: APIFY_API_TOKEN ? 'linkedin_apify' : 'ai_generated',
        }))
      )
    }

    // Sauvegarder les angles d'attaque
    if (analysis.angles?.length > 0) {
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

    // Sauvegarder le plan d'action
    if (analysis.actionPlan) {
      await supabase.from('action_plans').insert({
        account_id: accountId,
        user_id: userId,
        strategy_type: analysis.actionPlan.strategyType || 'multi_thread',
        strategy_justification: analysis.actionPlan.strategyJustification,
        weeks: analysis.actionPlan.weeks || [],
      })
    }

    // Estimation grossière des coûts après l'analyse
    const estimatedCost = 0.003 * (scrapedContent.length / 1000)
      + 0.005 * (braveResults.results?.length || 0)
      + 0.1
      + (APIFY_API_TOKEN ? 3.0 : 0)

    // Marquer le compte comme terminé + coût API
    await supabase.from('accounts').update({
      status: 'completed',
      api_cost_euros: estimatedCost,
    }).eq('id', accountId)

    console.log(JSON.stringify({ event: 'analysis_complete', traceId, accountId }))
  } catch (error: any) {
    console.error(JSON.stringify({ event: 'analysis_error', traceId, accountId, error: error.message }))
    await supabase.from('accounts').update({
      status: 'error',
      error_message: error.message,
    }).eq('id', accountId)
  }
}

// ============================================
// FONCTIONS API EXTERNES
// ============================================

async function searchBrave(query: string) {
  if (!BRAVE_API_KEY) return { results: [], urls: [] }
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query + ' actualités projets IT')}`, {
      headers: { 'X-Subscription-Token': BRAVE_API_KEY },
    })
    const data = await res.json()
    const results = data.web?.results?.slice(0, 10) || []
    return {
      results: results.map((r: any) => ({ title: r.title, description: r.description, url: r.url })),
      urls: results.map((r: any) => r.url),
    }
  } catch { return { results: [], urls: [] } }
}

async function scrapePages(urls: string[]) {
  if (!FIRECRAWL_API_KEY || urls.length === 0) return ''
  try {
    const contents: string[] = []
    for (const url of urls.slice(0, 3)) {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_API_KEY}` },
        body: JSON.stringify({ url, formats: ['markdown'] }),
      })
      const data = await res.json()
      if (data.data?.markdown) contents.push(data.data.markdown.slice(0, 3000))
    }
    return contents.join('\n\n---\n\n')
  } catch { return '' }
}

async function searchPappers(companyName: string) {
  if (!PAPPERS_API_KEY) return null
  try {
    const res = await fetch(`https://api.pappers.fr/v2/recherche?api_token=${PAPPERS_API_KEY}&q=${encodeURIComponent(companyName)}&par_page=1`)
    const data = await res.json()
    return data.resultats?.[0] || null
  } catch { return null }
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

async function analyzeWithClaude(companyName: string, braveResults: any, scrapedContent: string, pappersData: any, userContext: string | null, onboardingData: any, ragContext: string) {
  // Si pas de clé API Claude → mode fallback avec données de démo
  if (!ANTHROPIC_API_KEY) {
    return generateFallbackAnalysis(companyName, onboardingData)
  }

  // PROMPT_ANALYSE_COMPTE — le prompt principal qui génère TOUT
  const systemPrompt = `Tu es un expert en intelligence commerciale pour les ESN (Entreprises de Services du Numérique).
Tu analyses des comptes clients pour aider les commerciaux à préparer leur prospection.

PROFIL DE L'ESN :
- Nom : ${onboardingData.esnName || 'Non renseigné'}
- Taille : ${onboardingData.size || 'Non renseignée'}
- Offres : ${JSON.stringify(onboardingData.offers || [])}
- Secteurs cibles : ${JSON.stringify(onboardingData.sectors || [])}
- Personas cibles : ${JSON.stringify(onboardingData.personas || [])}
- Type de clients : ${JSON.stringify(onboardingData.clientType || [])}
- TJM moyen : ${onboardingData.avgTJM || 'Non renseigné'}
- Cycle de vente : ${onboardingData.salesCycle || 'Non renseigné'}
- Défi principal : ${onboardingData.mainChallenge || 'Non renseigné'}

${userContext ? `CONTEXTE UTILISATEUR : ${userContext}` : ''}

RÈGLES :
- Réponds UNIQUEMENT en JSON valide, sans texte avant/après, sans backticks markdown.
- Tous les textes en français.
- Personnalise les angles et messages par rapport aux offres de l'ESN.
- Les contacts doivent être des profils fictifs mais réalistes pour ce type d'entreprise.
- Les messages doivent être professionnels, personnalisés, et mentionner les offres de l'ESN.

RÈGLES SUR LE NOM DE L'ENTREPRISE :
- Si le nom saisi contient une faute d'orthographe évidente, corrige-le (ex : "Societe Generale" → "Société Générale", "Capgeminni" → "Capgemini", "bnp" → "BNP Paribas").
- Si le nom est ambigu et peut correspondre à plusieurs entreprises, choisis la plus grande ou la plus connue.
- Indique TOUJOURS le nom exact et correct dans le champ "companyNameCorrected".
- Si tu ne trouves AUCUNE entreprise correspondante dans les données fournies, mets "notFound": true et propose 2-3 suggestions dans "suggestions".`

  const userPrompt = `Analyse le compte "${companyName}".
${ragContext ? `\nBASE DE CONNAISSANCES ESN :\n${ragContext}\n` : ''}

DONNÉES WEB :
${JSON.stringify(braveResults.results?.slice(0, 5), null, 2)}

CONTENU SCRAPÉ :
${scrapedContent.slice(0, 8000)}

DONNÉES PAPPERS :
${JSON.stringify(pappersData, null, 2)}

Produis un JSON avec EXACTEMENT cette structure :
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
  "itChallenges": ["Enjeu 1", "Enjeu 2", "Enjeu 3", "Enjeu 4"],
  "recentSignals": ["Signal 1", "Signal 2", "Signal 3", "Signal 4"],
  "priorityScore": 7,
  "priorityJustification": "Justification du score",
  "contacts": [
    {
      "name": "Prénom Nom",
      "title": "Poste",
      "entity": "Filiale/BU",
      "role": "sponsor",
      "priority": 1,
      "summary": "Résumé profil",
      "whyContact": "Pourquoi le contacter",
      "email": "prenom.nom@entreprise.com",
      "phone": "06 XX XX XX XX",
      "linkedin": "linkedin.com/in/prenomnom",
      "emailMessage": {"subject": "Objet email", "body": "Corps email complet"},
      "linkedinMessage": "Message LinkedIn court",
      "followupMessage": {"subject": "RE: Objet", "body": "Corps relance"}
    }
  ],
  "angles": [
    {
      "title": "Angle 1 — Titre",
      "description": "Description de l'angle",
      "entry": "Point d'entrée → escalade"
    }
  ],
  "actionPlan": {
    "strategyType": "bottom_up",
    "strategyJustification": "Justification",
    "weeks": [
      {"week": 1, "title": "Premier contact", "items": [{"text": "Action", "done": false}]},
      {"week": 2, "title": "Relances", "items": [{"text": "Action", "done": false}]},
      {"week": 3, "title": "Proposition", "items": [{"text": "Action", "done": false}]},
      {"week": 4, "title": "Escalade/pivot", "items": [{"text": "Action", "done": false}]}
    ]
  }
}

Génère 5-8 contacts, 3 angles, et un plan de 4 semaines.`

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
  })

  const data = await res.json()
  const text = data.content?.[0]?.text || '{}'
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let parsed: any
  try {
    parsed = JSON.parse(clean)
  } catch (parseError) {
    console.error('Claude JSON parse error:', parseError)
    console.error('Raw response:', text.slice(0, 500))
    return generateFallbackAnalysis(companyName, onboardingData)
  }

  if (!parsed.sector && !parsed.itChallenges && !parsed.contacts) {
    console.error('Claude response missing critical fields:', Object.keys(parsed))
    return generateFallbackAnalysis(companyName, onboardingData)
  }

  parsed.subsidiaries = Array.isArray(parsed.subsidiaries) ? parsed.subsidiaries : []
  parsed.itChallenges = Array.isArray(parsed.itChallenges) ? parsed.itChallenges : []
  parsed.recentSignals = Array.isArray(parsed.recentSignals) ? parsed.recentSignals : []
  parsed.contacts = Array.isArray(parsed.contacts) ? parsed.contacts : []
  parsed.angles = Array.isArray(parsed.angles) ? parsed.angles : []
  parsed.priorityScore = Math.min(10, Math.max(1, parseInt(parsed.priorityScore) || 5))

  if (parsed.actionPlan && !Array.isArray(parsed.actionPlan.weeks)) {
    parsed.actionPlan.weeks = []
  }

  parsed.companyNameCorrected = parsed.companyNameCorrected || companyName
  parsed.notFound = !!parsed.notFound
  parsed.suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : []

  return parsed
}

// ============================================
// SCRAPING LINKEDIN VIA APIFY
// ============================================

/**
 * Étape 4a — Scraper la page entreprise LinkedIn
 * Récupère : description, nombre d'employés, filiales, spécialités
 */
async function scrapeLinkedInCompany(companyName: string): Promise<any> {
  if (!APIFY_API_TOKEN) return null
  try {
    const actorId = 'curious_coder~linkedin-company-scraper'
    
    const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: [companyName],
        maxResults: 1,
      }),
    })
    const runData = await runRes.json()
    const runId = runData?.data?.id
    if (!runId) return null

    let status = 'RUNNING'
    let attempts = 0
    while (status === 'RUNNING' && attempts < 30) {
      await new Promise(r => setTimeout(r, 3000))
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`)
      const statusData = await statusRes.json()
      status = statusData?.data?.status || 'FAILED'
      attempts++
    }

    if (status !== 'SUCCEEDED') return null

    const datasetRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`)
    const items = await datasetRes.json()
    return items?.[0] || null
  } catch (error) {
    console.error('Apify company scrape error:', error)
    return null
  }
}

/**
 * Étape 4b — Scraper les contacts LinkedIn du compte
 */
async function scrapeLinkedInPeople(
  companyName: string,
  onboardingData: any,
  maxContacts: number = 100
): Promise<any[]> {
  if (!APIFY_API_TOKEN) return []
  try {
    const personas = onboardingData.personas || ['DSI / CTO', 'Directeur de projet', 'Achats IT']
    const excludedPersonas = onboardingData.excludedPersonas || ['Stagiaires', 'Marketing']
    
    const searchQueries = personas.map((persona: string) => {
      const cleanPersona = persona
        .replace('DSI / CTO', 'DSI OR CTO OR "Directeur des Systèmes"')
        .replace('Directeur de projet', '"Directeur de projet" OR "Chef de projet"')
        .replace('Achats IT', '"Achats IT" OR "Directeur Achats"')
        .replace('CDO / Data', 'CDO OR "Chief Data" OR "Head of Data"')
        .replace('RSSI / Cyber', 'RSSI OR "Responsable Sécurité" OR CISO')
        .replace('DRH', 'DRH OR "Directeur RH"')
        .replace('Opérationnels IT', '"Responsable IT" OR "Manager IT" OR "Lead technique"')
        .replace('DAF', 'DAF OR "Directeur Financier" OR CFO')
      return `${cleanPersona} ${companyName}`
    })

    const actorId = 'curious_coder~linkedin-people-search'

    const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: searchQueries,
        maxResults: Math.ceil(maxContacts / Math.max(searchQueries.length, 1)),
      }),
    })
    const runData = await runRes.json()
    const runId = runData?.data?.id
    if (!runId) return []

    let status = 'RUNNING'
    let attempts = 0
    while (status === 'RUNNING' && attempts < 60) {
      await new Promise(r => setTimeout(r, 3000))
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`)
      const statusData = await statusRes.json()
      status = statusData?.data?.status || 'FAILED'
      attempts++
    }

    if (status !== 'SUCCEEDED') return []

    const datasetRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`)
    const items: any[] = await datasetRes.json()

    const filtered = items.filter((item: any) => {
      const title = (item.title || item.headline || '').toLowerCase()
      const isExcluded = excludedPersonas.some((excluded: string) =>
        title.includes(excluded.toLowerCase())
      )
      if (isExcluded) return false
      if (title.includes('stagiaire') || title.includes('intern') || title.includes('alternant') || title.includes('apprenti')) return false
      return true
    })

    const seen = new Set<string>()
    const unique = filtered.filter((item: any) => {
      const name = (item.fullName || item.name || '').toLowerCase()
      if (!name) return false
      if (seen.has(name)) return false
      seen.add(name)
      return true
    })

    return unique.slice(0, maxContacts)
  } catch (error) {
    console.error('Apify people search error:', error)
    return []
  }
}

/**
 * Étape 4c — Mapper les contacts LinkedIn vers le format Bellum
 * + Demander à Claude de les enrichir (rôle décisionnel, priorité, pourquoi les contacter)
 */
async function enrichLinkedInContactsWithClaude(
  linkedinContacts: any[],
  companyName: string,
  accountAnalysis: any,
  onboardingData: any
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

  const systemPrompt = `Tu es un expert en intelligence commerciale ESN.
Tu reçois une liste de contacts LinkedIn d'un compte cible.
Tu dois pour chaque contact :
1. Déterminer son rôle décisionnel (sponsor, champion, operational, purchasing, blocker, influencer)
2. Attribuer une priorité (1 = haute, 5 = basse)
3. Expliquer pourquoi le contacter
4. Générer un message email personnalisé
5. Générer un message LinkedIn personnalisé
6. Générer un message de relance

PROFIL DE L'ESN :
- Offres : ${JSON.stringify(onboardingData.offers || [])}
- Secteurs : ${JSON.stringify(onboardingData.sectors || [])}
- TJM : ${onboardingData.avgTJM || 'Non renseigné'}

ANALYSE DU COMPTE :
- Enjeux IT : ${JSON.stringify(accountAnalysis.itChallenges || [])}
- Signaux récents : ${JSON.stringify(accountAnalysis.recentSignals || [])}
- Angles d'attaque : ${JSON.stringify(accountAnalysis.angles?.map((a: any) => a.title) || [])}

Réponds UNIQUEMENT en JSON valide, un tableau d'objets.`

  const contactsList = linkedinContacts.slice(0, 30).map(c => ({
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
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    const data = await res.json()
    const text = data.content?.[0]?.text || '[]'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch (error) {
    console.error('Claude enrichment error:', error)
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
    priorityJustification: `[MODE DÉMO] Compte généré automatiquement. Connectez vos API (Brave, Claude, Pappers) dans Supabase > Edge Functions > Secrets pour des résultats réels.`,
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
    actionPlan: {
      strategyType: 'bottom_up',
      strategyJustification: 'Entrer par les opérationnels techniques, démontrer la valeur, puis escalader vers le DSI et les achats.',
      weeks: [
        { week: 1, title: 'Premier contact', items: [
          { text: 'Contacter Head of Data — Email + LinkedIn', done: false },
          { text: 'Envoyer demande connexion au DSI', done: false },
          { text: 'Contacter Resp. Cloud — Email', done: false },
        ]},
        { week: 2, title: 'Relances + élargissement', items: [
          { text: 'Relance Head of Data si pas de réponse (J+5)', done: false },
          { text: 'Contacter DSI par email direct', done: false },
          { text: 'Engager Dir. Achats si réponse opérationnels', done: false },
        ]},
        { week: 3, title: 'Proposition de valeur', items: [
          { text: 'Envoyer proposition de profils si RDV obtenu', done: false },
          { text: 'Partager une référence client pertinente', done: false },
          { text: 'Proposer un call de 15 min aux répondants', done: false },
        ]},
        { week: 4, title: 'Escalade ou pivot', items: [
          { text: 'Si silence total → pivoter vers Angle 2', done: false },
          { text: 'Si conversation ouverte → fixer RDV qualification', done: false },
          { text: 'Si RDV obtenu → préparer le push profil', done: false },
        ]},
      ],
    },
  }
}


