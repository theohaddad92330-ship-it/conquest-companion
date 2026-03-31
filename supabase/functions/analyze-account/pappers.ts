// ============================================================
// PAPPERS — Données entreprises françaises certifiées
// Doc: https://www.pappers.fr/api/documentation
// ============================================================
import { timeoutSignal } from './utils.ts'

const PAPPERS_API_KEY = Deno.env.get('PAPPERS_API_KEY') || ''

function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function legalFormWeight(form: unknown): number {
  if (typeof form !== 'string') return 0
  const s = form.toLowerCase()
  if (s.includes('sa') || s.includes('société anonyme')) return 30
  if (s.includes('sas')) return 26
  if (s.includes('sarl')) return 18
  if (s.includes('sci')) return -20
  if (s.includes('association')) return -15
  if (s.includes('entreprise individuelle') || s.includes('micro')) return -20
  return 0
}

function employeeWeight(tranche: unknown): number {
  if (typeof tranche !== 'string') return 0
  const s = tranche.toLowerCase()
  if (s.includes('10000')) return 100
  if (s.includes('5000')) return 90
  if (s.includes('2000')) return 80
  if (s.includes('1000')) return 70
  if (s.includes('500')) return 60
  if (s.includes('250')) return 50
  if (s.includes('100')) return 40
  if (s.includes('50')) return 30
  if (s.includes('20')) return 20
  if (s.includes('10')) return 10
  return 5
}

export interface PappersCompany {
  siren: string
  siret: string | null
  nom: string
  formeJuridique: string | null
  dateCreation: string | null
  effectifs: string | null
  trancheEffectifs: string | null
  chiffreAffaires: number | null
  resultat: number | null
  siege: {
    adresse: string | null
    codePostal: string | null
    ville: string | null
    region: string | null
  }
  dirigeants: { nom: string; prenom: string; qualite: string; dateNaissance: string | null }[]
  etablissements: { siret: string; enseigne: string | null; adresse: string | null; ville: string | null; codePostal: string | null; estSiege: boolean; enActivite: boolean }[]
  codeNaf: string | null
  libelleNaf: string | null
}

async function fetchPappersBySiren(siren: string, traceId: string, companyNameFallback: string): Promise<PappersCompany | null> {
  const detailUrl = `https://api.pappers.fr/v2/entreprise?api_token=${PAPPERS_API_KEY}&siren=${siren}&champs_supplementaires=dirigeants`
  const detailRes = await fetch(detailUrl, { signal: timeoutSignal(8000) })

  if (!detailRes.ok) {
    console.error(JSON.stringify({ event: 'pappers_detail_error', traceId, status: detailRes.status, siren }))
    return null
  }

  const d = await detailRes.json()

  const dirigeants = Array.isArray(d.representants)
    ? d.representants.slice(0, 20).map((r: any) => ({
        nom: r.nom || r.nom_complet || '',
        prenom: r.prenom || '',
        qualite: r.qualite || '',
        dateNaissance: r.date_de_naissance || null,
      })).filter((r: any) => r.nom)
    : []

  const etablissements = Array.isArray(d.etablissements)
    ? d.etablissements.slice(0, 50).map((e: any) => ({
        siret: e.siret || '',
        enseigne: e.enseigne || e.nom_commercial || null,
        adresse: e.adresse_ligne_1 || null,
        ville: e.ville || null,
        codePostal: e.code_postal || null,
        estSiege: !!e.est_siege,
        enActivite: e.statut_diffusion !== 'N' && !e.date_cessation,
      }))
    : []

  let chiffreAffaires: number | null = null
  let resultat: number | null = null
  if (Array.isArray(d.finances) && d.finances.length > 0) {
    const dernierExercice = d.finances[0]
    chiffreAffaires = dernierExercice.chiffre_affaires ?? null
    resultat = dernierExercice.resultat ?? null
  }

  const company: PappersCompany = {
    siren,
    siret: d.siege?.siret || null,
    nom: d.nom_entreprise || d.denomination || companyNameFallback,
    formeJuridique: d.forme_juridique || null,
    dateCreation: d.date_creation || null,
    effectifs: d.effectifs || d.tranche_effectifs || null,
    trancheEffectifs: d.tranche_effectifs || null,
    chiffreAffaires,
    resultat,
    siege: {
      adresse: d.siege?.adresse_ligne_1 || null,
      codePostal: d.siege?.code_postal || null,
      ville: d.siege?.ville || null,
      region: d.siege?.region || null,
    },
    dirigeants,
    etablissements,
    codeNaf: d.code_naf || null,
    libelleNaf: d.libelle_code_naf || null,
  }

  console.log(JSON.stringify({
    event: 'pappers_done', traceId, siren, nom: company.nom,
    dirigeants: dirigeants.length, etablissements: etablissements.length,
    ca: chiffreAffaires,
  }))

  return company
}

