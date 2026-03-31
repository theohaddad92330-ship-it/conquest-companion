import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

function err(message: string, code: string, traceId: string, status = 400, details?: Record<string, unknown>) {
  const payload: any = { error: { message, code, traceId } }
  if (details && typeof details === 'object') payload.error.details = details
  return json(payload, status)
}

async function callClaude(systemPrompt: string, userPrompt: string, traceId: string, timeoutMs = 120000) {
  if (!ANTHROPIC_API_KEY) return null
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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(JSON.stringify({ event: 'claude_http_error', traceId, status: res.status, body: body.slice(0, 500) }))
      return null
    }
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    if (!text) return null
    const clean = String(text).replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    // Extract object JSON
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    const candidate = first >= 0 && last > first ? clean.slice(first, last + 1) : clean
    return JSON.parse(candidate)
  } catch (e) {
    console.error(JSON.stringify({ event: 'claude_fetch_error', traceId, error: e instanceof Error ? e.message : 'unknown' }))
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  const traceId = crypto.randomUUID().slice(0, 8)

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return err('Non authentifié', 'AUTH_REQUIRED', traceId, 401)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', '').trim())
    if (authErr || !user) return err('Non authentifié', 'AUTH_INVALID', traceId, 401)

    const body = await req.json().catch(() => ({}))
    const accountId = typeof body.accountId === 'string' ? body.accountId : ''
    const contactIds = Array.isArray(body.contactIds) ? body.contactIds.filter((x: any) => typeof x === 'string') : null
    const limit = Math.min(50, Math.max(1, Number(body.limit ?? 20) || 20))
    if (!accountId) return err('accountId requis', 'BAD_INPUT', traceId, 400)

    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', user.id)
      .single()
    if (accErr || !account) return err('Compte introuvable', 'NOT_FOUND', traceId, 404)

    // IMPORTANT: cette fonction ne doit jamais écraser l'état global d'analyse (analysis_step/progress).
    // Elle ne fait que générer/mettre à jour des messages sur les contacts.
    try {
      const prevTrace = (account as any).analysis_trace && typeof (account as any).analysis_trace === 'object'
        ? (account as any).analysis_trace
        : {}
      await supabase.from('accounts').update({
        messages_last_generated_trace: { traceId, at: new Date().toISOString(), status: 'running' },
        analysis_trace: {
          ...prevTrace,
          messages: { traceId, at: new Date().toISOString(), status: 'running' },
        },
      }).eq('id', accountId)
    } catch {
      // ignore trace failures
    }

    let contactsQuery = supabase
      .from('contacts')
      .select('*')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .order('priority', { ascending: true })
      .limit(limit)

    if (contactIds && contactIds.length > 0) {
      contactsQuery = supabase
        .from('contacts')
        .select('*')
        .eq('account_id', accountId)
        .eq('user_id', user.id)
        .in('id', contactIds)
        .limit(50)
    }

    const { data: contacts } = await contactsQuery
    const list = Array.isArray(contacts) ? contacts : []
    if (list.length === 0) return err('Aucun contact', 'NO_CONTACTS', traceId, 400)

    if (!ANTHROPIC_API_KEY) {
      return err("Configuration API incomplète — contactez le support.", "MISSING_KEYS", traceId, 500, { missingKeys: ["ANTHROPIC_API_KEY"] })
    }

    const raw = (account as any).raw_analysis || {}
    const context = {
      company: (account as any).company_name,
      sector: (account as any).sector,
      itChallenges: (account as any).it_challenges || [],
      recentSignals: (account as any).recent_signals || [],
      angles: raw.angles || [],
      pains: raw.pains || [],
      commentOuvrirCompte: raw.commentOuvrirCompte || null,
    }

    const systemPrompt = `Tu es BELLUM. Tu écris des messages B2B de prospection ultra-courts et personnalisés.
RÈGLES:
- Email: objet max 60 caractères. Corps max 150 mots. 1 seule demande claire.
- LinkedIn: max 300 caractères.
- Relance J+5: max 80 mots, angle différent (pas une répétition).
- Pas de blabla. Pas de template générique. Toujours 1 fait ou signal du compte, ou un enjeu IT concret.
Réponds UNIQUEMENT en JSON valide:
{"email":{"subject":"","body":""},"linkedin":"","followup":{"subject":"","body":""}}`

    let updated = 0
    for (const c of list) {
      const userPrompt = `Compte: ${JSON.stringify(context)}
Contact: ${JSON.stringify({
        full_name: c.full_name,
        title: c.title,
        entity: c.entity,
        decision_role: c.decision_role,
        why_contact: c.why_contact,
      })}
Écris les 3 messages.`

      const out = await callClaude(systemPrompt, userPrompt, traceId, 120000)
      if (!out) continue

      const email = out.email && typeof out.email === 'object' ? out.email : null
      const follow = out.followup && typeof out.followup === 'object' ? out.followup : null
      const linkedin = typeof out.linkedin === 'string' ? out.linkedin : null
      const email_message = email ? { subject: String(email.subject || '').slice(0, 200), body: String(email.body || '').slice(0, 2000) } : null
      const followup_message = follow ? { subject: String(follow.subject || '').slice(0, 200), body: String(follow.body || '').slice(0, 2000) } : null

      const { error: updErr } = await supabase
        .from('contacts')
        .update({
          email_message,
          linkedin_message: linkedin ? linkedin.slice(0, 3000) : null,
          followup_message,
        })
        .eq('id', c.id)
        .eq('user_id', user.id)
      if (!updErr) updated++
    }

    // Metadonnées dédiées messages (sans toucher analysis_step/progress)
    try {
      const prevTrace = (account as any).analysis_trace && typeof (account as any).analysis_trace === 'object'
        ? (account as any).analysis_trace
        : {}
      await supabase.from('accounts').update({
        messages_last_generated_at: new Date().toISOString(),
        messages_last_generated_count: updated,
        messages_last_generated_trace: { traceId, at: new Date().toISOString(), status: 'ok', updated },
        analysis_trace: {
          ...prevTrace,
          messages: { traceId, at: new Date().toISOString(), status: 'ok', updated },
        },
      }).eq('id', accountId)
    } catch {
      // ignore
    }

    return json({ updated, traceId })
  } catch (e) {
    console.error(JSON.stringify({ event: 'serve_error', traceId, error: e instanceof Error ? e.message : 'unknown' }))
    return err('Erreur serveur', 'SERVER_ERROR', traceId, 500)
  }
})

