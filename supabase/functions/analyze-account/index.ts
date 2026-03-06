// supabase/functions/analyze-account/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// API Keys — configure in Supabase Dashboard > Settings > Edge Functions > Secrets
const BRAVE_API_KEY = Deno.env.get('BRAVE_API_KEY') || 'PLACEHOLDER'
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY') || 'PLACEHOLDER'
const PAPPERS_API_KEY = Deno.env.get('PAPPERS_API_KEY') || 'PLACEHOLDER'
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || 'PLACEHOLDER'
const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN') || 'PLACEHOLDER'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Not authenticated')

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) throw new Error('Not authenticated')

    const { companyName, userContext } = await req.json()
    if (!companyName) throw new Error('companyName is required')

    const { data: account, error: insertError } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        company_name: companyName,
        user_context: userContext || null,
        status: 'analyzing',
      })
      .select()
      .single()

    if (insertError) throw insertError

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    const onboardingData = profile?.onboarding_data || {}

    // Background processing (return immediately)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(EdgeRuntime as any).waitUntil(
      processAnalysis(supabase, account.id, user.id, companyName, userContext ?? null, onboardingData)
    )

    return new Response(
      JSON.stringify({ accountId: account.id, status: 'analyzing' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processAnalysis(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  accountId: string,
  userId: string,
  companyName: string,
  userContext: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onboardingData: any
) {
  try {
    const braveResults = await searchBrave(companyName)
    const scrapedContent = await scrapePages(braveResults.urls?.slice(0, 5) || [])
    const pappersData = await searchPappers(companyName)

    const analysis = await analyzeWithClaude(
      companyName,
      braveResults,
      scrapedContent,
      pappersData,
      userContext,
      onboardingData
    )

    await supabase
      .from('accounts')
      .update({
        sector: analysis.sector,
        employees: analysis.employees,
        revenue: analysis.revenue,
        headquarters: analysis.headquarters,
        website: analysis.website,
        subsidiaries: analysis.subsidiaries,
        it_challenges: analysis.itChallenges,
        recent_signals: analysis.recentSignals,
        priority_score: analysis.priorityScore,
        priority_justification: analysis.priorityJustification,
        raw_analysis: analysis,
        status: 'completed',
      })
      .eq('id', accountId)

    // TODO: Implement Apify scraping when configured
    // const linkedinContacts = await scrapeLinkedIn(companyName, onboardingData)
    void APIFY_API_TOKEN

    if (analysis.contacts && analysis.contacts.length > 0) {
      const contactRows = analysis.contacts.map((c: any, index: number) => ({
        account_id: accountId,
        user_id: userId,
        full_name: c.name,
        title: c.title,
        entity: c.entity,
        decision_role: (c.role || 'unknown')?.toLowerCase(),
        priority: c.priority || Math.min(index + 1, 5),
        profile_summary: c.summary,
        why_contact: c.whyContact,
        email_message: c.emailMessage || null,
        linkedin_message: c.linkedinMessage || null,
        followup_message: c.followupMessage || null,
        source: 'ai_generated',
      }))

      await supabase.from('contacts').insert(contactRows)
    }

    if (analysis.angles && analysis.angles.length > 0) {
      const angleRows = analysis.angles.map((a: any, index: number) => ({
        account_id: accountId,
        user_id: userId,
        title: a.title,
        description: a.description,
        entry_point: a.entry,
        is_recommended: index === 0,
        rank: index + 1,
      }))

      await supabase.from('attack_angles').insert(angleRows)
    }

    if (analysis.actionPlan) {
      await supabase.from('action_plans').insert({
        account_id: accountId,
        user_id: userId,
        strategy_type: analysis.actionPlan.strategyType || 'multi_thread',
        strategy_justification: analysis.actionPlan.strategyJustification,
        weeks: analysis.actionPlan.weeks,
      })
    }

    await supabase.rpc('increment_accounts_used', { p_user_id: userId })
  } catch (error) {
    await supabase
      .from('accounts')
      .update({ status: 'error', error_message: (error as Error).message })
      .eq('id', accountId)
  }
}

async function searchBrave(query: string) {
  if (BRAVE_API_KEY === 'PLACEHOLDER') {
    return { results: [], urls: [] }
  }
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query + ' projets IT actualités')}`,
      { headers: { 'X-Subscription-Token': BRAVE_API_KEY } }
    )
    const data = await res.json()
    const results = data.web?.results?.slice(0, 10) || []
    return {
      results: results.map((r: any) => ({ title: r.title, description: r.description, url: r.url })),
      urls: results.map((r: any) => r.url),
    }
  } catch {
    return { results: [], urls: [] }
  }
}

async function scrapePages(urls: string[]) {
  if (FIRECRAWL_API_KEY === 'PLACEHOLDER' || urls.length === 0) {
    return ''
  }
  try {
    const contents: string[] = []
    for (const url of urls.slice(0, 3)) {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({ url, formats: ['markdown'] }),
      })
      const data = await res.json()
      if (data.data?.markdown) {
        contents.push(String(data.data.markdown).slice(0, 3000))
      }
    }
    return contents.join('\n\n---\n\n')
  } catch {
    return ''
  }
}

async function searchPappers(companyName: string) {
  if (PAPPERS_API_KEY === 'PLACEHOLDER') {
    return null
  }
  try {
    const res = await fetch(
      `https://api.pappers.fr/v2/recherche?api_token=${PAPPERS_API_KEY}&q=${encodeURIComponent(companyName)}&par_page=1`
    )
    const data = await res.json()
    return data.resultats?.[0] || null
  } catch {
    return null
  }
}

