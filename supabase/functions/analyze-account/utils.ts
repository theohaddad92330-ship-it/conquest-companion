// ============================================================
// UTILS — Fonctions partagées par tous les modules
// ============================================================

export function cors() {
  const origin = Deno.env.get('ALLOWED_ORIGINS')?.trim()
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors() })
}

export function err(message: string, code: string, traceId: string, status = 400, details?: Record<string, unknown>) {
  const payload: any = { error: { message, code, traceId } }
  if (details && typeof details === 'object') payload.error.details = details
  return json(payload, status)
}

export function timeoutSignal(ms: number): AbortSignal {
  const anyAbortSignal = AbortSignal as any
  if (anyAbortSignal && typeof anyAbortSignal.timeout === 'function') {
    return anyAbortSignal.timeout(ms) as AbortSignal
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}

export async function setAnalysisStep(supabase: any, accountId: string, step: string, progress: number, traceId: string, extra?: Record<string, unknown>) {
  const analysis_trace = { ...(extra ? extra : {}), traceId, at: new Date().toISOString() }
  try {
    await supabase
      .from('accounts')
      .update({ analysis_step: step, analysis_progress: Math.max(0, Math.min(100, Math.round(progress))), analysis_trace })
      .eq('id', accountId)
  } catch {
    // silently ignore step tracking errors
  }
}

export function buildProfileContext(onboardingData: any): { geoFocus: string; personaFocus: string; oneLiner: string } {
  const geo = onboardingData.geo || []
  const hasInternational = Array.isArray(geo) && geo.includes('International')
  const geoFocus = hasInternational ? 'Monde' : (Array.isArray(geo) && geo.length > 0 ? 'France et Europe (priorité aux zones choisies par l\'utilisateur)' : 'France et Europe')
  const personas = onboardingData.personas || []
  const personaFocus = Array.isArray(personas) && personas.length > 0 ? personas.join(', ') : 'DSI, CTO, Directeurs, Achats IT, Opérationnels'
  const sectors = (onboardingData.sectors || []).slice(0, 3).join(', ')
  const oneLiner = [onboardingData.esnName, onboardingData.size, sectors, geoFocus].filter(Boolean).join(' · ')
  return { geoFocus, personaFocus, oneLiner }
}

export function normalizeActionPlanWeeks(raw: any[]): any[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  const first = raw[0]
  if (first?.items && Array.isArray(first.items)) return raw
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

const allowedRoles = ['sponsor', 'champion', 'operational', 'purchasing', 'blocker', 'influencer', 'unknown'] as const

export function normRole(r: any): string {
  const s = String(r || 'unknown').toLowerCase()
  if ((allowedRoles as readonly string[]).includes(s)) return s
  if (['achats', 'achat'].includes(s)) return 'purchasing'
  if (['decideur', 'c-level', 'clevel', 'sponsor'].includes(s)) return 'sponsor'
  if (['operationnel', 'ops'].includes(s)) return 'operational'
  return 'unknown'
}
