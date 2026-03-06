import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAPPERS_API_KEY = Deno.env.get('PAPPERS_API_KEY') || ''

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { query } = await req.json()
    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Si pas de clé Pappers, retourner des suggestions de démonstration
    if (!PAPPERS_API_KEY) {
      const demoResults = generateDemoSuggestions(query)
      return new Response(JSON.stringify({ results: demoResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Appel API Pappers
    const res = await fetch(
      `https://api.pappers.fr/v2/recherche?api_token=${PAPPERS_API_KEY}&q=${encodeURIComponent(query)}&par_page=5`,
      { signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json()

    const results = (data.resultats || []).map((r: Record<string, unknown>) => ({
      name: r.nom_entreprise || r.denomination || query,
      siren: r.siren || null,
      city: (r.siege as { ville?: string })?.ville || null,
      postalCode: (r.siege as { code_postal?: string })?.code_postal || null,
      sector: r.libelle_code_naf || null,
      employees: r.tranche_effectif || null,
      legalForm: r.forme_juridique || null,
    }))

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ results: [], error: message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function generateDemoSuggestions(query: string) {
  const allCompanies = [
    { name: 'Société Générale', siren: '552120222', city: 'Paris La Défense', sector: 'Banque', employees: '117 000', postalCode: null, legalForm: null },
    { name: 'Sopra Steria', siren: '326820065', city: 'Paris', sector: 'ESN', employees: '56 000', postalCode: null, legalForm: null },
    { name: 'BNP Paribas', siren: '662042449', city: 'Paris 9ème', sector: 'Banque', employees: '185 000', postalCode: null, legalForm: null },
    { name: 'Capgemini', siren: '330703844', city: 'Paris', sector: 'ESN', employees: '360 000', postalCode: null, legalForm: null },
    { name: 'Airbus', siren: '383474814', city: 'Toulouse', sector: 'Aéronautique', employees: '130 000', postalCode: null, legalForm: null },
    { name: 'SNCF', siren: '552049447', city: 'Saint-Denis', sector: 'Transport', employees: '270 000', postalCode: null, legalForm: null },
    { name: 'TotalEnergies', siren: '542051180', city: 'La Défense', sector: 'Énergie', employees: '100 000', postalCode: null, legalForm: null },
    { name: 'Orange', siren: '380129866', city: 'Paris', sector: 'Telecom', employees: '137 000', postalCode: null, legalForm: null },
    { name: 'Crédit Agricole', siren: '784608416', city: 'Montrouge', sector: 'Banque', employees: '75 000', postalCode: null, legalForm: null },
    { name: 'Accenture France', siren: '732829320', city: 'Paris', sector: 'Conseil', employees: '12 000', postalCode: null, legalForm: null },
    { name: 'Atos', siren: '323623603', city: 'Bezons', sector: 'ESN', employees: '95 000', postalCode: null, legalForm: null },
    { name: 'Thales', siren: '552059024', city: 'La Défense', sector: 'Défense', employees: '81 000', postalCode: null, legalForm: null },
    { name: 'Devoteam', siren: '402490830', city: 'Levallois-Perret', sector: 'ESN', employees: '10 000', postalCode: null, legalForm: null },
    { name: 'Alten', siren: '348607417', city: 'Boulogne-Billancourt', sector: 'Ingénierie', employees: '57 000', postalCode: null, legalForm: null },
    { name: 'CGI France', siren: '702042755', city: 'Paris', sector: 'ESN', employees: '90 000', postalCode: null, legalForm: null },
  ]
  const q = query.toLowerCase()
  return allCompanies
    .filter(c => c.name.toLowerCase().includes(q))
    .slice(0, 5)
}
