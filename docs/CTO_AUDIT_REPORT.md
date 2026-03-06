# Rapport d'audit CTO — Bellum AI

**Date** : 6 mars 2026  
**Périmètre** : Audit technique complet, sécurité, qualité, industrialisation.  
**Posture** : CTO hands-on, orientation production et maintenabilité.

---

## 1. Résumé exécutif

**État global** : Projet SaaS d’intelligence commerciale pour ESN (analyse de comptes, contacts, angles d’attaque, plans d’action). Stack moderne (Vite, React, TypeScript, Supabase, Edge Functions). Le produit est fonctionnel mais présente des risques de production et de la dette technique significative.

**Maturité technique** : **Faible à moyenne**.  
- Points positifs : stack cohérente, RLS sur les tables métier, crédits transactionnels, rate limiting côté backend, logs structurés dans l’Edge Function.  
- Points négatifs : TypeScript peu strict, quasi absence de tests, duplication de code corrigée, `.env` non ignoré (corrigé), migrations en doublon, pas de CI/CD visible.

**Niveau de risque global** : **Élevé** pour une mise en production sans durcissement. Risques principaux : fuite de secrets si `.env` est commité, conflit de migrations, surface d’attaque Edge Function (CORS large, validation d’entrée limitée avant correctifs), absence de tests de non-régression.

**Verdict** : Le projet peut évoluer vers la production à condition de traiter les points P0/P1 identifiés, d’ajouter des tests sur les flux critiques et de clarifier la stratégie de migrations. Plusieurs correctifs ont été appliqués dans le cadre de cet audit.

---

## 2. Cartographie du système

### Stack
- **Frontend** : Vite 5, React 18, TypeScript 5, Tailwind, shadcn/ui, Framer Motion, Recharts, TanStack Query, React Router.
- **Backend / BDD** : Supabase (PostgreSQL, Auth, Edge Functions Deno).
- **Tests** : Vitest, Testing Library (présents mais peu utilisés).

### Architecture observée
- **Front** : SPA avec routes protégées (`ProtectedRoute`), contexte Auth (Supabase Auth + Lovable OAuth Google). Données via hooks React Query qui appellent Supabase (RLS).
- **Back** : Une Edge Function `analyze-account` (orchestration Brave, Firecrawl, Pappers, Claude, Apify, RAG). Crédits et rate limit gérés en SQL (fonctions transactionnelles).
- **Flux critique** : Utilisateur authentifié → recherche entreprise → `analyze-account` (JWT) → création compte → `processAnalysis` en arrière-plan → polling front → affichage fiche compte / contacts / angles / plan.

### Zones critiques
- Authentification et garde-fou des routes (ProtectedRoute, onboarding).
- Edge Function `analyze-account` (auth, validation entrée, coûts, erreurs).
- Hooks Supabase (useAccounts, useAccount, useCredits, useProfile, useAnalysisPolling).
- Pages : Search (lancement analyse), AccountDetail (données sensibles), Billing (crédits), Profile (données utilisateur).

---

## 3. Liste priorisée des problèmes

### P0 — Critique immédiat

| # | Titre | Zone | Problème | Risque | Recommandation | Statut |
|---|--------|------|----------|--------|----------------|--------|
| 1 | Fichier `.env` non ignoré par Git | Repo | `.env` pouvait être commité. | Fuite de clés (Supabase, etc.). | Ajouter `.env` et `.env.*` au `.gitignore`. | **Corrigé** |
| 2 | Duplication complète dans `useAccounts.ts` | `src/hooks/useAccounts.ts` | Tout le fichier était dupliqué (l.95–191), deuxième bloc écrasant le premier, perte de `refetch`, incohérence `maybeSingle`/`single`. | Comportement indéfini, régressions, maintenance impossible. | Supprimer le bloc dupliqué, garder une seule définition des hooks. | **Corrigé** |

### P1 — Important

| # | Titre | Zone | Problème | Risque | Recommandation | Statut |
|---|--------|------|----------|--------|----------------|--------|
| 3 | Aucune validation d’entrée Edge Function | `analyze-account/index.ts` | `companyName` et `userContext` non trimmés, pas de limite de longueur. | DoS (payload énorme), abus, injection dans le prompt. | Valider type, trim, longueur max (ex. 200 caractères pour companyName, 2000 pour userContext). | **Corrigé** |
| 4 | RLS absent sur `rag_documents` | BDD | Table créée sans RLS. | Accès non maîtrisé selon les grants par défaut. | Activer RLS et définir des politiques explicites (ex. lecture/écriture pour `authenticated`). | **Corrigé** (migration `20260306150000_rag_documents_rls.sql`) |
| 5 | Conflit de migrations | `supabase/migrations/` | `20260306081000` et `20260306120000` créent les mêmes tables (accounts, contacts, etc.). | Échec au run des migrations ou schéma incohérent. | Conserver une seule chaîne de migrations (ex. garder 20260306120000 + suivantes), archiver ou supprimer l’autre. | **À traiter** (décision à prendre selon l’historique déploiement) |
| 6 | TypeScript peu strict | `tsconfig.json` | `strictNullChecks`, `noImplicitAny`, `noUnusedLocals` désactivés. | Bugs silencieux, refactors risqués. | Activer progressivement `strictNullChecks` et `noImplicitAny`. | **À traiter** |
| 7 | Pas de script `typecheck` | `package.json` | Impossible de vérifier les types sans build. | Erreurs de type non détectées en CI/local. | Ajouter `"typecheck": "tsc --noEmit"`. | **Corrigé** |

