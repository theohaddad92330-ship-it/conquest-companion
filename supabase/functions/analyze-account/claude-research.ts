// ============================================================
// CLAUDE PHASE 1 — BELLUM-RESEARCH
// Analyse du compte : fiche, signaux, angles, contacts web
// ============================================================
import { buildProfileContext } from './utils.ts'
import { callClaudeAPI } from './claude-api.ts'

export async function callClaude_Research(companyName: string, braveResults: any, scrapedContent: string, userContext: string | null, onboardingData: any, traceId: string, pappersData?: any): Promise<any | null> {
  const profile = buildProfileContext(onboardingData)
  const pappersSummary = pappersData
    ? {
        nom: pappersData.nom,
        siren: pappersData.siren,
        formeJuridique: pappersData.formeJuridique,
        effectifs: pappersData.effectifs,
        chiffreAffaires: pappersData.chiffreAffaires,
        siege: pappersData.siege,
        dirigeants: Array.isArray(pappersData.dirigeants) ? pappersData.dirigeants.slice(0, 10) : [],
        etablissementsActifs: Array.isArray(pappersData.etablissements)
          ? pappersData.etablissements.filter((e: any) => e.enActivite).slice(0, 20)
          : [],
      }
    : null

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

PEOPLEMENTIONED : extraire les personnes RÉELLES les plus pertinentes mentionnées dans le contenu (nominations, interviews, communiqués). Viser 10 à 20 noms maximum — qualité > quantité. Chaque entrée : name, title, context, source. Ne pas inventer de noms.

Réponds UNIQUEMENT en JSON valide. Pas de texte avant/après. Pas de backticks.`

  const userPrompt = `Analyse le compte "${companyName}".

DONNÉES WEB :
${JSON.stringify(braveResults.results.slice(0, 30), null, 2)}

CONTENU SCRAPÉ :
${scrapedContent.slice(0, 40000)}

DONNÉES PAPPERS CERTIFIÉES (prioritaires si disponibles) :
${JSON.stringify(pappersSummary, null, 2)}

RÈGLES CRITIQUES :
- businessDescription : en 2-3 phrases simples, ce que fait concrètement cette entreprise (pas juste le secteur).
- programNames : des VRAIS noms de programmes/projets (ex. "Programme NEMO", "Projet Phoenix"), pas des thématiques génériques. Si trouvé dans les données, les citer. Sinon "Non détecté".
- entitiesExhaustive : inclure sièges et entités en RÉGION (sièges locaux, directions régionales), pas seulement le siège central. Pour les groupes (ex. banques) : filiales métiers (RESG, banque de détail, banque privée, etc.) avec type et parent.
- sitesFrance : à partir du siège, des filiales et entitiesExhaustive, lister les sites/localisations en France uniquement (ville, région, type, label, importance).
- esnSynergies : identifier les ESN déjà en place sur le compte. Pour chacune : nom, type de présence, niveau de certitude (0-100), conseil concret pour l'utilisateur.
- priorityScore : DOIT refléter la difficulté pour CE profil. Justification détaillée dans priorityJustification.overall.
- peopleMentioned : lister les 10-20 personnes réelles les plus pertinentes trouvées dans le contenu. Privilégier décideurs, directeurs et opérationnels IT. Qualité > quantité.
- linkedinSearchKeywords : generic doit inclure les sujets que l'utilisateur attaque : Data, Cyber, IT, Tech, Agile, Scrum, Dev, Digital. byEntity : pour chaque entité identifiée, des mots-clés ciblés.

Produis ce JSON :
{
  "companyNameCorrected": "Nom exact",
  "businessDescription": "Ce que fait concrètement cette entreprise en 2-3 phrases",
  "sector": "Secteur",
  "employees": "Effectifs",
  "revenue": "CA",
  "headquarters": "Siège",
  "website": "URL",
  "isPublic": false,
  "subsidiaries": ["Filiale 1"],
  "entitiesExhaustive": [{"name": "Entité", "type": "filiale|BU|siège_régional|groupe", "parent": "Parent", "region": "Région"}],
  "sitesFrance": [{"city": "Paris", "region": "Île-de-France", "type": "siège|filiale|direction_régionale", "label": "Siège social", "importance": "haute|moyenne|basse"}],
  "programNames": [{"name": "Nom RÉEL", "entity": "Entité", "description": "Desc", "technologies": ["Tech"]}],
  "budgetSignals": ["Signal 1"],
  "itChallenges": ["Enjeu 1"],
  "recentSignals": [{"signal": "Description", "source": "Source", "type": "recrutement|nomination|investissement"}],
  "pains": [{"pain": "Description", "impact": "Impact", "offer": "Offre ESN", "urgency": "haute|moyenne|basse"}],
  "priorityScore": 5,
  "priorityJustification": {"urgency": {"score": 5, "justification": "..."}, "accessibility": {"score": 5, "justification": "..."}, "competition": {"score": 5, "justification": "..."}, "alignment": {"score": 5, "justification": "..."}, "potential": {"score": 5, "justification": "..."}, "overall": "Justification détaillée"},
  "competitors": [{"name": "ESN", "perimeter": "Périmètre", "strength": "Forces", "weakness": "Faiblesses"}],
  "esnSynergies": [{"name": "Nom ESN", "certainty": 78, "presenceType": "referencement_rang1|partenaire|niche|probable", "why": "Raison", "adviceForUser": "Conseil"}],
  "technologyStack": ["Tech 1"],
  "regulations": ["NIS2", "RGPD"],
  "angles": [{"title": "Titre", "description": "Description", "entry": "Contact d'entrée", "offer": "Offre ESN"}],
  "commentOuvrirCompte": {"strategy": "Stratégie 200+ mots", "entryPoints": [{"label": "Porte d'entrée", "targetProfile": "Type contact", "angle": "Angle", "justification": "Pourquoi", "risks": "Risques", "planB": "Alternative"}]},
  "rdvScript": {"opening": {"instructions": "...", "recommendedPhrase": "..."}, "positioning": {"instructions": "..."}, "exploration": {"instructions": "..."}, "proposal": {"instructions": "..."}, "closing": {"instructions": "..."}},
  "powerQuestions": [{"question": "Question", "purpose": "Ce qu'on révèle", "timing": "début|milieu|fin"}],
  "objections": [{"objection": "Objection", "realMeaning": "Lecture réelle", "response": "Réponse", "mirrorQuestion": "Question miroir"}],
  "linkedinSearchKeywords": {"byEntity": [{"entity": "Entité", "keywords": ["DSI", "Head of Data"]}], "generic": ["DSI", "CTO", "Achats IT"]},
  "peopleMentioned": [{"name": "Prénom Nom", "title": "Poste", "context": "Citation", "source": "URL ou titre"}],
  "organigrammeLogic": {"hierarchy": "Qui est au-dessus de qui", "siblingEntities": "Filiales côte à côte", "entryPoints": "Quelles entités pour quels types de ventes"}
}`

  return await callClaudeAPI(systemPrompt, userPrompt, 16000, traceId, 'research')
}
