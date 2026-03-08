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

    const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : ''
    const userContext = typeof body?.userContext === 'string' ? body.userContext.slice(0, 2000) : null

    if (!companyName) return jsonResponse({ error: 'companyName requis' }, 400)
    if (companyName.length > 200) return jsonResponse({ error: 'companyName trop long' }, 400)

    const { data: rateLimitOk } = await supabase.rpc('check_rate_limit', {
      p_user_id: user.id,
      p_max_per_hour: 10,
    })
    if (rateLimitOk === false) {
      return jsonResponse(
        { error: 'Trop de recherches en peu de temps. Réessayez dans quelques minutes.' },
        429,
        { 'Retry-After': '300' }
      )
    }

    const { data: creditOk } = await supabase.rpc('check_and_increment_accounts_used', {
      p_user_id: user.id,
    })
    if (creditOk === false) {
      return jsonResponse(
        { error: 'Limite de crédits atteinte. Passez à un plan supérieur.' },
        403
      )
    }

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
      console.error('analyze-account insert error:', insertError.message)
      return jsonResponse({ error: GENERIC_ERROR_MESSAGE }, 500)
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
    // ÉTAPE 1 — Brave Search
    const braveResults = await searchBrave(companyName, traceId)
    console.log(JSON.stringify({ event: 'brave_done', traceId, resultsCount: braveResults.results?.length || 0 }))

    // ÉTAPE 2 — Scraping pages (3–5 premières URLs Brave)
    const scrapedContent = await scrapePages(braveResults.urls?.slice(0, 5) || [], traceId)
    console.log(JSON.stringify({ event: 'firecrawl_done', traceId, contentLength: scrapedContent.length }))

    // Contexte RAG (base de connaissances ESN)
    const ragContext = await searchRAG(supabase, companyName)

    // ÉTAPE 3 — Analyse IA complète (Claude)
    const analysis = await analyzeWithClaude(companyName, braveResults, scrapedContent, userContext, onboardingData, ragContext, traceId)
    console.log(JSON.stringify({ event: 'claude_analysis_done', traceId, contactsCount: analysis.contacts?.length || 0, anglesCount: analysis.angles?.length || 0 }))

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

    // ÉTAPE 5 — Scraping LinkedIn (Apify)
    let finalContacts: any[] = []

    if (APIFY_API_TOKEN) {
      // 5a. Scraper la page entreprise (infos complémentaires)
      const companyData = await scrapeLinkedInCompany(companyName, traceId)
      
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

      // 5b. Scraper les contacts LinkedIn (50–100, filtrés par personas)
      const linkedinContacts = await scrapeLinkedInPeople(companyName, onboardingData, 100, traceId)

      if (linkedinContacts.length > 0) {
        // ÉTAPE 6 — Enrichissement contacts avec Claude
        finalContacts = await enrichLinkedInContactsWithClaude(
          linkedinContacts,
          companyName,
          analysis,
          onboardingData,
          traceId
        )
        console.log(JSON.stringify({ event: 'claude_enrichment_done', traceId }))
      } else {
        finalContacts = analysis.contacts || []
      }
      console.log(JSON.stringify({ event: 'apify_done', traceId, linkedinContactsCount: finalContacts.length }))
    } else {
      // Pas d'Apify : utiliser les contacts IA
      finalContacts = analysis.contacts || []
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
          source: APIFY_API_TOKEN ? 'linkedin_apify' : 'ai_generated',
        }))
      )
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
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'unknown'
    console.error(JSON.stringify({ event: 'analysis_error', traceId, accountId, error: errMsg }))
    await supabase.from('accounts').update({
      status: 'error',
      error_message: GENERIC_ERROR_MESSAGE,
    }).eq('id', accountId)
  }
}

// ============================================
// FONCTIONS API EXTERNES
// ============================================

async function searchBrave(query: string, traceId: string) {
  if (!BRAVE_API_KEY) return { results: [], urls: [] }
  try {
    const year = new Date().getFullYear()
    const queries = [
      `${query} stratégie transformation digitale ${year}`,
      `${query} projet cloud IA data recrutement IT`,
      `${query} actualités DSI CTO programme`,
    ]
    const allResults: any[] = []
    for (const q of queries.slice(0, 3)) {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10`,
        {
          headers: { 'X-Subscription-Token': BRAVE_API_KEY },
          signal: AbortSignal.timeout(10000),
        }
      )
      const data = await res.json()
      const results = data.web?.results?.slice(0, 10) || []
      allResults.push(...results)
    }
    const seen = new Set<string>()
    const unique = allResults.filter((r: any) => {
      const url = r.url || ''
      if (seen.has(url)) return false
      seen.add(url)
      return true
    })
    return {
      results: unique.slice(0, 10).map((r: any) => ({ title: r.title, description: r.description, url: r.url })),
      urls: unique.slice(0, 10).map((r: any) => r.url),
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'brave_error', traceId, error: err instanceof Error ? err.message : 'unknown' }))
    return { results: [], urls: [] }
  }
}

async function scrapePages(urls: string[], traceId: string) {
  if (!FIRECRAWL_API_KEY || urls.length === 0) return ''
  const contents: string[] = []
  for (const url of urls.slice(0, 5)) {
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_API_KEY}` },
        body: JSON.stringify({ url, formats: ['markdown'] }),
        signal: AbortSignal.timeout(10000),
      })
      const data = await res.json()
      if (data.data?.markdown) contents.push(data.data.markdown.slice(0, 3000))
    } catch (err) {
      console.error(JSON.stringify({ event: 'firecrawl_error', traceId, url: url.slice(0, 50), error: err instanceof Error ? err.message : 'unknown' }))
    }
  }
  return contents.join('\n\n---\n\n')
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
- Chaque action = un verbe + une cible + un canal (email, LinkedIn, téléphone)
- Intégrer des points de décision : si réponse → action A, si silence → action B

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

