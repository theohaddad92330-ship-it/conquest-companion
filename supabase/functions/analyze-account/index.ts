import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BRAVE_API_KEY = Deno.env.get('BRAVE_API_KEY') || ''
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY') || ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''

function cors() {
  const origin = Deno.env.get('ALLOWED_ORIGINS')?.trim()
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors() })
}

// AbortSignal.timeout peut ne pas être disponible de manière uniforme selon l'edge runtime.
// Ce helper fournit un fallback fiable (AbortController) pour éviter les appels qui "moulinent".
function timeoutSignal(ms: number): AbortSignal {
  const anyAbortSignal = AbortSignal as any
  if (anyAbortSignal && typeof anyAbortSignal.timeout === 'function') {
    return anyAbortSignal.timeout(ms) as AbortSignal
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

async function setAnalysisStep(supabase: any, accountId: string, step: string, progress: number, traceId: string, extra?: Record<string, unknown>) {
  const analysis_trace = { ...(extra ? extra : {}), traceId, at: new Date().toISOString() }
  await supabase
    .from('accounts')
    .update({ analysis_step: step, analysis_progress: Math.max(0, Math.min(100, Math.round(progress))), analysis_trace })
    .eq('id', accountId)
    .catch(() => {})
}

// ── Serve ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })

  const traceId = crypto.randomUUID().slice(0, 8)
  console.log(JSON.stringify({ event: 'request_start', traceId, keys: { brave: !!BRAVE_API_KEY, firecrawl: !!FIRECRAWL_API_KEY, claude: !!ANTHROPIC_API_KEY } }))

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
      // Ne pas insérer analysis_* ici : si la migration n’est pas appliquée, l’INSERT échoue (“Impossible de créer le compte”).
      // Les étapes sont mises à jour via setAnalysisStep après coup (no-op si colonnes absentes).
      .from('accounts').insert({ user_id: user.id, company_name: companyName, status: 'analyzing', user_context: userContext }).select().single()
    if (insertErr || !account) {
      console.error(JSON.stringify({ event: 'insert_error', traceId, error: insertErr?.message }))
      return json({ error: 'Impossible de créer le compte' }, 500)
    }

    // Charger le profil ESN
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    const onboardingData = profile?.onboarding_data ?? {}

    // Lancer l'analyse en background avec timeout global 8 min (évite blocage sans retour)
    const ANALYSIS_TIMEOUT_MS = 8 * 60 * 1000
    EdgeRuntime.waitUntil(
      (async () => {
        const timeoutPromise = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('TIMEOUT_8MIN')), ANALYSIS_TIMEOUT_MS)
        )
        try {
          await Promise.race([
            processAnalysis(supabase, account.id, user.id, companyName, userContext, onboardingData, traceId),
            timeoutPromise,
          ])
        } catch (e) {
          if (e instanceof Error && e.message === 'TIMEOUT_8MIN') {
            await setAnalysisStep(supabase, account.id, 'timeout', 100, traceId, { reason: 'TIMEOUT_8MIN' })
            await supabase
              .from('accounts')
              .update({
                status: 'error',
                error_message: "L'analyse a dépassé le temps maximum (8 min). Réessayez ou lancez une recherche plus ciblée.",
              })
              .eq('id', account.id)
              .catch(() => {})
            console.error(JSON.stringify({ event: 'analysis_timeout', traceId, accountId: account.id }))
          } else {
            throw e
          }
        }
      })()
    )

    return json({ accountId: account.id, status: 'analyzing' })
  } catch (err) {
    console.error(JSON.stringify({ event: 'serve_error', traceId, error: err instanceof Error ? err.message : 'unknown' }))
    return json({ error: 'Erreur serveur' }, 500)
  }
})

// Normalise les phases Claude (name, timeframe, actions) vers le format attendu par le frontend (week, title, items)
function normalizeActionPlanWeeks(raw: any[]): any[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  const first = raw[0]
  // Déjà au format frontend (week, title, items)
  if (first?.items && Array.isArray(first.items)) return raw
  // Format Claude : name, timeframe, actions: [{ action, contact, channel, deadline, kpi }]
  return raw.map((p: any, i: number) => ({
    week: i + 1,
    title: p.name || p.timeframe || p.title || `Phase ${i + 1}`,
    items: (p.actions || p.items || []).map((a: any) => ({
      text: a.action ?? a.text ?? '',
      done: false,
      responsable: a.contact,
      deadline: a.deadline,
      kpi: a.kpi,
      outil: a.channel,
    })),
  }))
}

