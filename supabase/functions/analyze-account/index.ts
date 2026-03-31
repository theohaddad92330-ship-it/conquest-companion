// ============================================================
// ANALYZE-ACCOUNT — Orchestrateur principal
// Chaque module est dans son propre fichier pour la maintenabilité
// ============================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { cors, json, err, setAnalysisStep, normalizeActionPlanWeeks, normRole } from './utils.ts'
import { searchBrave } from './brave.ts'
import { scrapePages } from './firecrawl.ts'
import { callClaude_Research } from './claude-research.ts'
import { callClaude_Contacts } from './claude-contacts.ts'
import { callClaude_Plan } from './claude-plan.ts'
import { searchApolloContacts, buildApolloTitleKeywords } from './apollo.ts'
import { getPappersBySiren, searchPappers } from './pappers.ts'

const BRAVE_API_KEY = Deno.env.get('BRAVE_API_KEY') || ''
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY') || ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''

// ── Serve ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })

  const traceId = crypto.randomUUID().slice(0, 8)
  console.log(JSON.stringify({ event: 'request_start', traceId, keys: { brave: !!BRAVE_API_KEY, firecrawl: !!FIRECRAWL_API_KEY, claude: !!ANTHROPIC_API_KEY } }))

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return err('Non authentifié', 'AUTH_REQUIRED', traceId, 401)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', '').trim())
    if (authErr || !user) return err('Non authentifié', 'AUTH_INVALID', traceId, 401)

    // Body
    const body = await req.json().catch(() => ({}))
    const companyName = (typeof body.companyName === 'string' ? body.companyName : '').trim().replace(/\s+/g, ' ')
    const userContext = typeof body.userContext === 'string' ? body.userContext.slice(0, 2000) : null
    const companySiren = typeof body.companySiren === 'string' && /^\d{9}$/.test(body.companySiren) ? body.companySiren : null
    const selectedCompanyName = typeof body.selectedCompanyName === 'string' ? body.selectedCompanyName.trim().slice(0, 200) : null
    if (!companyName) return err('Nom d\'entreprise requis', 'BAD_INPUT', traceId, 400)

    // Créer le compte
    const { data: account, error: insertErr } = await supabase
      .from('accounts').insert({ user_id: user.id, company_name: selectedCompanyName || companyName, status: 'analyzing', user_context: userContext }).select().single()
    if (insertErr || !account) {
      console.error(JSON.stringify({ event: 'insert_error', traceId, error: insertErr?.message }))
      return err('Impossible de créer le compte', 'DB_INSERT_FAILED', traceId, 500)
    }

    // Charger le profil ESN
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    const onboardingData = profile?.onboarding_data ?? {}

    // Lancer l'analyse en background
    const ANALYSIS_TIMEOUT_MS = 8 * 60 * 1000
    EdgeRuntime.waitUntil(
      (async () => {
        const timeoutPromise = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('TIMEOUT_8MIN')), ANALYSIS_TIMEOUT_MS)
        )
        try {
          await Promise.race([
            processAnalysis(supabase, account.id, user.id, companyName, userContext, onboardingData, traceId, companySiren),
            timeoutPromise,
          ])
        } catch (e) {
          if (e instanceof Error && e.message === 'TIMEOUT_8MIN') {
            await setAnalysisStep(supabase, account.id, 'timeout', 100, traceId, { reason: 'TIMEOUT_8MIN' })
            try {
              await supabase.from('accounts').update({
                status: 'error',
                error_message: "L'analyse a dépassé le temps maximum (8 min). Réessayez ou lancez une recherche plus ciblée.",
              }).eq('id', account.id)
            } catch { /* ignore */ }
            console.error(JSON.stringify({ event: 'analysis_timeout', traceId, accountId: account.id }))
          } else {
            throw e
          }
        }
      })()
    )

    return json({ accountId: account.id, status: 'analyzing', traceId })
  } catch (err) {
    console.error(JSON.stringify({ event: 'serve_error', traceId, error: err instanceof Error ? err.message : 'unknown' }))
    return json({ error: { message: 'Erreur serveur', code: 'SERVER_ERROR', traceId } }, 500)
  }
})