RÈGLES SUR LE NOM DE L'ENTREPRISE :
- Si le nom contient une faute d'orthographe, corrige-le silencieusement.
- Si le nom est ambigu, choisis la plus grande/connue.
- Indique TOUJOURS le nom exact dans "companyNameCorrected".
- Si aucune entreprise trouvée → "notFound": true + "suggestions": [2-3 noms proches].`

  const userPrompt = `Analyse le compte "${companyName}".
${ragContext ? `\nBASE DE CONNAISSANCES ESN :\n${ragContext}\n` : ''}

DONNÉES WEB (Brave Search) :
${JSON.stringify(braveResults.results?.slice(0, 5), null, 2)}

CONTENU SCRAPÉ (Firecrawl) :
${scrapedContent.slice(0, 8000)}

Tu peux déduire les infos légales / secteur / effectifs depuis ces sources. Produis un JSON avec EXACTEMENT cette structure :
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
      console.error(JSON.stringify({ event: 'claude_parse_error', traceId, rawPreview: text.slice(0, 300) }))
      return generateFallbackAnalysis(companyName, onboardingData)
    }

    if (!parsed.sector && !parsed.itChallenges && !parsed.contacts) {
      console.error(JSON.stringify({ event: 'claude_missing_fields', traceId, keys: Object.keys(parsed) }))
      return generateFallbackAnalysis(companyName, onboardingData)
    }

    parsed.subsidiaries = Array.isArray(parsed.subsidiaries) ? parsed.subsidiaries : []
    parsed.itChallenges = Array.isArray(parsed.itChallenges) ? parsed.itChallenges : []
    parsed.recentSignals = Array.isArray(parsed.recentSignals) ? parsed.recentSignals : []
    parsed.contacts = Array.isArray(parsed.contacts) ? parsed.contacts : []
    parsed.angles = Array.isArray(parsed.angles) ? parsed.angles : []
    parsed.priorityScore = Math.min(10, Math.max(1, parseInt(parsed.priorityScore) || 5))
    if (parsed.actionPlan && !Array.isArray(parsed.actionPlan.weeks)) parsed.actionPlan.weeks = []
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
// SCRAPING LINKEDIN VIA APIFY
// ============================================

/**
 * Étape 4a — Scraper la page entreprise LinkedIn
 * Récupère : description, nombre d'employés, filiales, spécialités
 */
async function scrapeLinkedInCompany(companyName: string, traceId: string): Promise<any> {
  if (!APIFY_API_TOKEN) return null
  try {
    const actorId = 'curious_coder~linkedin-company-scraper'
    const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: [companyName], maxResults: 1 }),
      signal: AbortSignal.timeout(10000),
    })
    const runData = await runRes.json()
    const runId = runData?.data?.id
    if (!runId) return null

    let status = 'RUNNING'
    let attempts = 0
    const deadline = Date.now() + 180000
    while (status === 'RUNNING' && attempts < 60 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000))
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`, {
        signal: AbortSignal.timeout(10000),
      })
      const statusData = await statusRes.json()
      status = statusData?.data?.status || 'FAILED'
      attempts++
    }

    if (status !== 'SUCCEEDED') return null

    const datasetRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`, {
      signal: AbortSignal.timeout(30000),
    })
    const items = await datasetRes.json()
    return items?.[0] || null
  } catch (err) {
    console.error(JSON.stringify({ event: 'apify_company_error', traceId, error: err instanceof Error ? err.message : 'unknown' }))
    return null
  }
}

/**
 * Étape 5b — Scraper les contacts LinkedIn (filtrés par personas, exclus excludedPersonas)
 */
async function scrapeLinkedInPeople(
  companyName: string,
  onboardingData: any,
  maxContacts: number = 100,
  traceId?: string
): Promise<any[]> {
  if (!APIFY_API_TOKEN) return []
  try {
    const personas = onboardingData.personas || ['DSI / CTO', 'Directeur de projet', 'Achats IT']
    const excludedPersonas = onboardingData.excludedPersonas ?? ['Stagiaires', 'Marketing']
    
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
        maxResults: Math.ceil(Math.min(maxContacts, 100) / Math.max(searchQueries.length, 1)),
      }),
      signal: AbortSignal.timeout(10000),
    })
    const runData = await runRes.json()
    const runId = runData?.data?.id
    if (!runId) return []

    let status = 'RUNNING'
    let attempts = 0
    const deadline = Date.now() + 180000
    while (status === 'RUNNING' && attempts < 60 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000))
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`, {
        signal: AbortSignal.timeout(10000),
      })
      const statusData = await statusRes.json()
      status = statusData?.data?.status || 'FAILED'
      attempts++
    }

    if (status !== 'SUCCEEDED') return []

    const datasetRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`, {
      signal: AbortSignal.timeout(30000),
    })
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
  } catch (err) {
    console.error(JSON.stringify({ event: 'apify_people_error', traceId: traceId || 'n/a', error: err instanceof Error ? err.message : 'unknown' }))
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