async function analyzeWithClaude(
  companyName: string,
  braveResults: any,
  scrapedContent: string,
  pappersData: any,
  userContext: string | null,
  onboardingData: any
) {
  if (ANTHROPIC_API_KEY === 'PLACEHOLDER') {
    return generateFallbackAnalysis(companyName)
  }

  const systemPrompt = `Tu es un expert en intelligence commerciale pour les ESN (Entreprises de Services du Numérique).
Tu analyses des comptes clients pour aider les commerciaux ESN à préparer leur prospection.

PROFIL DE L'ESN UTILISATEUR :
- Nom : ${onboardingData.esnName || 'Non renseigné'}
- Taille : ${onboardingData.size || 'Non renseignée'}
- Offres : ${JSON.stringify(onboardingData.offers || [])}
- Secteurs cibles : ${JSON.stringify(onboardingData.sectors || [])}
- Personas cibles : ${JSON.stringify(onboardingData.personas || [])}
- Type de clients : ${JSON.stringify(onboardingData.clientType || [])}
- TJM moyen : ${onboardingData.avgTJM || 'Non renseigné'}

CONTEXTE ADDITIONNEL DE L'UTILISATEUR :
${userContext || 'Aucun contexte additionnel.'}

Tu dois répondre UNIQUEMENT en JSON valide, sans aucun texte avant ou après.`

  const userPrompt = `Analyse le compte "${companyName}" pour une ESN qui vend des prestations IT.

DONNÉES COLLECTÉES :

Résultats de recherche web :
${JSON.stringify(braveResults.results?.slice(0, 5), null, 2)}

Contenu scrapé des pages :
${scrapedContent.slice(0, 8000)}

Données Pappers :
${JSON.stringify(pappersData, null, 2)}

PRODUIS UNE ANALYSE COMPLÈTE au format JSON suivant (respecte EXACTEMENT cette structure) :

{
  "sector": "Secteur d'activité",
  "employees": "Nombre d'employés approximatif",
  "revenue": "CA approximatif",
  "headquarters": "Ville du siège",
  "website": "URL du site web",
  "subsidiaries": ["Filiale 1", "Filiale 2"],
  "itChallenges": ["Enjeu IT 1", "Enjeu IT 2", "Enjeu IT 3"],
  "recentSignals": ["Signal 1", "Signal 2", "Signal 3"],
  "priorityScore": 7,
  "priorityJustification": "Justification du score",
  "contacts": [
    {
      "name": "Prénom Nom",
      "title": "Poste",
      "entity": "Filiale ou BU",
      "role": "sponsor",
      "priority": 1,
      "summary": "Résumé du profil",
      "whyContact": "Pourquoi le contacter",
      "emailMessage": {"subject": "Objet", "body": "Corps de l'email"},
      "linkedinMessage": "Message LinkedIn",
      "followupMessage": {"subject": "Objet relance", "body": "Corps de la relance"}
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
    "strategyJustification": "Pourquoi cette stratégie",
    "weeks": [
      {
        "week": 1,
        "title": "Premier contact",
        "items": [
          {"text": "Action à faire", "done": false}
        ]
      }
    ]
  }
}

RÈGLES :
- Génère 5-8 contacts fictifs mais réalistes (basés sur les postes typiques de ce type d'entreprise)
- Personnalise les messages par rapport aux offres de l'ESN utilisateur
- Les angles d'attaque doivent croiser les enjeux du compte avec les offres de l'ESN
- Le plan d'action doit couvrir 4 semaines
- Score de priorité de 1 à 10
- Tout en français`

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

  const cleanJson = String(text).replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim()
  return JSON.parse(cleanJson)
}

