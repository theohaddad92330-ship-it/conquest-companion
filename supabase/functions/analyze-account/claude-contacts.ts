// ============================================================
// CLAUDE PHASE 3 — BELLUM-CONTACTS
// Enrichissement et structuration des contacts
// ============================================================
import { buildProfileContext } from './utils.ts'
import { callClaudeAPI, CLAUDE_CONTACTS_TIMEOUT_MS } from './claude-api.ts'

const MAX_RAW_CONTACTS_FOR_PROMPT = 50
const TARGET_MIN_CONTACTS = 25
const TARGET_IDEAL_CONTACTS = 50

export function parseContactsResult(result: any): { contacts: any[], meta: any } {
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

export async function callClaude_Contacts(companyName: string, rawContacts: any[], research: any, onboardingData: any, traceId: string): Promise<{ contacts: any[], meta: any }> {
  const profile = buildProfileContext(onboardingData)
  const entities = research.entitiesExhaustive || []
  const entitiesStr = entities.length ? JSON.stringify(entities.slice(0, 15)) : '[]'
  const anglesTitles = (research.angles || []).slice(0, 5).map((a: any) => a.title || a).filter(Boolean)
  const painsStr = JSON.stringify((research.pains || []).slice(0, 5).map((p: any) => p.pain || p).filter(Boolean))
  const excludedPersonas = onboardingData.excludedPersonas || []
  const geo = onboardingData.geo || []
  const geoOnlyFranceEU = Array.isArray(geo) && geo.length > 0 && !geo.includes('International')

  const systemPrompt = `Tu es BELLUM. Tu qualifies et enrichis des contacts B2B pour un commercial ESN. L'objectif : lui donner TOUT ce qu'il peut MOBILISER — pas seulement 2-3 C-level.

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

RÈGLES :
- Objectif : entre ${TARGET_MIN_CONTACTS} et ${TARGET_IDEAL_CONTACTS} contacts. Sponsors, champions, opérationnels, achats, influenceurs.
${geoOnlyFranceEU ? '- GÉO : privilégier contacts France / Europe uniquement.' : ''}
- Ne génère PAS les messages ici. On les générera à la demande.

Réponds UNIQUEMENT en JSON valide : {"contacts": [{ "name", "title", "entity", "location", "role", "priority", "summary", "whyContact", "linkedinUrl", "email" }], "organigramme": [], "decisionChain": [], "uncoveredZones": []}.`

  let userPrompt: string
  if (rawContacts.length > 0) {
    const limited = rawContacts.slice(0, MAX_RAW_CONTACTS_FOR_PROMPT)
    userPrompt = `Voici des personnes RÉELLES extraites de sources fiables pour "${companyName}" (${limited.length} noms). CONSERVE STRICTEMENT leurs noms et postes exacts. N'AJOUTE AUCUN nouveau contact.
Enrichis CHAQUE contact existant : entity, role, priority, summary, whyContact, linkedinUrl, email.
Le champ "name" doit rester le nom de personne d'origine (jamais un intitulé de poste).
Retourne exactement ${limited.length} contacts dans le JSON : {"contacts": [...], "organigramme": [], "decisionChain": [], "uncoveredZones": []}.

${JSON.stringify(limited, null, 2)}`
  } else {
    userPrompt = `Génère entre ${TARGET_MIN_CONTACTS} et ${TARGET_IDEAL_CONTACTS} contacts pour "${companyName}".
Entités : ${entitiesStr}
Couverture : décideurs, champions, opérationnels, achats IT, RSSI/experts.

RÈGLE CRITIQUE SUR LES NOMS :
- Chaque contact DOIT avoir un VRAI prénom + nom de famille français réaliste (ex: "Marie Dupont", "Jean-Philippe Martin", "Nathalie Leclerc"). 
- Le champ "name" = prénom + nom UNIQUEMENT. JAMAIS un intitulé de poste.
- Le champ "title" = le poste (ex: "Directeur Data & Analytics").
- Summary : "Profil type suggéré".

Même format JSON : {"contacts": [...], "organigramme": [], "decisionChain": [], "uncoveredZones": []}.`
  }

  // Appel principal
  const result = await callClaudeAPI(systemPrompt, userPrompt, 8000, traceId, 'contacts', CLAUDE_CONTACTS_TIMEOUT_MS)
  if (result) {
    const parsed = parseContactsResult(result)
    if (parsed.contacts.length > 0) {
      if (rawContacts.length > 0) {
        const norm = (v: unknown) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
        const rawByName = new Map<string, any>()
        for (const rc of rawContacts) rawByName.set(norm(rc.name), rc)
        const filtered = parsed.contacts
          .filter((c: any) => rawByName.has(norm(c?.name)))
          .map((c: any) => {
            const base = rawByName.get(norm(c?.name))
            return {
              ...c,
              name: base?.name || c?.name,
              title: c?.title || base?.title || '',
              linkedinUrl: c?.linkedinUrl || c?.linkedin || base?.linkedin || null,
              location: c?.location || base?.location || '',
            }
          })
        if (filtered.length > 0) {
          console.log(JSON.stringify({ event: 'claude_contacts_ok', traceId, count: filtered.length, filteredToRealNames: true }))
          return { contacts: filtered, meta: parsed.meta }
        }
      }
      console.log(JSON.stringify({ event: 'claude_contacts_ok', traceId, count: parsed.contacts.length }))
      return parsed
    }
  }

  // Fallback : génération minimale si le premier appel a échoué
  console.log(JSON.stringify({ event: 'claude_contacts_retry', traceId, reason: result ? 'empty_list' : 'null_response' }))
  const fallbackSystem = `Tu es BELLUM. Génère des contacts B2B en JSON uniquement. Entre ${TARGET_MIN_CONTACTS} et ${TARGET_IDEAL_CONTACTS} contacts. Chaque contact : name, title, entity, role, priority, summary, whyContact, linkedinUrl, email. Pas de texte avant/après.`
  const fallbackUser = `Génère entre ${TARGET_MIN_CONTACTS} et ${TARGET_IDEAL_CONTACTS} contacts pour "${companyName}". Secteur: ${research.sector || 'N/A'}. Entités: ${entitiesStr}. Noms fictifs, postes réalistes.`
  const retryResult = await callClaudeAPI(fallbackSystem, fallbackUser, 6000, traceId, 'contacts_retry', 90000)
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