// ============================================================
// ORCHESTRATION — 4 PHASES
// ============================================================
async function processAnalysis(
  supabase: any,
  accountId: string,
  userId: string,
  companyName: string,
  userContext: string | null,
  onboardingData: any,
  traceId: string,
  companySiren: string | null
) {
  const t0 = Date.now()
  console.log(JSON.stringify({ event: 'analysis_start', traceId, accountId, companyName }))

  try {
    // ── Crédits ──
    try {
      const { data: ok } = await supabase.rpc('check_and_increment_accounts_used', { p_user_id: userId })
      if (ok === false) {
        await setAnalysisStep(supabase, accountId, 'error', 100, traceId, { reason: 'CREDITS_EXHAUSTED' })
        try {
          await supabase.from('accounts').update({ status: 'error', error_message: "Crédits insuffisants. Rendez-vous dans Crédits & plan." }).eq('id', accountId)
        } catch { /* ignore */ }
        return
      }
    } catch (e) {
      console.log(JSON.stringify({ event: 'credits_rpc_skip', traceId, error: e instanceof Error ? e.message : 'unknown' }))
    }

    // ── Vérification clés API ──
    const missingKeys: string[] = []
    if (!BRAVE_API_KEY) missingKeys.push('BRAVE_API_KEY')
    if (!FIRECRAWL_API_KEY) missingKeys.push('FIRECRAWL_API_KEY')
    if (!ANTHROPIC_API_KEY) missingKeys.push('ANTHROPIC_API_KEY')
    if (missingKeys.length > 0) {
      console.error(JSON.stringify({ event: 'missing_api_keys', traceId, keys: missingKeys }))
      await setAnalysisStep(supabase, accountId, 'error_missing_keys', 100, traceId, { missingKeys })
      try {
        await supabase.from('accounts').update({ status: 'error', error_message: `Clé(s) API manquante(s) : ${missingKeys.join(', ')}. Contactez le support.` }).eq('id', accountId)
      } catch { /* ignore */ }
      return
    }

    // ════════════════════════════════════════
    // PHASE 1 — DEEP RESEARCH
    // ════════════════════════════════════════
    await setAnalysisStep(supabase, accountId, 'phase1_research', 10, traceId)

    // Pré-résolution identité entreprise via Pappers pour réduire l'ambiguïté des homonymes.
    const pappersData = companySiren
      ? (await getPappersBySiren(companySiren, traceId)) || (await searchPappers(companyName, traceId))
      : await searchPappers(companyName, traceId)
    const canonicalName = pappersData?.nom || companyName

    const braveResults = await searchBrave(canonicalName, onboardingData, traceId)
    await setAnalysisStep(supabase, accountId, 'phase1_brave_done', 12, traceId, { braveUrls: braveResults.urls?.length ?? 0 })

    const scrapedContent = await scrapePages(braveResults.urls, traceId)
    await setAnalysisStep(supabase, accountId, 'phase1_scrape_done', 15, traceId, { scrapedChars: scrapedContent?.length ?? 0 })
    console.log(JSON.stringify({ event: 'phase1_data_collected', traceId, braveCount: braveResults.results.length, scrapedLength: scrapedContent.length }))

    const research = await callClaude_Research(canonicalName, braveResults, scrapedContent, userContext, onboardingData, traceId, pappersData)
    if (!research) {
      await setAnalysisStep(supabase, accountId, 'phase1_error', 100, traceId)
      await supabase.from('accounts').update({ status: 'error', error_message: 'L\'analyse IA a échoué. Réessayez.' }).eq('id', accountId)
      return
    }
    await setAnalysisStep(supabase, accountId, 'phase1_claude_done', 18, traceId)
    console.log(JSON.stringify({ event: 'phase1_claude_done', traceId, sector: research.sector }))

    // ── PAPPERS — Enrichissement données entreprise certifiées ──
    await setAnalysisStep(supabase, accountId, 'phase1_pappers', 19, traceId)

    // Fusionner Pappers avec les données Claude (Pappers = source de vérité pour CA, effectifs, siège, dirigeants)
    if (pappersData) {
      if (pappersData.effectifs) research.employees = pappersData.effectifs
      if (pappersData.chiffreAffaires) research.revenue = `${(pappersData.chiffreAffaires / 1000000).toFixed(0)} M€`
      if (pappersData.siege?.ville) research.headquarters = `${pappersData.siege.adresse || ''}, ${pappersData.siege.codePostal || ''} ${pappersData.siege.ville}`.trim().replace(/^,\s*/, '')
      if (pappersData.libelleNaf && !research.sector) research.sector = pappersData.libelleNaf

      // Enrichir raw_analysis avec les données Pappers
      research.pappers = {
        siren: pappersData.siren,
        formeJuridique: pappersData.formeJuridique,
        dateCreation: pappersData.dateCreation,
        chiffreAffaires: pappersData.chiffreAffaires,
        resultat: pappersData.resultat,
        dirigeants: pappersData.dirigeants,
        nbEtablissements: pappersData.etablissements.length,
        etablissementsActifs: pappersData.etablissements.filter(e => e.enActivite),
      }

      // Enrichir sitesFrance avec les établissements Pappers
      if (pappersData.etablissements.length > 0) {
        const existingSites = Array.isArray(research.sitesFrance) ? research.sitesFrance : []
        const pappersSites = pappersData.etablissements
          .filter(e => e.enActivite && e.ville)
          .slice(0, 20)
          .map(e => ({
            city: e.ville,
            region: null,
            type: e.estSiege ? 'siège' : 'établissement',
            label: e.enseigne || (e.estSiege ? 'Siège social' : 'Établissement'),
            importance: e.estSiege ? 'haute' : 'moyenne',
          }))
        const mergedSites = [...existingSites, ...pappersSites]
        const seen = new Set<string>()
        research.sitesFrance = mergedSites.filter((s: any) => {
          const city = String(s?.city || '').toLowerCase().trim()
          const type = String(s?.type || '').toLowerCase().trim()
          const key = `${city}::${type}`
          if (!city || seen.has(key)) return false
          seen.add(key)
          return true
        }).slice(0, 25)
      }
    }

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
    console.log(JSON.stringify({ event: 'phase1_saved', traceId, seconds: Math.round((Date.now() - t0) / 1000), hasPappers: !!pappersData }))

    // ════════════════════════════════════════
    // PHASE 2 — CONTACTS (Apollo + web fallback)
    // ════════════════════════════════════════
    await setAnalysisStep(supabase, accountId, 'phase2_contacts_source', 30, traceId)
    let rawContacts: any[] = []
    let contactSource = 'ai_generated'

    // Source 1 : Apollo People Search (GRATUIT, 0 crédits — noms réels, postes, LinkedIn)
    const titleKeywords = buildApolloTitleKeywords(onboardingData)
    const domain = research.website ? research.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : null
    const apolloContacts = await searchApolloContacts(canonicalName, domain, titleKeywords, traceId, 120)

    if (apolloContacts.length > 0) {
      rawContacts = apolloContacts.map(c => ({
        name: c.name,
        title: c.title,
        about: '',
        linkedin: c.linkedinUrl,
        location: [c.city, c.country].filter(Boolean).join(', '),
        apolloId: c.apolloId,
        hasEmail: c.hasEmail,
        hasPhone: c.hasPhone,
      }))
      contactSource = 'apollo'
      console.log(JSON.stringify({ event: 'phase2_apollo_contacts', traceId, count: rawContacts.length }))
    }

    // Source 2 (fallback) : personnes réelles extraites du web par Claude Phase 1
    if (rawContacts.length === 0 && Array.isArray(research.peopleMentioned) && research.peopleMentioned.length > 0) {
      rawContacts = research.peopleMentioned.map((p: any) => ({
        name: p.name || '',
        title: p.title || '',
        about: (p.context || '').slice(0, 300),
        linkedin: null,
        location: '',
      }))
      contactSource = 'web_mentioned'
      console.log(JSON.stringify({ event: 'phase2_web_contacts', traceId, count: rawContacts.length }))
    }

    if (rawContacts.length === 0) {
      console.log(JSON.stringify({ event: 'phase2_no_contacts_found', traceId }))
    }

    // ════════════════════════════════════════
    // PHASE 3 — ENRICHISSEMENT CONTACTS (Claude)
    // ════════════════════════════════════════
    await setAnalysisStep(supabase, accountId, 'phase3_enrich_contacts', 45, traceId, { rawContactsCount: rawContacts.length })
    const enrichResult = await callClaude_Contacts(canonicalName, rawContacts, research, onboardingData, traceId)
    const enrichedContacts = enrichResult.contacts
    const contactsMeta = enrichResult.meta
    console.log(JSON.stringify({ event: 'phase3_done', traceId, enrichedCount: enrichedContacts.length }))

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
        source: contactSource,
      }))
      const { error: insertErr } = await supabase.from('contacts').insert(rows)
      if (insertErr) {
        console.error(JSON.stringify({ event: 'contacts_insert_error', traceId, error: insertErr.message }))
      }
    }

    // Mettre à jour raw_analysis avec organigramme
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
    const plan = await callClaude_Plan(canonicalName, research, enrichedContacts, onboardingData, traceId)
    console.log(JSON.stringify({ event: 'phase4_done', traceId, hasPlan: !!plan }))

    if (plan) {
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

      const finalRaw = { ...updatedRaw }
      if (plan.offersToPropose) finalRaw.offresAConstruire = { offers: plan.offersToPropose.map((o: any) => ({ ...o, interlocutor: o.targetContact || o.interlocutor || '' })) }
      if (plan.evaluation) finalRaw.evaluationCompte = plan.evaluation
      if (plan.actionPlan) finalRaw.planHebdomadaire = { methodology: plan.actionPlan.strategyJustification, weeks: (plan.actionPlan.phases || []).map((p: any) => ({ week: p.name, theme: p.timeframe, actions: (p.actions || []).map((a: any) => a.action) })) }
      if (plan.prioritySubAccounts) finalRaw.prioritySubAccounts = plan.prioritySubAccounts
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
    try {
      await supabase.from('accounts').update({ status: 'error', error_message: msg.slice(0, 500) }).eq('id', accountId)
    } catch { /* ignore */ }
  }
}