// ============================================================
// ORCHESTRATION PRINCIPALE — 4 PHASES
// ============================================================
async function processAnalysis(supabase: any, accountId: string, userId: string, companyName: string, userContext: string | null, onboardingData: any, traceId: string) {
  const t0 = Date.now()
  console.log(JSON.stringify({ event: 'analysis_start', traceId, accountId, companyName }))

  try {
    // Crédit: consommer 1 analyse (transactionnel). Si limite atteinte -> erreur immédiate.
    try {
      const { data: ok } = await supabase.rpc('check_and_increment_accounts_used', { p_user_id: userId })
      if (ok === false) {
        await setAnalysisStep(supabase, accountId, 'error', 100, traceId, { reason: 'CREDITS_EXHAUSTED' })
        await supabase
          .from('accounts')
          .update({ status: 'error', error_message: "Crédits insuffisants pour lancer une nouvelle analyse. Rendez-vous dans Crédits & plan." })
          .eq('id', accountId)
          .catch(() => {})
        return
      }
    } catch (e) {
      // Si la RPC n'est pas disponible, on n'empêche pas l'analyse (mode dégradé)
      console.log(JSON.stringify({ event: 'credits_rpc_skip', traceId, error: e instanceof Error ? e.message : 'unknown' }))
    }

    // ── Vérification clés API critiques ──
    const missingKeys: string[] = []
    if (!BRAVE_API_KEY) missingKeys.push('BRAVE_API_KEY')
    if (!FIRECRAWL_API_KEY) missingKeys.push('FIRECRAWL_API_KEY')
    if (!ANTHROPIC_API_KEY) missingKeys.push('ANTHROPIC_API_KEY')

    if (missingKeys.length > 0) {
      const keyList = missingKeys.join(', ')
      console.error(JSON.stringify({ event: 'missing_api_keys', traceId, keys: missingKeys }))
      await setAnalysisStep(supabase, accountId, 'error_missing_keys', 100, traceId, { missingKeys })
      await supabase
        .from('accounts')
        .update({
          status: 'error',
          error_message: `Configuration incomplète : clé(s) API manquante(s) (${keyList}). Contactez le support.`,
        })
        .eq('id', accountId)
      return
    }

    await setAnalysisStep(supabase, accountId, 'phase1_research', 10, traceId)
    // ════════════════════════════════════════
    // PHASE 1 — DEEP RESEARCH
    // ════════════════════════════════════════
    const braveResults = await searchBrave(companyName, onboardingData, traceId)
    await setAnalysisStep(supabase, accountId, 'phase1_brave_done', 12, traceId, { braveUrls: braveResults.urls?.length ?? 0 })
    const scrapedContent = await scrapePages(braveResults.urls, traceId)
    await setAnalysisStep(supabase, accountId, 'phase1_scrape_done', 15, traceId, { scrapedChars: scrapedContent?.length ?? 0 })
    console.log(JSON.stringify({ event: 'phase1_data_collected', traceId, braveCount: braveResults.results.length, scrapedLength: scrapedContent.length }))

    const research = await callClaude_Research(companyName, braveResults, scrapedContent, userContext, onboardingData, traceId)
    if (!research) {
      await setAnalysisStep(supabase, accountId, 'phase1_error', 100, traceId)
      await supabase.from('accounts').update({ status: 'error', error_message: 'L\'analyse IA a échoué. Réessayez.' }).eq('id', accountId)
      return
    }
    await setAnalysisStep(supabase, accountId, 'phase1_claude_done', 18, traceId, { sector: research.sector ?? null, anglesCount: research.angles?.length ?? 0 })
    console.log(JSON.stringify({ event: 'phase1_claude_done', traceId, sector: research.sector, anglesCount: research.angles?.length || 0 }))

    // Sauvegarder Phase 1
    await setAnalysisStep(supabase, accountId, 'phase1_saving', 20, traceId)
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
    // PHASE 2 — CONTACTS (sources web uniquement pour l'instant)
    // ════════════════════════════════════════
    await setAnalysisStep(supabase, accountId, 'phase2_contacts_source', 30, traceId)
    let rawContacts: any[] = []

    // Source : personnes réelles extraites du contenu web (Brave + Firecrawl) par Claude en Phase 1
    if (Array.isArray(research.peopleMentioned) && research.peopleMentioned.length > 0) {
      rawContacts = research.peopleMentioned.map((p: any) => ({
        name: p.name || '',
        title: p.title || '',
        about: (p.context || '').slice(0, 300),
        linkedin: null,
        location: '',
      }))
      console.log(JSON.stringify({ event: 'phase2_web_contacts', traceId, count: rawContacts.length }))
    } else {
      console.log(JSON.stringify({ event: 'phase2_no_contacts_found', traceId }))
    }

    // ════════════════════════════════════════
    // PHASE 3 — ENRICHISSEMENT CONTACTS
    // ════════════════════════════════════════
    await setAnalysisStep(supabase, accountId, 'phase3_enrich_contacts', 45, traceId, { rawContactsCount: rawContacts.length })
    console.log(JSON.stringify({ event: 'phase3_start', traceId, rawContactsCount: rawContacts.length }))
    const enrichResult = await callClaude_Contacts(companyName, rawContacts, research, onboardingData, traceId)
    const enrichedContacts = enrichResult.contacts
    const contactsMeta = enrichResult.meta
    console.log(JSON.stringify({ event: 'phase3_done', traceId, enrichedCount: enrichedContacts.length }))

    // Normaliser les champs message pour la DB (JSONB attend un objet ou null)
    function normMessage(m: any): { subject: string; body: string } | null {
      if (!m) return null
      if (typeof m === 'object' && m !== null && (m.subject != null || m.body != null)) {
        return { subject: String(m.subject ?? ''), body: String(m.body ?? '') }
      }
      if (typeof m === 'string') return { subject: '', body: m.slice(0, 2000) }
      return null
    }
    function normLinkedinMessage(m: any): string | null {
      if (m == null) return null
      return typeof m === 'string' ? m.slice(0, 3000) : null
    }
    const allowedRoles = ['sponsor', 'champion', 'operational', 'purchasing', 'blocker', 'influencer', 'unknown'] as const
    function normRole(r: any): string {
      const s = String(r || 'unknown').toLowerCase()
      if (allowedRoles.includes(s)) return s
      if (['achats', 'achat'].includes(s)) return 'purchasing'
      if (['decideur', 'c-level', 'clevel', 'sponsor'].includes(s)) return 'sponsor'
      if (['operationnel', 'ops'].includes(s)) return 'operational'
      return 'unknown'
    }

    // Sauvegarder les contacts
    await setAnalysisStep(supabase, accountId, 'phase3_saving_contacts', 60, traceId, { enrichedCount: enrichedContacts.length })
    if (enrichedContacts.length > 0) {
      const rows = enrichedContacts.map((c: any, i: number) => ({
        account_id: accountId, user_id: userId,
        full_name: String(c.name || `Contact ${i + 1}`).slice(0, 500),
        title: c.title ? String(c.title).slice(0, 500) : null,
        entity: c.entity ? String(c.entity).slice(0, 300) : null,
        decision_role: normRole(c.role),
        priority: Math.min(5, Math.max(1, Number(c.priority) || 3)),
        email: c.email ? String(c.email).slice(0, 320) : null,
        linkedin_url: c.linkedinUrl || c.linkedin ? String(c.linkedinUrl || c.linkedin).slice(0, 500) : null,
        profile_summary: c.summary ? String(c.summary).slice(0, 2000) : null,
        why_contact: c.whyContact ? String(c.whyContact).slice(0, 1000) : null,
        email_message: null,
        linkedin_message: null,
        followup_message: null,
        source: rawContacts.length > 0 ? 'web_mentioned' : 'ai_generated',
      }))
      const { error: insertErr } = await supabase.from('contacts').insert(rows)
      if (insertErr) {
        console.error(JSON.stringify({ event: 'contacts_insert_error', traceId, error: insertErr.message }))
      }
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
    await setAnalysisStep(supabase, accountId, 'phase4_plan', 75, traceId)
    const plan = await callClaude_Plan(companyName, research, enrichedContacts, onboardingData, traceId)
    console.log(JSON.stringify({ event: 'phase4_done', traceId, hasPlan: !!plan }))

    if (plan) {
      // Sauvegarder le plan d'action (format frontend : weeks = [{ week, title, items: [{ text, done, ... }] }])
      if (plan.actionPlan) {
        const rawPhases = plan.actionPlan.phases || plan.actionPlan.weeks || []
        const weeks = normalizeActionPlanWeeks(rawPhases)
        await supabase.from('action_plans').insert({
          account_id: accountId, user_id: userId,
          strategy_type: plan.actionPlan.strategyType || 'multi_thread',
          strategy_justification: plan.actionPlan.strategyJustification || '',
          weeks,
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
    await setAnalysisStep(supabase, accountId, 'completed', 100, traceId)
    await supabase.from('accounts').update({ status: 'completed' }).eq('id', accountId)
    console.log(JSON.stringify({ event: 'analysis_complete', traceId, accountId, totalSeconds: Math.round((Date.now() - t0) / 1000) }))

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error(JSON.stringify({ event: 'analysis_error', traceId, accountId, error: msg }))
    await setAnalysisStep(supabase, accountId, 'error', 100, traceId, { error: msg.slice(0, 200) })
    await supabase.from('accounts').update({ status: 'error', error_message: msg.slice(0, 500) }).eq('id', accountId).catch(() => {})
  }
}

// Contexte profil utilisateur pour personnaliser tous les livrables
function buildProfileContext(onboardingData: any): { geoFocus: string; personaFocus: string; oneLiner: string } {
  const geo = onboardingData.geo || []
  const hasInternational = Array.isArray(geo) && geo.includes('International')
  const geoFocus = hasInternational ? 'Monde' : (Array.isArray(geo) && geo.length > 0 ? 'France et Europe (priorité aux zones choisies par l\'utilisateur)' : 'France et Europe')
  const personas = onboardingData.personas || []
  const personaFocus = Array.isArray(personas) && personas.length > 0 ? personas.join(', ') : 'DSI, CTO, Directeurs, Achats IT, Opérationnels'
  const sectors = (onboardingData.sectors || []).slice(0, 3).join(', ')
  const oneLiner = [onboardingData.esnName, onboardingData.size, sectors, geoFocus].filter(Boolean).join(' · ')
  return { geoFocus, personaFocus, oneLiner }
}

// ============================================================
// BRAVE SEARCH
// ============================================================
async function searchBrave(companyName: string, onboardingData: any, traceId: string): Promise<{ results: any[], urls: string[], linkedinCompanyUrl: string | null }> {
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
  if (!FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY manquante — impossible de scraper les pages')
  }
  if (urls.length === 0) {
    console.log(JSON.stringify({ event: 'firecrawl_no_urls', traceId }))
    return ''
  }

  // Prioriser et filtrer les URLs — plus de pages pour maximiser les noms (annuaires, équipes, nominations)
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

// ============================================================
// CLAUDE APPEL 1 — BELLUM-RESEARCH
// ============================================================
async function callClaude_Research(companyName: string, braveResults: any, scrapedContent: string, userContext: string | null, onboardingData: any, traceId: string): Promise<any | null> {
  if (!ANTHROPIC_API_KEY) { console.error(JSON.stringify({ event: 'claude1_no_key', traceId })); return null }
  const profile = buildProfileContext(onboardingData)

  const systemPrompt = `Tu es BELLUM, l'agent d'intelligence commerciale de BellumAI.
Ta mission : analyser un compte cible et produire un plan de conquête B2B complet, PERSONNALISÉ au profil du commercial qui va l'utiliser.
Tout ce que tu produis doit être ACTIONNABLE : orga claire, filiales, programmes, projets, annonces, et plusieurs PORTES D'ENTRÉE (pas seulement le CEO — équipes métier, sponsors, champions, achats, opérationnels).
Tu produis des livrables fondés UNIQUEMENT sur les données réelles fournies. Aucune invention.

PROFIL UTILISATEUR (adapter tout à ce profil) :
- ESN : ${onboardingData.esnName || 'Non renseigné'}, Taille : ${onboardingData.size || 'Non renseignée'}
- Offres : ${JSON.stringify(onboardingData.offers || [])}
- Secteurs ciblés : ${JSON.stringify(onboardingData.sectors || [])}
- Personas cibles : ${profile.personaFocus}
- Zone géo prioritaire : ${profile.geoFocus}
- Type clients : ${JSON.stringify(onboardingData.clientType || [])}
- TJM : ${onboardingData.avgTJM || 'Non renseigné'}, Cycle : ${onboardingData.salesCycle || 'Non renseigné'}
- Défi commercial : ${onboardingData.mainChallenge || 'Non renseigné'}
- Équipe : ${onboardingData.salesTeamSize || 'Non renseigné'}
${userContext ? 'CONTEXTE UTILISATEUR : ' + userContext : ''}

RÈGLES :
- Adapter angles et portes d'entrée au profil (petite ESN → bottom-up, opérationnels; grande ESN → multi-thread, référencement).
- commentOuvrirCompte : proposer PLUSIEURS portes d'entrée (pas que le top), avec justification et plan B pour chacune.
- Identifier programmes IT avec VRAIS noms (ex. NEMO), projets, annonces, baisses de budget, blocages référencement, signaux d'achat.
- Entités : sièges régionaux, filiales métiers (ex. RESG), pas seulement le groupe. Qui dépend de qui.
- priorityScore : CALIBRER selon la taille ESN du profil. 0-20 consultants = très dur d'ouvrir un grand compte → score 4-6 et le dire dans overall. 200+ et bon alignement → 7-9. Jamais mettre 9/10 par défaut.
- organigrammeLogic : logique commerciale (hiérarchie, filiales côte à côte par métier, bonnes portes d'entrée).
- Si zone = France/Europe uniquement, privilégier siège/filiales France et UE.

ANTI-HALLUCINATION : chaque donnée sourcée. Si non trouvé → "Non détecté". Ne jamais inventer.

PEOPLEMENTIONED : extraire TOUTES les personnes RÉELLES mentionnées dans le contenu (nominations, interviews, communiqués, listes, organigrammes). TOUS NIVEAUX : C-level, directeurs, chefs de projet, achats, RSSI, responsables métier. Viser 50 à 150 noms si le contenu le permet. Chaque entrée : name, title, context, source. Ne pas inventer de noms.

Réponds UNIQUEMENT en JSON valide. Pas de texte avant/après. Pas de backticks.`

  const userPrompt = `Analyse le compte "${companyName}".

DONNÉES WEB :
${JSON.stringify(braveResults.results, null, 2)}

CONTENU SCRAPÉ :
${scrapedContent}

RÈGLES CRITIQUES :
- programNames : des VRAIS noms de programmes/projets (ex. "Programme NEMO", "Projet Phoenix"), pas des thématiques génériques. Si trouvé dans les données, les citer. Sinon "Non détecté".
- entitiesExhaustive : inclure sièges et entités en RÉGION (sièges locaux, directions régionales), pas seulement le siège central. Pour les groupes (ex. banques) : filiales métiers (RESG, banque de détail, banque privée, etc.) avec type et parent.
- sitesFrance : à partir du siège, des filiales et entitiesExhaustive, lister les sites/localisations en France uniquement (ville, région, type, label, importance). Si siège à Paris → un item Paris. Si filiale à Lyon ou direction régionale Nantes → les ajouter. Villes françaises connues (Paris, Lyon, Lille, Nantes, Toulouse, Bordeaux, Marseille, Strasbourg, Rennes, Nice, etc.). Si aucune info géo France → [].
- esnSynergies : identifier les ESN (SSII, cabinets) CITÉES ou fortement probables déjà en place sur le compte (compte-rendus, références, partenariats, offres, annonces). Pour chacune : nom, type de présence (rang 1, niche, partenaire), niveau de certitude (0-100), pourquoi tu le penses, et conseil concret pour l'utilisateur (synergie, sous-traitance, co-traitance, entrée par eux). Adapter ces conseils à la taille de l'ESN utilisatrice (petite ESN = privilégier synergies / sous-traitance, pas frontal).
- Rechercher dans les données : baisses de budget IT, blocages ou perte de référencement rang 1, difficultés fournisseurs, autres filiales connues (ex. RESG pour SocGen).
- priorityScore : DOIT refléter la difficulté pour CE profil. Ex. si l'utilisateur a 0-20 consultants (petite ESN), ouvrir un grand compte = très dur → score 4-6 pas 9. Si 200+ consultants et bon alignement → score 8-9. Justification détaillée dans priorityJustification.overall.
- peopleMentioned : lister TOUTES les personnes réelles trouvées dans le contenu (tous niveaux). Plus il y a de noms dans les pages scrapées, plus tu dois en extraire (viser 50-150). Ne pas s'arrêter aux C-level.
- linkedinSearchKeywords : generic doit inclure les sujets que l'utilisateur attaque : Data, Cyber, IT, Tech, Agile, Scrum, Dev, Digital (en plus de DSI, CTO, Achats IT). byEntity : pour chaque entité identifiée, des mots-clés ciblés (ex. Head of Data, RSSI, Chef de projet digital).

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
  "entitiesExhaustive": [{"name": "Entité ou siège régional", "type": "filiale|BU|siège_régional|groupe", "parent": "Parent", "region": "Région si applicable"}],
  "sitesFrance": [{"city": "Paris", "region": "Île-de-France", "type": "siège|filiale|direction_régionale|centre_services", "label": "Siège social", "importance": "haute|moyenne|basse"}],
  "programNames": [{"name": "Nom RÉEL du programme (ex. NEMO)", "entity": "Entité", "description": "Desc", "technologies": ["Tech"]}],
  "budgetSignals": ["Baisse budget", "Blocage ref", "..."],
  "itChallenges": ["Enjeu 1"],
  "recentSignals": [{"signal": "Description", "source": "Source", "type": "recrutement|nomination|investissement"}],
  "pains": [{"pain": "Description", "impact": "Impact business", "offer": "Ce que l'ESN propose", "urgency": "haute|moyenne|basse"}],
  "priorityScore": 5,
  "priorityJustification": {"urgency": {"score": 5, "justification": "..."}, "accessibility": {"score": 5, "justification": "..."}, "competition": {"score": 5, "justification": "..."}, "alignment": {"score": 5, "justification": "..."}, "potential": {"score": 5, "justification": "..."}, "overall": "Justification détaillée en fonction du profil (taille ESN, alignement). Pas toujours 9/10."},
  "competitors": [{"name": "ESN", "perimeter": "Périmètre", "strength": "Forces", "weakness": "Faiblesses"}],
  "esnSynergies": [{
    "name": "Nom ESN",
    "certainty": 78,
    "presenceType": "referencement_rang1|partenaire|niche|probable",
    "why": "Ce qui montre qu'ils sont (ou ont été) en place sur ce compte",
    "adviceForUser": "Texte court expliquant comment en tirer parti (co-traitance, sous-traitance, intro, etc.), adapté à une ESN de cette taille"
  }],
  "technologyStack": ["Tech 1"],
  "regulations": ["NIS2", "RGPD"],
  "angles": [{"title": "Titre", "description": "Description détaillée", "entry": "Contact d'entrée → escalade", "offer": "Offre ESN"}],
  "commentOuvrirCompte": {"strategy": "Stratégie détaillée 200+ mots", "entryPoints": [{"label": "Porte d'entrée", "targetProfile": "Type contact", "angle": "Angle", "justification": "Pourquoi 100+ mots", "risks": "Risques", "planB": "Alternative"}]},
  "rdvScript": {"opening": {"instructions": "...", "recommendedPhrase": "..."}, "positioning": {"instructions": "..."}, "exploration": {"instructions": "..."}, "proposal": {"instructions": "..."}, "closing": {"instructions": "..."}},
  "powerQuestions": [{"question": "Question contextualisée", "purpose": "Ce qu'on révèle", "timing": "début|milieu|fin"}],
  "objections": [{"objection": "Objection", "realMeaning": "Lecture réelle", "response": "Réponse", "mirrorQuestion": "Question miroir"}],
  "linkedinSearchKeywords": {"byEntity": [{"entity": "Entité", "keywords": ["DSI", "Head of Data"]}], "generic": ["DSI", "CTO", "Achats IT"]},
  "peopleMentioned": [{"name": "Prénom Nom", "title": "Poste exact", "context": "Citation", "source": "URL ou titre"}],
  "organigrammeLogic": {"hierarchy": "Qui est au-dessus de qui (groupe > filiales > directions)", "siblingEntities": "Filiales côte à côte (métiers différents)", "entryPoints": "Quelles entités pour quels types de ventes"}
}`

  return await callClaudeAPI(systemPrompt, userPrompt, 16000, traceId, 'research')
}

// ============================================================
// CLAUDE APPEL 2 — BELLUM-CONTACTS
// ============================================================
const MAX_RAW_CONTACTS_FOR_PROMPT = 250
const TARGET_MIN_CONTACTS = 150
const TARGET_IDEAL_CONTACTS = 300

function parseContactsResult(result: any): { contacts: any[], meta: any } {
  if (!result || typeof result !== 'object') return { contacts: [], meta: null }
  const contacts = result.contacts ?? result.Contacts ?? (Array.isArray(result) ? result : result.data?.contacts ?? [])
  const list = Array.isArray(contacts) ? contacts : []
  const meta = (result.organigramme || result.decisionChain) ? {
    organigramme: result.organigramme,
    decisionChain: result.decisionChain,
    uncoveredZones: result.uncoveredZones,
  } : null
  return { contacts: list, meta }
}

async function callClaude_Contacts(companyName: string, rawContacts: any[], research: any, onboardingData: any, traceId: string): Promise<{ contacts: any[], meta: any }> {
  if (!ANTHROPIC_API_KEY) { console.error(JSON.stringify({ event: 'claude2_no_key', traceId })); return { contacts: [], meta: null } }

  // Contexte réduit pour limiter la taille du prompt et éviter timeout (120s)
  const profile = buildProfileContext(onboardingData)
  const entities = research.entitiesExhaustive || []
  const entitiesStr = entities.length ? JSON.stringify(entities.slice(0, 15)) : '[]'
  const anglesTitles = (research.angles || []).slice(0, 5).map((a: any) => a.title || a).filter(Boolean)
  const painsStr = JSON.stringify((research.pains || []).slice(0, 5).map((p: any) => p.pain || p).filter(Boolean))
  const excludedPersonas = onboardingData.excludedPersonas || []
  const geo = onboardingData.geo || []
  const geoOnlyFranceEU = Array.isArray(geo) && geo.length > 0 && !geo.includes('International')

  const systemPrompt = `Tu es BELLUM. Tu qualifies et enrichis des contacts B2B pour un commercial ESN. L'objectif : lui donner TOUT ce qu'il peut MOBILISER — pas seulement 2-3 C-level. Il va appeler le CEO, mais il a aussi besoin d'équipes métier, de portes d'entrée alternatives, de champions, d'opérationnels, d'achats. Chaque contact doit être PERTINENT pour son profil.

PROFIL COMMERCIAL :
- ESN : ${onboardingData.esnName || 'N/A'}, Taille : ${onboardingData.size || 'N/A'}
- Offres : ${JSON.stringify((onboardingData.offers || []).slice(0, 3))}
- Personas cibles : ${profile.personaFocus}
- Zone géo : ${profile.geoFocus}
${excludedPersonas.length ? '- Personas à NE PAS inclure : ' + JSON.stringify(excludedPersonas) : ''}

Compte : ${companyName}, Secteur ${research.sector || 'N/A'}
Entités : ${entitiesStr}
Angles : ${JSON.stringify(anglesTitles)}
Pains : ${painsStr}

RÈGLES CONTACTS :
- Objectif : entre ${TARGET_MIN_CONTACTS} et ${TARGET_IDEAL_CONTACTS} contacts par compte. C'est la force du produit : TOUTES les entités, TOUS les profils utiles (décideurs ET opérationnels) sur les sujets que l'utilisateur attaque (data, cyber, IT, agile, scrum, dev, digital). PAS QUE DES C-LEVEL : sponsors, champions (directeurs, heads), operational (chefs de projet, tech leads), purchasing (achats IT), influencer (RSSI, experts). Majorité champions + operational + achats.
${geoOnlyFranceEU ? '- GÉO : privilégier contacts France / Europe uniquement.' : ''}

IMPORTANT : ne génère PAS les messages (email/LinkedIn/relance) ici. On les générera à la demande côté interface pour éviter les timeouts et réduire l'attente.

Réponds UNIQUEMENT en JSON valide : {"contacts": [{ "name", "title", "entity", "location", "role", "priority", "summary", "whyContact", "linkedinUrl", "email" }], "organigramme": [], "decisionChain": [], "uncoveredZones": []}.`

  let userPrompt: string
  if (rawContacts.length > 0) {
    const limited = rawContacts.slice(0, MAX_RAW_CONTACTS_FOR_PROMPT)
    userPrompt = `Voici des personnes RÉELLES extraites du web pour "${companyName}" (${limited.length} noms). CONSERVE leurs noms et postes exacts. Enrichis CHAQUE contact : entity (filiale/BU), role, priority, summary, whyContact, linkedinUrl, email.
Si tu peux en suggérer d'autres (même entités, sujets data/cyber/agile/dev) pour atteindre jusqu'à ${TARGET_IDEAL_CONTACTS}, ajoute-les avec summary "Profil type suggéré".
Retourne le même format JSON : {"contacts": [...], "organigramme": [], "decisionChain": [], "uncoveredZones": []}.

${JSON.stringify(limited, null, 2)}`
  } else {
    userPrompt = `Génère entre ${TARGET_MIN_CONTACTS} et ${TARGET_IDEAL_CONTACTS} contacts RÉALISTES (noms fictifs, postes/entités cohérents) pour "${companyName}".
Entités : ${entitiesStr}
Couverture : TOUTES les entités, décideurs ET opérationnels sur les sujets data, cyber, IT, agile, scrum, dev, digital. Pour chaque entité : décideurs, champions (directeurs, heads), opérationnels (chefs de projet, tech leads), achats IT, RSSI/experts. Summary : "profil type suggéré".
Même format JSON : {"contacts": [...], "organigramme": [], "decisionChain": [], "uncoveredZones": []}.`
  }

  // Appel principal avec timeout long (phase contacts = grosse réponse)
  let result = await callClaudeAPI(systemPrompt, userPrompt, 16000, traceId, 'contacts', CLAUDE_CONTACTS_TIMEOUT_MS)
  if (result) {
    const parsed = parseContactsResult(result)
    if (parsed.contacts.length > 0) {
      console.log(JSON.stringify({ event: 'claude_contacts_ok', traceId, count: parsed.contacts.length }))
      return parsed
    }
  }

  // Fallback 1 : si on avait des contacts web, enrichir seulement un sous-ensemble (réponse plus courte = plus fiable)
  if (rawContacts.length > 0) {
    console.log(JSON.stringify({ event: 'claude_contacts_fallback_partial', traceId, rawCount: rawContacts.length }))
    const subset = rawContacts.slice(0, 50).map((c: any) => ({
      name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      title: c.title || c.headline,
      about: (c.about || c.context || '').slice(0, 200),
    }))
    const fallbackPrompt = `Enrichis ces ${subset.length} contacts pour "${companyName}". Pour chacun : entity, role, priority, summary, whyContact, linkedinUrl, email. Conserve nom et poste. Complète avec des profils types (data, cyber, agile, dev, champions, opérationnels, achats) jusqu'à entre ${TARGET_MIN_CONTACTS} et ${TARGET_IDEAL_CONTACTS} contacts. JSON : {"contacts": [...]}.`
    const fallbackResult = await callClaudeAPI(systemPrompt, fallbackPrompt, 12000, traceId, 'contacts_fallback', 90000)
    if (fallbackResult) {
      const parsed = parseContactsResult(fallbackResult)
      if (parsed.contacts.length > 0) {
        console.log(JSON.stringify({ event: 'claude_contacts_fallback_ok', traceId, count: parsed.contacts.length }))
        return { contacts: parsed.contacts, meta: parsed.meta }
      }
    }
  }

  // Fallback 2 : génération minimale (profils types avec messages)
  console.log(JSON.stringify({ event: 'claude_contacts_retry', traceId, reason: result ? 'empty_list' : 'null_response' }))
  const fallbackSystem = `Tu es BELLUM. Génère des contacts B2B en JSON uniquement. Entre ${TARGET_MIN_CONTACTS} et ${TARGET_IDEAL_CONTACTS} contacts. Toutes entités, sujets data/cyber/IT/agile/dev/digital. Chaque contact : name, title, entity, role, priority, summary, whyContact, linkedinUrl, email. Pas de texte avant/après.`
  const fallbackUser = `Génère entre ${TARGET_MIN_CONTACTS} et ${TARGET_IDEAL_CONTACTS} contacts pour "${companyName}". Secteur: ${research.sector || 'N/A'}. Entités: ${entitiesStr}. Noms fictifs, postes réalistes. Décideurs, directeurs, chefs de projet, achats IT, RSSI, profils data/cyber/agile/dev.`
  const retryResult = await callClaudeAPI(fallbackSystem, fallbackUser, 10000, traceId, 'contacts_retry', 90000)
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
  const profile = buildProfileContext(onboardingData)

  const systemPrompt = `Tu es BELLUM. Ta mission : produire le plan d'action commercial FINAL, 100% ACTIONNABLE et aligné sur le profil du commercial.

PROFIL (adapter le plan à ça) :
- ESN : ${onboardingData.esnName || 'N/A'}, Taille : ${onboardingData.size || 'Non renseignée'}
- Offres : ${JSON.stringify(onboardingData.offers || [])}
- Cycle de vente : ${onboardingData.salesCycle || 'Non renseigné'}
- Taille équipe commerciale : ${onboardingData.salesTeamSize || 'Non renseigné'}
- TJM : ${onboardingData.avgTJM || 'Non renseigné'}
- Défi principal : ${onboardingData.mainChallenge || 'Non renseigné'}
- Zone : ${profile.geoFocus}

LIVRABLE ATTENDU :
- Plan SÉQUENCÉ : MAINTENANT (S1) → MOIS 1 → MOIS 2-3 → MOIS 3-6 → MOIS 6-12. Chaque phase avec des actions concrètes : verbe + contact + canal + deadline + KPI.
- Séquences prêtes à l'envoi : les messages (email, LinkedIn, relance) sont déjà dans les contacts ; le plan indique QUI contacter, QUAND, dans quel ordre.
- Volume et durée adaptés au cycle et à la taille d'équipe (ex. 1 commercial → moins d'actions parallèles, cycle court → plan condensé).
- evaluation : go/no-go, score, risques, quick wins — pour que le commercial sache par où commencer.

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
const CLAUDE_DEFAULT_TIMEOUT_MS = 120000
const CLAUDE_CONTACTS_TIMEOUT_MS = 200000 // 3 min 20 — phase contacts (50 profils + messages) nécessite plus de temps

async function callClaudeAPI(systemPrompt: string, userPrompt: string, maxTokens: number, traceId: string, phase: string, timeoutMs?: number): Promise<any | null> {
  const timeout = timeoutMs ?? CLAUDE_DEFAULT_TIMEOUT_MS
  console.log(JSON.stringify({ event: `claude_${phase}_start`, traceId, systemLen: systemPrompt.length, userLen: userPrompt.length, timeoutMs: timeout }))

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
      signal: timeoutSignal(timeout),
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