### P2 — Amélioration structurante

| # | Titre | Zone | Problème | Risque | Recommandation | Statut |
|---|--------|------|----------|--------|----------------|--------|
| 8 | Quasi absence de tests | Projet | Un seul test “example” + un test ajouté pour `export-csv`. | Régressions, peur de refactorer. | Ajouter tests unitaires (utils, hooks sans Supabase), tests d’intégration (flux critique). | **Partiellement corrigé** (test export-csv ajouté) |
| 9 | Gestion d’erreur Edge Function trop bavarde | `analyze-account/index.ts` | `error.message` renvoyé tel quel au client. | Fuite d’infos internes. | Renvoyer un message générique ou codé, logger le détail côté serveur. | **Partiellement corrigé** (utilisation d’un message string sécurisé) |
| 10 | CORS `*` sur Edge Function | `analyze-account/index.ts` | `Access-Control-Allow-Origin: '*'`. | Utilisable depuis n’importe quelle origine. | En prod, restreindre aux origines autorisées. | **À traiter** |
| 11 | Pas de CI/CD | Repo | Aucun pipeline visible (build, lint, test, typecheck). | Régressions livrées, pas de gate qualité. | Ajouter GitHub Actions (ou équivalent) : lint, typecheck, test, build. | **À traiter** |

### P3 — Craftsmanship

| # | Titre | Zone | Problème | Risque | Recommandation | Statut |
|---|--------|------|----------|--------|----------------|--------|
| 12 | Types Supabase incomplets | `integrations/supabase/types.ts` | Seul `profiles` est typé ; accounts, contacts, etc. absents. | Typage faible, risque d’erreurs. | Générer les types depuis le schéma (supabase gen types) ou les compléter à la main. | **À traiter** |
| 13 | README générique | `README.md` | Contenu Lovable par défaut, peu d’infos run/env. | Onboarding dev difficile. | Documenter variables d’env, commandes (dev, build, test, typecheck), structure du projet. | **À traiter** |

---

## 4. Cybersécurité

### Synthèse des risques
- **Secrets** : `.env` non ignoré → risque de commit (corrigé).
- **Auth** : JWT vérifié dans l’Edge Function ; RLS sur accounts/contacts/plans/credits/profiles. Pas de contournement identifié.
- **Entrées** : Validation et limites sur `companyName` / `userContext` ajoutées dans l’Edge Function.
- **CORS** : Trop permissif ; à restreindre en prod.
- **RLS** : `rag_documents` sécurisé par nouvelle migration.
- **Injection** : Pas de requêtes SQL construites à la main ; usage du client Supabase. Prompt injection possible via `userContext` (limité à 2000 caractères, à surveiller).

### Vulnérabilités / faiblesses identifiées
- Exposition potentielle de messages d’erreur détaillés (réduit par retour explicite d’un message string).
- Pas de rate limiting côté front (le rate limit côté backend limite les abus).
- `dangerouslySetInnerHTML` dans `chart.tsx` : usage limité à du CSS issu d’un objet fixe (THEMES) → risque faible.

### Remédiations appliquées
- `.env` ajouté au `.gitignore`.
- Validation et plafonnement des entrées dans l’Edge Function.
- Réponse d’erreur sans exposition d’objet brut.
- RLS + politiques sur `rag_documents`.

### Remédiations restantes
- Restreindre CORS en production.
- Envisager un rate limiting côté front (ex. désactivation bouton après N clics).
- Documenter la gestion des secrets (Supabase Dashboard, pas de clés en dur).

---

## 5. Qualité du code / craftsmanship

### Problèmes traités
- **useAccounts.ts** : suppression du bloc dupliqué (environ 95 lignes), une seule définition des hooks, `refetch` conservé, `maybeSingle()` cohérent pour le plan d’action.

### Points restants
- **Composants lourds** : `AccountDetail.tsx`, `Dashboard.tsx` restent longs ; à découper (sous-composants, hooks métier).
- **Edge Function** : `processAnalysis` et `analyzeWithClaude` très longues ; à extraire en modules/fonctions plus petites.
- **Duplication** : patterns de chargement/erreur répétés entre pages ; envisager un composant `DataBoundary` ou des hooks communs.
- **Nommage** : cohérent dans l’ensemble ; quelques `any` résiduels (ex. `export-csv`, types Supabase).

---

## 6. Tests

