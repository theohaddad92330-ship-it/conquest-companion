import { supabase } from "@/integrations/supabase/client";

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

function baseUrl() {
  return String(import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
}

function publishableKey() {
  return String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();
}

export async function authedPostJson<TResponse extends JsonValue>(
  functionName: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: TResponse } | { ok: false; error: string; status?: number }> {
  const base = baseUrl();
  const apikey = publishableKey();
  if (!base.startsWith("https://") || !apikey) {
    return {
      ok: false,
      error:
        "Configuration Supabase invalide (.env). Vérifie VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY puis redémarre le serveur.",
    };
  }

  await supabase.auth.refreshSession().catch(() => {});
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: "Session expirée. Veuillez vous reconnecter.", status: 401 };
  }

  try {
    const res = await fetch(`${base}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apikey,
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: any = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    if (!res.ok) {
      return {
        ok: false,
        error: parsed?.error || text.slice(0, 300) || `Erreur ${res.status} ${res.statusText}`,
        status: res.status,
      };
    }
    return { ok: true, data: parsed as TResponse };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch" || /network|fetch/i.test(msg)) {
      return { ok: false, error: "Connexion impossible vers Supabase (réseau/VPN/pare-feu).", status: 0 };
    }
    return { ok: false, error: msg, status: 0 };
  }
}