export async function getPappersBySiren(siren: string, traceId: string): Promise<PappersCompany | null> {
  if (!PAPPERS_API_KEY) {
    console.log(JSON.stringify({ event: 'pappers_skip', traceId, reason: 'no_key' }))
    return null
  }
  if (!siren || !/^\d{9}$/.test(siren)) return null
  try {
    return await fetchPappersBySiren(siren, traceId, siren)
  } catch (err) {
    console.error(JSON.stringify({ event: 'pappers_error', traceId, error: (err as Error).message }))
    return null
  }
}

/**
 * Recherche une entreprise par nom et retourne les données Pappers.
 * Flow : recherche par nom → récupère le SIREN → appel /entreprise pour les détails complets.
 */
export async function searchPappers(companyName: string, traceId: string): Promise<PappersCompany | null> {
  if (!PAPPERS_API_KEY) {
    console.log(JSON.stringify({ event: 'pappers_skip', traceId, reason: 'no_key' }))
    return null
  }

  try {
    // Étape 1 : Recherche par nom pour trouver le SIREN
    const searchUrl = `https://api.pappers.fr/v2/recherche?api_token=${PAPPERS_API_KEY}&q=${encodeURIComponent(companyName)}&par_page=20&entreprise_cessee=false`
    const searchRes = await fetch(searchUrl, { signal: timeoutSignal(8000) })

    if (!searchRes.ok) {
      console.error(JSON.stringify({ event: 'pappers_search_error', traceId, status: searchRes.status }))
      return null
    }

    const searchData = await searchRes.json()
    const results = searchData.resultats || []

    if (results.length === 0) {
      console.log(JSON.stringify({ event: 'pappers_no_results', traceId, companyName }))
      return null
    }

    const normalizedQuery = normalizeName(companyName)
    const scored = results
      .map((r: any) => {
        const name = String(r.nom_entreprise || r.denomination || '')
        const normalized = normalizeName(name)
        const exact = normalized === normalizedQuery
        const starts = normalized.startsWith(normalizedQuery)
        const allTokensMatch = normalizedQuery
          .split(' ')
          .filter(Boolean)
          .every((t) => normalized.includes(t))
        const score =
          (exact ? 1000 : 0) +
          (starts ? 150 : 0) +
          (allTokensMatch ? 80 : -50) +
          employeeWeight(r.tranche_effectif) +
          legalFormWeight(r.forme_juridique)
        return { r, score, name }
      })
      .sort((a: any, b: any) => b.score - a.score)

    const best = scored[0]?.r
    const siren = best?.siren
    if (!siren) {
      console.log(JSON.stringify({ event: 'pappers_no_siren', traceId }))
      return null
    }

    const company = await fetchPappersBySiren(siren, traceId, best?.nom_entreprise || best?.denomination || companyName)
    if (company) {
      console.log(JSON.stringify({
        event: 'pappers_selected_match',
        traceId,
        selected: best?.nom_entreprise || best?.denomination || null,
        siren,
      }))
    }
    return company

  } catch (err) {
    console.error(JSON.stringify({ event: 'pappers_error', traceId, error: (err as Error).message }))
    return null
  }
}
