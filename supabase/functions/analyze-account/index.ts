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

    const { companyName, userContext } = await req.json()
    if (!companyName) throw new Error('companyName requis')

    // Vérifier les crédits
    const { data: credits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (credits && credits.accounts_used >= credits.accounts_limit) {
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================
// CHAÎNE D'ORCHESTRATION PRINCIPALE
// ============================================
async function processAnalysis(supabase: any, accountId: string, userId: string, companyName: string, userContext: string | null, onboardingData: any) {
  try {
    // ÉTAPE 1 — Recherche web
    const braveResults = await searchBrave(companyName)

    // ÉTAPE 2 — Scraping pages
    const scrapedContent = await scrapePages(braveResults.urls?.slice(0, 5) || [])

    // ÉTAPE 3 — Données entreprise FR
    const pappersData = await searchPappers(companyName)

    // ÉTAPE 4 — Analyse IA complète (Claude)
    const analysis = await analyzeWithClaude(companyName, braveResults, scrapedContent, pappersData, userContext, onboardingData)

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
      status: 'completed',
    }).eq('id', accountId)

    // Sauvegarder les contacts
    if (analysis.contacts?.length > 0) {
      await supabase.from('contacts').insert(
        analysis.contacts.map((c: any, i: number) => ({
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
          source: 'ai_generated',
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

    // Incrémenter les crédits
    await supabase.rpc('increment_accounts_used', { p_user_id: userId })

  } catch (error: any) {
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

// ============================================
// ANALYSE IA AVEC CLAUDE
// ============================================

async function analyzeWithClaude(companyName: string, braveResults: any, scrapedContent: string, pappersData: any, userContext: string | null, onboardingData: any) {
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
- Les messages doivent être professionnels, personnalisés, et mentionner les offres de l'ESN.`

  const userPrompt = `Analyse le compte "${companyName}".

DONNÉES WEB :
${JSON.stringify(braveResults.results?.slice(0, 5), null, 2)}

CONTENU SCRAPÉ :
${scrapedContent.slice(0, 8000)}

DONNÉES PAPPERS :
${JSON.stringify(pappersData, null, 2)}

Produis un JSON avec EXACTEMENT cette structure :
{
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
  return JSON.parse(clean)
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