### Existant
- Vitest + jsdom + Testing Library configurés.
- Un test “example” et un test pour `export-csv` (generateCSV : BOM, en-têtes, escaping, tableau vide).

### Manquant
- Tests unitaires : autres utils, hooks (avec mocks Supabase), composants critiques.
- Tests d’intégration : flux Search → analyse → AccountDetail (avec Supabase local ou mock).
- Tests E2E : parcours login, recherche, consultation fiche.

### Ajouté
- `src/lib/__tests__/export-csv.test.ts` (génération CSV, escaping, cas vide).

### À couvrir en priorité
- Hooks `useAccounts`, `useCredits`, `useAnalysisPolling` (mocks).
- Edge Function (tests unitaires des helpers si extraits en modules testables).
- Page Search (comportement avec erreur / succès).

---

## 7. Base de données / logique métier / intégrité

### Risques identifiés
- **Migrations** : deux fichiers créent les mêmes tables → conflit à résoudre (ordre d’exécution, suppression ou fusion).
- **user_credits** : initialisation des crédits pour les nouveaux utilisateurs (trigger ou fonction) à confirmer dans les migrations existantes.
- **rag_documents** : pas de `user_id` → base partagée ; RLS en lecture/écriture pour tout `authenticated`.

### Améliorations apportées
- RLS et politiques explicites sur `rag_documents`.

### Dette restante
- Clarifier et stabiliser la chaîne de migrations.
- Vérifier l’existence et le comportement de `update_updated_at_column()` et des triggers `updated_at` sur toutes les tables.

---

## 8. Changements effectués

| Fichier / zone | Modification | Justification |
|----------------|-------------|---------------|
| `.gitignore` | Ajout de `.env`, `.env.*`, `!.env.example` | Éviter le commit de secrets (P0). |
| `src/hooks/useAccounts.ts` | Suppression des lignes 95–191 (bloc dupliqué). | Une seule définition des hooks, cohérence et `refetch` (P0). |
| `package.json` | Script `"typecheck": "tsc --noEmit"`. | Vérification des types sans build (P1). |
| `supabase/functions/analyze-account/index.ts` | Validation de `companyName` (trim, longueur max 200) et `userContext` (string, slice 2000). Gestion d’erreur : retour d’un message string uniquement. | Limiter DoS et fuite d’infos (P1). |
| `supabase/migrations/20260306150000_rag_documents_rls.sql` | Nouveau fichier : RLS sur `rag_documents` + politiques SELECT/INSERT/UPDATE/DELETE pour `authenticated`. | Accès explicite et maîtrisé (P1). |
| `src/lib/__tests__/export-csv.test.ts` | Nouveau fichier : tests pour `generateCSV` (BOM, en-têtes, escaping, vide). | Couvrir un flux critique (P2). |

---

## 9. Risques résiduels

- **Migrations** : tant que les deux migrations créant les mêmes tables coexistent, un `supabase db reset` ou un nouveau déploiement peut échouer ou donner un schéma inattendu. À trancher (garder une seule création des tables).
- **TypeScript** : sans `strictNullChecks` / `noImplicitAny`, des bugs de null/undefined et des types trop permissifs restent possibles.
- **Pas de CI** : tout correctif ou feature peut casser le build ou les tests sans alerte.
- **CORS** : en production, garder `*` augmente la surface d’attaque.
- **Couverture de tests** : les changements sur hooks et Edge Function restent peu protégés contre les régressions.

---

## 10. Roadmap technique recommandée

### Immédiat (avant ou au lancement prod)
1. Résoudre le conflit de migrations (choisir une seule création des tables, archiver l’autre).
2. Vérifier que `.env` n’a jamais été commité (historique Git) ; si oui, invalider les clés et les faire tourner.
3. Restreindre CORS de l’Edge Function aux origines autorisées.
4. Exécuter en local ou en CI : `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

### Court terme
5. Mettre en place une CI (ex. GitHub Actions) : lint, typecheck, test, build sur chaque PR.
6. Activer `strictNullChecks` (et idéalement `noImplicitAny`) par étapes, en corrigeant les erreurs.
7. Ajouter des tests sur les hooks (useAccounts, useCredits, useAnalysisPolling) avec mocks Supabase.
8. Compléter ou générer les types Supabase pour accounts, contacts, etc.

### Moyen terme
9. Découper les grosses pages (AccountDetail, Dashboard) et la grosse Edge Function.
10. Introduire un composant ou un pattern commun pour états chargement/erreur/vide.
11. Documenter dans le README : variables d’env, commandes, architecture.
12. Prévoir des tests E2E sur le parcours critique (login → recherche → fiche compte).

### Sécurité
- Audit des dépendances (npm audit, Dependabot).
- Revue des politiques RLS et des rôles Supabase.
- Optionnel : rate limiting côté front sur le bouton d’analyse.

---

*Rapport généré dans le cadre d’un audit CTO hands-on. Les corrections appliquées sont intégrées au dépôt ; les éléments “À traiter” relèvent des prochaines itérations.*
