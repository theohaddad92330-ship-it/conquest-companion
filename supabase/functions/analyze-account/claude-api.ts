// ============================================================
// CLAUDE API — Appel générique avec parsing JSON robuste
// ============================================================
import { timeoutSignal } from './utils.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''

export const CLAUDE_DEFAULT_TIMEOUT_MS = 120000
export const CLAUDE_CONTACTS_TIMEOUT_MS = 200000

export async function callClaudeAPI(systemPrompt: string, userPrompt: string, maxTokens: number, traceId: string, phase: string, timeoutMs?: number): Promise<any | null> {
  const timeout = timeoutMs ?? CLAUDE_DEFAULT_TIMEOUT_MS
  console.log(JSON.stringify({ event: `claude_${phase}_start`, traceId, systemLen: systemPrompt.length, userLen: userPrompt.length, timeoutMs: timeout }))

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
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: timeoutSignal(timeout),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error(JSON.stringify({ event: `claude_${phase}_http_error`, traceId, status: res.status, body: errBody.slice(0, 500) }))
      return null
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    if (!text) {
      console.error(JSON.stringify({ event: `claude_${phase}_empty_response`, traceId }))
      return null
    }

    console.log(JSON.stringify({ event: `claude_${phase}_raw`, traceId, len: text.length, preview: text.slice(0, 150) }))
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      return extractJson(clean)
    } catch (parseErr) {
      console.error(JSON.stringify({ event: `claude_${phase}_parse_error`, traceId, first300: clean.slice(0, 300), last200: clean.slice(-200) }))
      return null
    }
  } catch (err) {
    console.error(JSON.stringify({ event: `claude_${phase}_fetch_error`, traceId, error: (err as Error).message }))
    return null
  }
}

function extractJson(s: string): any {
  const trimmed = s.trim()
  const firstBrace = trimmed.indexOf('{')
  const firstBracket = trimmed.indexOf('[')
  if (firstBracket >= 0 && (firstBrace < 0 || firstBracket < firstBrace)) {
    const lastBracket = trimmed.lastIndexOf(']')
    if (lastBracket > firstBracket) {
      return JSON.parse(trimmed.slice(firstBracket, lastBracket + 1))
    }
  }
  if (firstBrace >= 0) {
    let depth = 0
    let end = -1
    for (let i = firstBrace; i < trimmed.length; i++) {
      if (trimmed[i] === '{') depth++
      else if (trimmed[i] === '}') { depth--; if (depth === 0) { end = i; break } }
    }
    if (end > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, end + 1))
    }
  }
  return JSON.parse(trimmed)
}
