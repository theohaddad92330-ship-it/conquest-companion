import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BRAVE_API_KEY = Deno.env.get('BRAVE_API_KEY') || ''
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY') || ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN') || ''

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors() })
}

// ── Serve ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })

  const traceId = crypto.randomUUID().slice(0, 8)
  console.log(JSON.stringify({ event: 'request_start', traceId, keys: { brave: !!BRAVE_API_KEY, firecrawl: !!FIRECRAWL_API_KEY, claude: !!ANTHROPIC_API_KEY, apify: !!APIFY_API_TOKEN } }))

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Non authentifié' }, 401)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', '').trim())
    if (authErr || !user) return json({ error: 'Non authentifié' }, 401)

    // Body
    const body = await req.json().catch(() => ({}))
    const companyName = (typeof body.companyName === 'string' ? body.companyName : '').trim().replace(/\s+/g, ' ')
    const userContext = typeof body.userContext === 'string' ? body.userContext.slice(0, 2000) : null
    if (!companyName) return json({ error: 'Nom d\'entreprise requis' }, 400)

    // Créer le compte
    const { data: account, error: insertErr } = await supabase
      .from('accounts').insert({ user_id: user.id, company_name: companyName, status: 'analyzing', user_context: userContext }).select().single()
    if (insertErr || !account) {
      console.error(JSON.stringify({ event: 'insert_error', traceId, error: insertErr?.message }))
      return json({ error: 'Impossible de créer le compte' }, 500)
    }

    // Charger le profil ESN
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    const onboardingData = profile?.onboarding_data ?? {}

    // Lancer l'analyse en background
    EdgeRuntime.waitUntil(processAnalysis(supabase, account.id, user.id, companyName, userContext, onboardingData, traceId))

    return json({ accountId: account.id, status: 'analyzing' })
  } catch (err) {
    console.error(JSON.stringify({ event: 'serve_error', traceId, error: err instanceof Error ? err.message : 'unknown' }))
    return json({ error: 'Erreur serveur' }, 500)
  }
})

