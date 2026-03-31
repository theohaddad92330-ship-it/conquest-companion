// ============================================================
// CLAUDE PHASE 4 — BELLUM-PLAN
// Plan d'action commercial final
// ============================================================
import { buildProfileContext } from './utils.ts'
import { callClaudeAPI } from './claude-api.ts'

export async function callClaude_Plan(companyName: string, research: any, contacts: any[], onboardingData: any, traceId: string): Promise<any | null> {
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
- Plan SÉQUENCÉ : MAINTENANT (S1) → MOIS 1 → MOIS 2-3 → MOIS 3-6 → MOIS 6-12.
- Chaque phase avec des actions concrètes : verbe + contact + canal + deadline + KPI.
- Volume et durée adaptés au cycle et à la taille d'équipe.
- evaluation : go/no-go, score, risques, quick wins.

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