function generateFallbackAnalysis(companyName: string) {
  return {
    sector: 'Technologie & Services',
    employees: '~5 000 collaborateurs',
    revenue: '~800 M€',
    headquarters: 'Paris, France',
    website: `${companyName.toLowerCase().replace(/\\s/g, '')}.com`,
    subsidiaries: ['Filiale Consulting', 'Filiale Cloud Services', 'Filiale Data'],
    itChallenges: [
      'Modernisation du SI legacy',
      'Migration cloud multi-provider',
      'Programme data & IA',
      'Cybersécurité et conformité',
    ],
    recentSignals: [
      'Recrutement massif en ingénieurs cloud (2026)',
      "Nomination d'un nouveau CTO",
      'Partenariat stratégique cloud annoncé',
      'Budget IT en hausse',
    ],
    priorityScore: 7,
    priorityJustification:
      "Forte activité IT avec des besoins récurrents en prestations. Données générées en mode démonstration — connectez vos API pour des résultats réels.",
    contacts: [
      {
        name: 'Jean Martin',
        title: 'DSI',
        entity: 'Groupe',
        role: 'sponsor',
        priority: 1,
        summary: 'Directeur des SI du groupe.',
        whyContact: 'Décideur principal sur les budgets IT.',
        emailMessage: {
          subject: `${companyName} — expertise IT disponible`,
          body: `Bonjour,\\n\\nNous accompagnons des entreprises comme ${companyName} sur leurs enjeux IT.\\n\\nSeriez-vous ouvert à un échange de 15 min ?\\n\\nCordialement`,
        },
        linkedinMessage: `Votre programme IT chez ${companyName} m'interpelle — ouvert à un échange ?`,
        followupMessage: {
          subject: `RE: ${companyName} — expertise IT disponible`,
          body: 'Je me permets de revenir vers vous — avez-vous 15 min cette semaine ?',
        },
      },
      {
        name: 'Sophie Dubois',
        title: 'Head of Data',
        entity: 'Groupe',
        role: 'champion',
        priority: 1,
        summary: 'Responsable data du groupe.',
        whyContact: 'Porte les projets data, besoin de profils techniques.',
        emailMessage: {
          subject: `Profils data pour ${companyName}`,
          body: `Bonjour,\\n\\nNous avons des data engineers expérimentés disponibles.\\n\\nPartante pour un échange ?\\n\\nCordialement`,
        },
        linkedinMessage: `Sophie, votre programme data m'intéresse — on en parle ?`,
        followupMessage: {
          subject: `RE: Profils data pour ${companyName}`,
          body: 'Un de nos data engineers vient de terminer une mission similaire. Ça vous intéresserait ?',
        },
      },
    ],
    angles: [
      { title: 'Angle 1 — Data & IA', description: 'Programme data en cours, besoin de profils techniques.', entry: 'Équipe Data → DSI' },
      { title: 'Angle 2 — Cloud Migration', description: "Migration cloud en cours, besoin d'architectes.", entry: 'Resp. Cloud → Achats' },
      { title: 'Angle 3 — Cybersécurité', description: 'Conformité réglementaire, budget dédié.', entry: 'RSSI → Achats' },
    ],
    actionPlan: {
      strategyType: 'bottom_up',
      strategyJustification: 'Entrer par les opérationnels techniques, démontrer la valeur, puis escalader.',
      weeks: [
        {
          week: 1,
          title: 'Premier contact',
          items: [
            { text: 'Contacter le Head of Data — Email + LinkedIn', done: false },
            { text: 'Envoyer demande de connexion au DSI', done: false },
          ],
        },
        { week: 2, title: 'Relances', items: [{ text: 'Relance Head of Data si pas de réponse', done: false }, { text: 'Contacter le DSI par email', done: false }] },
        { week: 3, title: 'Proposition', items: [{ text: 'Envoyer proposition de profils si RDV obtenu', done: false }, { text: 'Partager une référence client', done: false }] },
        { week: 4, title: 'Escalade ou pivot', items: [{ text: 'Si silence → pivoter vers Angle 2', done: false }, { text: 'Si conversation ouverte → qualifier le besoin', done: false }] },
      ],
    },
  }
}