// ============================================================
// ORCHESTRATION PRINCIPALE — 4 PHASES
// ============================================================
async function processAnalysis(supabase: any, accountId: string, userId: string, companyName: string, userContext: string | null, onboardingData: any, traceId: string) {
  const t0 = Date.now()
  console.log(JSON.stringify({ event: 'analysis_start', traceId, accountId, companyName }))

  try {
    // ════════════════════════════════════════
    // PHASE 1 — DEEP RESEARCH
    // ════════════════════════════════════════
    const braveResults = await searchBrave(companyName, onboardingData, traceId)
    const scrapedContent = await scrapePages(braveResults.urls, traceId)
    console.log(JSON.stringify({ event: 'phase1_data_collected', traceId, braveCount: braveResults.results.length, scrapedLength: scrapedContent.length }))

    const research = await callClaude_Research(companyName, braveResults, scrapedContent, userContext, onboardingData, traceId)
    if (!research) {
      await supabase.from('accounts').update({ status: 'error', error_message: 'L\'analyse IA a échoué. Réessayez.' }).eq('id', accountId)
      return
    }
    console.log(JSON.stringify({ event: 'phase1_claude_done', traceId, sector: research.sector, anglesCount: research.angles?.length || 0 }))

    // Sauvegarder Phase 1
    await supabase.from('accounts').update({
      sector: research.sector,
      employees: research.employees,
      revenue: research.revenue,
      headquarters: research.headquarters,
      website: research.website,
      subsidiaries: research.subsidiaries || [],
      it_challenges: research.itChallenges || [],
      recent_signals: (research.recentSignals || []).map((s: any) => typeof s === 'string' ? s : s.signal || JSON.stringify(s)),
      priority_score: research.priorityScore || 5,
      priority_justification: typeof research.priorityJustification === 'string' ? research.priorityJustification : research.priorityJustification?.overall || '',
      raw_analysis: research,
      status: 'analyzing',
    }).eq('id', accountId)

    if (research.angles?.length) {
      await supabase.from('attack_angles').insert(
        research.angles.map((a: any, i: number) => ({
          account_id: accountId, user_id: userId,
          title: a.title, description: a.description, entry_point: a.entry,
          is_recommended: i === 0, rank: i + 1,
        }))
      )
    }
    console.log(JSON.stringify({ event: 'phase1_saved', traceId, seconds: Math.round((Date.now() - t0) / 1000) }))

    // ════════════════════════════════════════
    // PHASE 2 — LINKEDIN SCRAPING (Apify)
    // ════════════════════════════════════════
    let rawContacts: any[] = []
    let apifyWorked = false

    if (APIFY_API_TOKEN) {
      // 2a. Company Employees (principal)
      const companyEmployees = await apify_CompanyEmployees(companyName, research.linkedinSearchKeywords, traceId, braveResults.linkedinCompanyUrl)
      if (companyEmployees.length > 0) {
        rawContacts.push(...companyEmployees)
        apifyWorked = true
      }

      // 2b. Profile Search (complémentaire) — si Company Employees n'a pas assez de résultats
      if (rawContacts.length < 30 && research.linkedinSearchKeywords) {
        const searchResults = await apify_ProfileSearch(companyName, research.linkedinSearchKeywords, traceId)
        if (searchResults.length > 0) {
          rawContacts.push(...searchResults)
          apifyWorked = true
        }
      }

      // Dédupliquer par LinkedIn URL ou nom
      const seen = new Set<string>()
      rawContacts = rawContacts.filter((c: any) => {
        const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.fullName || c.name || ''
        const key = (c.linkedinUrl || c.url || name || `idx-${seen.size}`).toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      console.log(JSON.stringify({ event: 'phase2_done', traceId, totalContacts: rawContacts.length, apifyWorked }))
    } else {
      console.log(JSON.stringify({ event: 'phase2_skipped', traceId, reason: 'no_apify_token' }))
    }

    // ════════════════════════════════════════
    // PHASE 3 — ENRICHISSEMENT CONTACTS
    // ════════════════════════════════════════
    console.log(JSON.stringify({ event: 'phase3_start', traceId, rawContactsCount: rawContacts.length, apifyWorked }))
    const enrichResult = await callClaude_Contacts(companyName, rawContacts, research, onboardingData, apifyWorked, traceId)
    const enrichedContacts = enrichResult.contacts
    const contactsMeta = enrichResult.meta
    console.log(JSON.stringify({ event: 'phase3_done', traceId, enrichedCount: enrichedContacts.length }))

    // Sauvegarder les contacts
    if (enrichedContacts.length > 0) {
      await supabase.from('contacts').insert(
        enrichedContacts.map((c: any, i: number) => ({
          account_id: accountId, user_id: userId,
          full_name: c.name || `Contact ${i + 1}`,
          title: c.title || null,
          entity: c.entity || null,
          decision_role: (c.role || 'unknown').toLowerCase(),
          priority: c.priority || 3,
          email: c.email || null,
          linkedin_url: c.linkedinUrl || c.linkedin || null,
          profile_summary: c.summary || null,
          why_contact: c.whyContact || null,
          email_message: c.emailMessage || null,
          linkedin_message: c.linkedinMessage || null,
          followup_message: c.followupMessage || null,
          source: apifyWorked ? 'linkedin_apify' : 'ai_generated',
        }))
      )
    }

    // Mettre à jour raw_analysis avec organigramme et chaîne de décision
    const updatedRaw = { ...research }
    if (contactsMeta) {
      updatedRaw.organigramme = contactsMeta.organigramme
      updatedRaw.decisionChain = contactsMeta.decisionChain
      updatedRaw.uncoveredZones = contactsMeta.uncoveredZones
    }
    await supabase.from('accounts').update({ raw_analysis: updatedRaw }).eq('id', accountId)
    console.log(JSON.stringify({ event: 'phase3_saved', traceId, seconds: Math.round((Date.now() - t0) / 1000) }))

    // ════════════════════════════════════════
    // PHASE 4 — PLAN D'ACTION FINAL
    // ════════════════════════════════════════
    const plan = await callClaude_Plan(companyName, research, enrichedContacts, onboardingData, traceId)
    console.log(JSON.stringify({ event: 'phase4_done', traceId, hasPlan: !!plan }))

    if (plan) {
      // Sauvegarder le plan d'action
      if (plan.actionPlan) {
        await supabase.from('action_plans').insert({
          account_id: accountId, user_id: userId,
          strategy_type: plan.actionPlan.strategyType || 'multi_thread',
          strategy_justification: plan.actionPlan.strategyJustification || '',
          weeks: plan.actionPlan.phases || plan.actionPlan.weeks || [],
        })
      }

      // Enrichir raw_analysis avec les données Phase 4
      const finalRaw = { ...updatedRaw }
      if (plan.offersToPropose) finalRaw.offresAConstruire = { offers: plan.offersToPropose.map((o: any) => ({ ...o, interlocutor: o.targetContact || o.interlocutor || '' })) }
      if (plan.evaluation) finalRaw.evaluationCompte = plan.evaluation
      if (plan.actionPlan) finalRaw.planHebdomadaire = { methodology: plan.actionPlan.strategyJustification, weeks: (plan.actionPlan.phases || []).map((p: any) => ({ week: p.name, theme: p.timeframe, actions: (p.actions || []).map((a: any) => a.action) })) }
      if (plan.prioritySubAccounts) finalRaw.prioritySubAccounts = plan.prioritySubAccounts
      // commentOuvrirCompte vient de Phase 1, déjà dans research
      await supabase.from('accounts').update({ raw_analysis: finalRaw }).eq('id', accountId)
    }

    // ── TERMINÉ ──
    await supabase.from('accounts').update({ status: 'completed' }).eq('id', accountId)
    console.log(JSON.stringify({ event: 'analysis_complete', traceId, accountId, totalSeconds: Math.round((Date.now() - t0) / 1000) }))

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error(JSON.stringify({ event: 'analysis_error', traceId, accountId, error: msg }))
    await supabase.from('accounts').update({ status: 'error', error_message: msg.slice(0, 500) }).eq('id', accountId).catch(() => {})
  }
}

// ============================================================
// BRAVE SEARCH
// ============================================================
async function searchBrave(companyName: string, onboardingData: any, traceId: string): Promise<{ results: any[], urls: string[], linkedinCompanyUrl: string | null }> {
  if (!BRAVE_API_KEY) { console.log(JSON.stringify({ event: 'brave_skip', traceId })); return { results: [], urls: [], linkedinCompanyUrl: null } }
  const year = new Date().getFullYear()
  const offers = (onboardingData.offers || []).slice(0, 2).join(' ')

  const queries = [
    `${companyName} stratégie transformation digitale projet IT ${year}`,
    `${companyName} recrutement DSI CTO nomination filiales ${year}`,
    `${companyName} prestataire ESN budget IT investissement`,
    `${companyName} site:linkedin.com/company`,
  ]
  if (offers) queries.push(`${companyName} ${offers} programme projet`)

  try {
    const all = await Promise.allSettled(queries.map(q =>
      fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10`, {
        headers: { 'X-Subscription-Token': BRAVE_API_KEY },
        signal: AbortSignal.timeout(10000),
      }).then(r => r.json()).then(d => d.web?.results || [])
    ))
    const flat = all.flatMap(r => r.status === 'fulfilled' ? r.value : [])
    const seen = new Set<string>()
    const unique = flat.filter((r: any) => { if (!r.url || seen.has(r.url)) return false; seen.add(r.url); return true })
    console.log(JSON.stringify({ event: 'brave_done', traceId, count: unique.length }))
    // Extraire l'URL LinkedIn de l'entreprise si trouvée
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

// ============================================================
// FIRECRAWL SCRAPING
// ============================================================
async function scrapePages(urls: string[], traceId: string): Promise<string> {
  if (!FIRECRAWL_API_KEY || urls.length === 0) { console.log(JSON.stringify({ event: 'firecrawl_skip', traceId })); return '' }

  // Prioriser et filtrer les URLs
  const skip = ['linkedin.com', 'facebook.com', 'twitter.com', 'youtube.com']
  const filtered = urls.filter(u => !skip.some(s => u.toLowerCase().includes(s))).slice(0, 8)

  try {
    const all = await Promise.allSettled(filtered.map(url =>
      fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FIRECRAWL_API_KEY}` },
        body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
        signal: AbortSignal.timeout(15000),
      }).then(r => r.json()).then(d => d.data?.markdown ? `--- SOURCE: ${url} ---\n${d.data.markdown.slice(0, 5000)}` : null)
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

// ============================================================
// CLAUDE APPEL 1 — BELLUM-RESEARCH
// ============================================================
async function callClaude_Research(companyName: string, braveResults: any, scrapedContent: string, userContext: string | null, onboardingData: any, traceId: string): Promise<any | null> {
  if (!ANTHROPIC_API_KEY) { console.error(JSON.stringify({ event: 'claude1_no_key', traceId })); return null }

  const systemPrompt = `Tu es BELLUM, l'agent d'intelligence commerciale de BellumAI.
Ta mission : analyser un compte cible et produire un plan de conquête B2B complet pour un commercial d'ESN.
Tu produis des livrables structurés fondés UNIQUEMENT sur les données réelles fournies.

PROFIL ESN :
- Nom : ${onboardingData.esnName || 'Non renseigné'}
- Taille : ${onboardingData.size || 'Non renseignée'}
- Offres : ${JSON.stringify(onboardingData.offers || [])}
- Secteurs : ${JSON.stringify(onboardingData.sectors || [])}
- Personas cibles : ${JSON.stringify(onboardingData.personas || [])}
- Type clients : ${JSON.stringify(onboardingData.clientType || [])}
- TJM : ${onboardingData.avgTJM || 'Non renseigné'}
- Cycle de vente : ${onboardingData.salesCycle || 'Non renseigné'}
- Défi principal : ${onboardingData.mainChallenge || 'Non renseigné'}
- Taille équipe : ${onboardingData.salesTeamSize || 'Non renseigné'}
${userContext ? 'CONTEXTE UTILISATEUR : ' + userContext : ''}

RÈGLES D'ADAPTATION :
- ESN petite (1-20) → bottom-up, cibler opérationnels, pas de DSI en premier
- ESN grande (200+) → approche institutionnelle, multi-thread, référencement
- Grands comptes + petite ESN → sous-traitance, filiale secondaire, sponsorship interne
- Cycle court → plan 4 semaines. Cycle long → plan 12 mois.
- TJM bas → volume/flexibilité. TJM haut → conseil stratégique, C-levels.

ANTI-HALLUCINATION : chaque donnée sourcée. Si non trouvé → "Non détecté". Ne jamais inventer de chiffres.

Réponds UNIQUEMENT en JSON valide. Pas de texte avant/après. Pas de backticks.`

  const userPrompt = `Analyse le compte "${companyName}".

DONNÉES WEB :
${JSON.stringify(braveResults.results, null, 2)}

CONTENU SCRAPÉ :
${scrapedContent}

Produis ce JSON :
{
  "companyNameCorrected": "Nom exact",
  "sector": "Secteur",
  "employees": "Effectifs",
  "revenue": "CA",
  "headquarters": "Siège",
  "website": "URL",
  "isPublic": false,
  "subsidiaries": ["Filiale 1"],
  "entitiesExhaustive": [{"name": "Entité", "type": "filiale|BU|groupe", "parent": "Parent"}],
  "programNames": [{"name": "Programme", "entity": "Entité", "description": "Desc", "technologies": ["Tech"]}],
  "itChallenges": ["Enjeu 1"],
  "recentSignals": [{"signal": "Description", "source": "Source", "type": "recrutement|nomination|investissement"}],
  "pains": [{"pain": "Description", "impact": "Impact business", "offer": "Ce que l'ESN propose", "urgency": "haute|moyenne|basse"}],
  "priorityScore": 8,
  "priorityJustification": {"urgency": {"score": 8, "justification": "..."}, "accessibility": {"score": 7, "justification": "..."}, "competition": {"score": 6, "justification": "..."}, "alignment": {"score": 9, "justification": "..."}, "potential": {"score": 7, "justification": "..."}, "overall": "Justification globale"},
  "competitors": [{"name": "ESN", "perimeter": "Périmètre", "strength": "Forces", "weakness": "Faiblesses"}],
  "technologyStack": ["Tech 1"],
  "regulations": ["NIS2", "RGPD"],
  "angles": [{"title": "Titre", "description": "Description détaillée", "entry": "Contact d'entrée → escalade", "offer": "Offre ESN"}],
  "commentOuvrirCompte": {"strategy": "Stratégie détaillée 200+ mots", "entryPoints": [{"label": "Porte d'entrée", "targetProfile": "Type contact", "angle": "Angle", "justification": "Pourquoi 100+ mots", "risks": "Risques", "planB": "Alternative"}]},
  "rdvScript": {"opening": {"instructions": "...", "recommendedPhrase": "..."}, "positioning": {"instructions": "..."}, "exploration": {"instructions": "..."}, "proposal": {"instructions": "..."}, "closing": {"instructions": "..."}},
  "powerQuestions": [{"question": "Question contextualisée", "purpose": "Ce qu'on révèle", "timing": "début|milieu|fin"}],
  "objections": [{"objection": "Objection", "realMeaning": "Lecture réelle", "response": "Réponse", "mirrorQuestion": "Question miroir"}],
  "linkedinSearchKeywords": {"byEntity": [{"entity": "Entité", "keywords": ["DSI", "Head of Data"]}], "generic": ["DSI", "CTO", "Achats IT"]}
}`

  return await callClaudeAPI(systemPrompt, userPrompt, 16000, traceId, 'research')
}

// ============================================================
// CLAUDE APPEL 2 — BELLUM-CONTACTS
// ============================================================
const MAX_RAW_CONTACTS_FOR_PROMPT = 35

function parseContactsResult(result: any): { contacts: any[], meta: any } {
  const contacts = result?.contacts ?? result?.Contacts ?? (Array.isArray(result) ? result : [])
  const list = Array.isArray(contacts) ? contacts : []
  const meta = (result?.organigramme || result?.decisionChain) ? {
    organigramme: result.organigramme,
    decisionChain: result.decisionChain,
    uncoveredZones: result.uncoveredZones,
  } : null
  return { contacts: list, meta }
}

async function callClaude_Contacts(companyName: string, rawContacts: any[], research: any, onboardingData: any, apifyWorked: boolean, traceId: string): Promise<{ contacts: any[], meta: any }> {
  if (!ANTHROPIC_API_KEY) { console.error(JSON.stringify({ event: 'claude2_no_key', traceId })); return { contacts: [], meta: null } }

  // Contexte réduit pour limiter la taille du prompt et éviter timeout (120s)
  const entities = research.entitiesExhaustive || []
  const entitiesStr = entities.length ? JSON.stringify(entities.slice(0, 15)) : '[]'
  const anglesTitles = (research.angles || []).slice(0, 5).map((a: any) => a.title || a).filter(Boolean)
  const painsStr = JSON.stringify((research.pains || []).slice(0, 5).map((p: any) => p.pain || p).filter(Boolean))

  const systemPrompt = `Tu es BELLUM. Qualifie et enrichis des contacts B2B pour une ESN.

ESN : ${onboardingData.esnName || 'N/A'}, Taille ${onboardingData.size || 'N/A'}, Offres ${JSON.stringify((onboardingData.offers || []).slice(0, 3))}
Compte : ${companyName}, Secteur ${research.sector || 'N/A'}
Entités : ${entitiesStr}
Angles : ${JSON.stringify(anglesTitles)}
Pains : ${painsStr}

Rôles : sponsor / champion / operational / purchasing / influencer. Priorité 1-5.
Messages : LinkedIn 300 car, Email objet 60 car + corps 150 mots, Relance 80 mots. Enjeu SPÉCIFIQUE.

Réponds UNIQUEMENT en JSON valide : {"contacts": [{ "name", "title", "entity", "location", "role", "priority", "summary", "whyContact", "linkedinUrl", "email", "linkedinMessage", "emailMessage", "followupMessage" }], "organigramme": [], "decisionChain": [], "uncoveredZones": []}.`

  let userPrompt: string
  if (apifyWorked && rawContacts.length > 0) {
    const limited = rawContacts.slice(0, MAX_RAW_CONTACTS_FOR_PROMPT)
    const simplified = limited.map((c: any) => ({
      name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.fullName || c.name,
      title: c.headline || c.title || c.currentPosition?.[0]?.position,
      company: c.currentPosition?.[0]?.companyName || companyName,
      linkedin: c.linkedinUrl || c.url,
      about: String(c.about || '').slice(0, 200),
      location: c.location?.linkedinText || c.location?.parsed?.city || '',
    }))
    userPrompt = `Enrichis ces ${simplified.length} contacts LinkedIn pour "${companyName}". Retourne un JSON avec "contacts" (tableau d'objets avec name, title, entity, location, role, priority, summary, whyContact, linkedinUrl, email, linkedinMessage, emailMessage, followupMessage), "organigramme", "decisionChain", "uncoveredZones".

${JSON.stringify(simplified, null, 2)}`
  } else {
    userPrompt = `Génère des contacts RÉALISTES (noms fictifs, postes/entités cohérents) pour "${companyName}".
Entités : ${entitiesStr}
Pour chaque entité : 1 décideur, 1 champion, 1 opérationnel min. + Achats IT, Sécurité, Data si pertinent.
Summary : "profil type suggéré" si fictif.
Même format JSON : {"contacts": [...], "organigramme": [], "decisionChain": [], "uncoveredZones": []}.`
  }

  let result = await callClaudeAPI(systemPrompt, userPrompt, 12000, traceId, 'contacts')
  if (result) {
    const parsed = parseContactsResult(result)
    if (parsed.contacts.length > 0) {
      console.log(JSON.stringify({ event: 'claude_contacts_ok', traceId, count: parsed.contacts.length }))
      return parsed
    }
  }

  // Retry avec prompt minimal pour garantir au moins quelques contacts
  console.log(JSON.stringify({ event: 'claude_contacts_retry', traceId, reason: result ? 'empty_list' : 'null_response' }))
  const fallbackSystem = `Tu es BELLUM. Génère des contacts B2B en JSON uniquement. Format : {"contacts": [{"name":"Prénom Nom","title":"Poste","entity":"Entité","role":"champion","priority":3,"summary":"...","whyContact":"...","linkedinUrl":"","email":"prenom.nom@domaine","linkedinMessage":"...","emailMessage":{"subject":"...","body":"..."},"followupMessage":{"subject":"RE:...","body":"..."}}]}. Pas de texte avant/après.`
  const fallbackUser = `Génère 12 à 18 contacts pour "${companyName}". Secteur: ${research.sector || 'N/A'}. Entités: ${entitiesStr}. Noms fictifs, postes réalistes.`
  const retryResult = await callClaudeAPI(fallbackSystem, fallbackUser, 8000, traceId, 'contacts_retry')
  if (retryResult) {
    const parsed = parseContactsResult(retryResult)
    if (parsed.contacts.length > 0) {
      console.log(JSON.stringify({ event: 'claude_contacts_retry_ok', traceId, count: parsed.contacts.length }))
      return parsed
    }
  }

  console.error(JSON.stringify({ event: 'claude_contacts_failed', traceId }))
  return { contacts: [], meta: null }
}

// ============================================================
// CLAUDE APPEL 3 — BELLUM-PLAN
// ============================================================
async function callClaude_Plan(companyName: string, research: any, contacts: any[], onboardingData: any, traceId: string): Promise<any | null> {
  if (!ANTHROPIC_API_KEY) { console.error(JSON.stringify({ event: 'claude3_no_key', traceId })); return null }

  const systemPrompt = `Tu es BELLUM. Ta mission : produire le plan d'action commercial final.

PROFIL ESN :
- Taille : ${onboardingData.size || 'Non renseignée'}
- Offres : ${JSON.stringify(onboardingData.offers || [])}
- Cycle : ${onboardingData.salesCycle || 'Non renseigné'}
- Équipe : ${onboardingData.salesTeamSize || 'Non renseigné'}
- TJM : ${onboardingData.avgTJM || 'Non renseigné'}
- Défi : ${onboardingData.mainChallenge || 'Non renseigné'}

PLAN SÉQUENCÉ : MAINTENANT (S1) → MOIS 1 → MOIS 2-3 → MOIS 3-6 → MOIS 6-12
Chaque action : verbe + contact + canal + deadline + KPI + statut.
Adapter la durée au cycle de vente et le volume à la taille de l'équipe.

Réponds UNIQUEMENT en JSON valide.`

  const contactsSummary = (contacts || []).slice(0, 30).map((c: any) => ({ name: c.name, title: c.title, entity: c.entity, role: c.role, priority: c.priority }))

  const userPrompt = `Plan d'action pour "${companyName}".

ANALYSE : secteur=${research.sector}, score=${research.priorityScore}
ENJEUX : ${JSON.stringify(research.itChallenges || [])}
PAINS : ${JSON.stringify((research.pains || []).slice(0, 5))}
ANGLES : ${JSON.stringify((research.angles || []).slice(0, 5))}
CONTACTS : ${JSON.stringify(contactsSummary)}

Produis :
{
  "actionPlan": {
    "strategyType": "bottom_up|top_down|multi_thread",
    "strategyJustification": "Justification",
    "phases": [{"name": "MAINTENANT", "timeframe": "Semaine 1", "actions": [{"action": "Verbe + détail", "contact": "Nom", "channel": "LinkedIn|Email|Tel", "deadline": "S1", "kpi": "Indicateur", "status": "À faire"}]}]
  },
  "offersToPropose": [{"offer": "Offre", "order": 1, "targetEntity": "Entité", "targetContact": "Contact", "pitch": "Argumentaire 150+ mots", "painAddressed": "Pain résolu"}],
  "evaluation": {"goNoGo": "GO|NO_GO", "scoreGlobal": 8, "justification": "200+ mots", "recommandation": "100+ mots", "risques": [{"risk": "Risque", "mitigation": "Mitigation"}], "quickWins": [{"action": "Quick win", "contact": "Qui", "timeline": "Quand"}]},
  "prioritySubAccounts": [{"name": "Entité prioritaire", "why": "Pourquoi", "projects": ["Projet"], "keyContacts": ["Contact"], "recommendedApproach": "Comment attaquer"}]
}`

  return await callClaudeAPI(systemPrompt, userPrompt, 12000, traceId, 'plan')
}

// ============================================================
// APPEL CLAUDE GÉNÉRIQUE (avec vérification res.ok)
// ============================================================
async function callClaudeAPI(systemPrompt: string, userPrompt: string, maxTokens: number, traceId: string, phase: string): Promise<any | null> {
  console.log(JSON.stringify({ event: `claude_${phase}_start`, traceId, systemLen: systemPrompt.length, userLen: userPrompt.length }))

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
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(120000),
    })

    // VÉRIFICATION CRITIQUE : est-ce que Claude a répondu avec succès ?
    if (!res.ok) {
      const errBody = await res.text()
      console.error(JSON.stringify({ event: `claude_${phase}_http_error`, traceId, status: res.status, body: errBody.slice(0, 500) }))
      return null
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    if (!text) {
      console.error(JSON.stringify({ event: `claude_${phase}_empty_response`, traceId }))
      return null
    }

    console.log(JSON.stringify({ event: `claude_${phase}_raw`, traceId, len: text.length, preview: text.slice(0, 150) }))
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    // Extraction robuste : si du texte entoure le JSON, extraire l'objet ou le tableau
    function extractJson(s: string): any {
      const trimmed = s.trim()
      const firstBrace = trimmed.indexOf('{')
      const firstBracket = trimmed.indexOf('[')
      if (firstBracket >= 0 && (firstBrace < 0 || firstBracket < firstBrace)) {
        const lastBracket = trimmed.lastIndexOf(']')
        if (lastBracket > firstBracket) {
          const candidate = trimmed.slice(firstBracket, lastBracket + 1)
          return JSON.parse(candidate)
        }
      }
      if (firstBrace >= 0) {
        let depth = 0
        let end = -1
        for (let i = firstBrace; i < trimmed.length; i++) {
          if (trimmed[i] === '{') depth++
          else if (trimmed[i] === '}') { depth--; if (depth === 0) { end = i; break } }
        }
        if (end > firstBrace) {
          const candidate = trimmed.slice(firstBrace, end + 1)
          return JSON.parse(candidate)
        }
      }
      return JSON.parse(trimmed)
    }

    try {
      return extractJson(clean)
    } catch (parseErr) {
      console.error(JSON.stringify({ event: `claude_${phase}_parse_error`, traceId, first300: clean.slice(0, 300), last200: clean.slice(-200) }))
      return null
    }
  } catch (err) {
    console.error(JSON.stringify({ event: `claude_${phase}_fetch_error`, traceId, error: (err as Error).message }))
    return null
  }
}

// ============================================================
// APIFY — Company Employees (Actor principal)
// ============================================================
async function apify_CompanyEmployees(companyName: string, keywords: any, traceId: string, braveLinkedinUrl?: string | null): Promise<any[]> {
  if (!APIFY_API_TOKEN) return []
  console.log(JSON.stringify({ event: 'apify_employees_start', traceId, companyName }))

  try {
    // Utiliser l'URL LinkedIn trouvée par Brave, sinon construire un slug
    let companyUrl = braveLinkedinUrl
    if (!companyUrl) {
      const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      companyUrl = `https://www.linkedin.com/company/${companySlug}`
    }
    console.log(JSON.stringify({ event: 'apify_employees_url', traceId, url: companyUrl }))

    // Construire les filtres de mots-clés depuis la Phase 1
    const keywordFilter = (keywords?.generic || ['DSI', 'CTO', 'Data', 'Cloud', 'IT', 'Digital']).join(' ')

    const actorId = 'harvestapi~linkedin-company-employees'
    const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentCompanies: [companyUrl],
        keyword: keywordFilter,
        count: 200,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!runRes.ok) {
      const errText = await runRes.text()
      console.error(JSON.stringify({ event: 'apify_employees_run_error', traceId, status: runRes.status, body: errText.slice(0, 300) }))
      return []
    }

    const runData = await runRes.json()
    const runId = runData?.data?.id
    if (!runId) {
      console.error(JSON.stringify({ event: 'apify_employees_no_run_id', traceId, response: JSON.stringify(runData).slice(0, 300) }))
      return []
    }

    // Polling : attendre que le run finisse
    let status = 'RUNNING'
    let attempts = 0
    while (status === 'RUNNING' && attempts < 40) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`, { signal: AbortSignal.timeout(5000) })
        const statusData = await statusRes.json()
        status = statusData?.data?.status || 'FAILED'
      } catch { status = 'FAILED' }
      attempts++
    }

    if (status !== 'SUCCEEDED') {
      console.log(JSON.stringify({ event: 'apify_employees_status', traceId, status, attempts }))
      return []
    }

    // Récupérer les résultats (API renvoie un tableau ou { items: [] })
    const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`, { signal: AbortSignal.timeout(15000) })
    const raw = await dataRes.json()
    const items = Array.isArray(raw) ? raw : (Array.isArray((raw as any)?.items) ? (raw as any).items : [])
    console.log(JSON.stringify({ event: 'apify_employees_done', traceId, count: items.length, rawIsArray: Array.isArray(raw) }))
    return items
  } catch (err) {
    console.error(JSON.stringify({ event: 'apify_employees_error', traceId, error: (err as Error).message }))
    return []
  }
}

