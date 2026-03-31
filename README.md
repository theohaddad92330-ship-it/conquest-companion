# Bellum AI — Conquest Companion

## Stack
- **Frontend**: Vite + React + TypeScript + shadcn/ui + Tailwind
- **Backend**: Supabase (Auth, Postgres, RLS, Edge Functions)

## Local dev

### Prérequis
- Node.js + npm
- Accès au projet Supabase (variables `.env`)

### Démarrer

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

URL locale: `http://127.0.0.1:4173`

### Lien HTTPS (tests auth / navigation privée)
Un `https://...` vers `localhost` nécessite un tunnel (ou un proxy TLS local).

Tunnel rapide (URL HTTPS affichée dans la sortie):

```bash
npx --yes cloudflared@latest tunnel --url http://127.0.0.1:4173
```

## Supabase Edge Functions
- `analyze-account`
- `search-companies`
- `generate-messages`

Déployer:

```bash
npx supabase functions deploy analyze-account
npx supabase functions deploy search-companies
npx supabase functions deploy generate-messages
```
