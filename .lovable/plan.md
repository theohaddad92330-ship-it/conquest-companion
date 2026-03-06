

# Bellum AI — Sprint 1 : Fondation du SaaS

## Vue d'ensemble
Bellum AI est un SaaS de prospection commerciale pour les ESN. Sprint 1 pose les fondations : design system dark mode pro, page de recherche, et fiche compte enrichie par IA.

## 1. Design System & Layout
- **Dark mode par défaut** avec accent bleu électrique
- **Sidebar** style Notion/Linear avec navigation : Recherche, Mes Comptes
- **Typographie pro** distinctive (pas Inter/Roboto)
- Composants Shadcn/UI personnalisés aux couleurs Bellum

## 2. Page de recherche (écran principal)
- Barre de recherche dominante et centrale : *"Entrez un nom d'entreprise (ex : Société Générale)"*
- Design épuré, un seul CTA — zéro distraction
- Compteur de crédits visible (placeholder pour Sprint ultérieur)

## 3. Backend — Edge Function d'orchestration
- **Supabase Edge Function** qui orchestre l'analyse d'un compte
- Appels API externes préparés mais **mockés** (Brave, Firecrawl, Pappers) — données simulées réalistes, facilement remplaçables quand les clés seront disponibles
- Envoi des données collectées à **Claude Sonnet** (API Anthropic) pour analyse
- Retour d'une fiche compte structurée en JSON

## 4. Affichage progressif — Fiche compte
- **Skeletons animés** pendant le chargement
- Bloc fiche compte : nom, secteur, effectifs, CA, siège, filiales, enjeux IT, signaux récents, score de priorité (badge 1-10)
- Résultats qui apparaissent progressivement (pas d'attente globale)

## 5. Stockage & Dashboard "Mes Comptes"
- Tables Supabase : `accounts` (résultats d'analyse, historique)
- Dashboard tableau listant les comptes analysés (nom, date, score, statut)
- Préparé pour le multi-tenant SaaS (isolation des données par utilisateur dès le départ)

## 6. Ce qui n'est PAS dans ce sprint
- Auth, inscription, onboarding (Sprint 3)
- Contacts LinkedIn, organigramme (Sprint 2)
- Messages, export CSV (Sprint 2-3)
- Crédits, Stripe, abonnements (P1)