// ============================================================
// APIFY — Profile Search (Actor complémentaire)
// ============================================================
async function apify_ProfileSearch(companyName: string, keywords: any, traceId: string): Promise<any[]> {
  if (!APIFY_API_TOKEN) return []
  console.log(JSON.stringify({ event: 'apify_search_start', traceId }))

  try {
    // Construire la requête de recherche
    const searchQuery = `${companyName} ${(keywords?.generic || ['DSI', 'CTO']).slice(0, 3).join(' ')}`

    const actorId = 'harvestapi~linkedin-profile-search'
    const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchQuery: searchQuery,
        maxProfiles: 50,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!runRes.ok) {
      console.error(JSON.stringify({ event: 'apify_search_run_error', traceId, status: runRes.status }))
      return []
    }

    const runData = await runRes.json()
    const runId = runData?.data?.id
    if (!runId) return []

    // Polling
    let status = 'RUNNING'
    let attempts = 0
    while (status === 'RUNNING' && attempts < 30) {
      await new Promise(r => setTimeout(r, 3000))
      try {
        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`, { signal: AbortSignal.timeout(5000) })
        const statusData = await statusRes.json()
        status = statusData?.data?.status || 'FAILED'
      } catch { status = 'FAILED' }
      attempts++
    }

    if (status !== 'SUCCEEDED') return []

    const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`, { signal: AbortSignal.timeout(15000) })
    const raw = await dataRes.json()
    const items = Array.isArray(raw) ? raw : (Array.isArray((raw as any)?.items) ? (raw as any).items : [])
    console.log(JSON.stringify({ event: 'apify_search_done', traceId, count: items.length, rawIsArray: Array.isArray(raw) }))
    return items
  } catch (err) {
    console.error(JSON.stringify({ event: 'apify_search_error', traceId, error: (err as Error).message }))
    return []
  }
}
