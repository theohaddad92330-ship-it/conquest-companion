# Audit diagnostic — analyze-account

## Parcours complet processAnalysis (analysis_start → analysis_complete)

1. **analysis_start** (log)
2. **ÉTAPE 1** — `searchBrave()` → brave_done, brave_detail
3. **ÉTAPE 2** — `scrapePages()` → firecrawl_done, firecrawl_detail
4. **RAG** — `searchRAG(supabase, companyName)` (await OK)
5. **ÉTAPE 3** — `analyzeWithClaude()` → claude_analysis_done, claude_detail (0 contacts attendu)
6. **ÉTAPE 4** — update accounts (sector, raw_analysis, status: 'analyzing'), insert attack_angles, action_plans
7. **ÉTAPE 5** — Contacts :
   - `if (APIFY_API_TOKEN)` → scrapeLinkedInCompany, scrapeLinkedInPeople
   - **apify_detail** (log avec linkedinContactsCount)
   - `if (linkedinContacts.length > 0)` → enrichLinkedInContactsWithClaude, log contacts_source apify_enriched
   - **else** → log apify_failed_using_claude_fallback, try { generateContactsWithClaude }, log contacts_source claude_fallback_after_apify
   - `else` (pas de clé Apify) → log no_apify_using_claude, generateContactsWithClaude, log contacts_source claude_no_apify
8. **Filet** — `if (finalContacts.length === 0)` → log last_resort_fallback, generateContactsWithClaude, log contacts_source last_resort
9. **ÉTAPE 7** — si finalContacts.length > 0 → insert contacts
10. **Update status** — `supabase.from('accounts').update({ status: 'completed', ... }).eq('id', accountId)` (retour non vérifié)
11. **analysis_complete** (log)

## Pourquoi les contacts ne sont pas générés

- Les logs (apify_detail puis analysis_complete sans rien entre) indiquent que **soit le code déployé est une ancienne version** (sans logs de fallback ni appel à `generateContactsWithClaude` dans le else), **soit** une exception est levée et on ne la voit pas (peu probable car on verrait analysis_error).
- Hypothèse la plus probable : **déploiement obsolète**. Ancien code du type : `else { finalContacts = analysis.contacts || [] }` sans appel à `generateContactsWithClaude`, donc finalContacts = [], puis pas d’insert, puis update status et analysis_complete. D’où la séquence de logs observée.

## Pourquoi le statut ne passe jamais à "completed"

- Si `analysis_complete` apparaît, le code a bien exécuté l’update. Donc soit :
  - l’**update échoue** (RLS, contrainte, etc.) et on ne lit pas `{ error }` sur le retour Supabase,
  - soit le **front** ne rafraîchit pas le statut,
  - soit les logs et le compte regardés ne correspondent pas au même run (crash avant l’update sur le run qui reste en "analyzing").
- **Correction** : vérifier le retour de l’update et logger en cas d’erreur.

## Incohérences identifiées

1. **linkedinContacts** : si `scrapeLinkedInPeople` renvoie autre chose qu’un tableau (ou undefined), `linkedinContacts.length` peut throw. À sécuriser (toujours traiter comme un tableau).
2. **Update status** : le résultat de l’update n’est pas vérifié ; en cas d’échec le compte reste "analyzing" sans trace.
3. **Traçabilité** : pas de log explicite dans la branche else juste après apify_detail, ce qui rend le flux difficile à lire dans les logs.
4. **generateContactsWithClaude** : `JSON.parse(clean)` peut lever ; c’est déjà dans un try/catch qui retourne []. OK.

## Fonctions appelées / définies

- **generateContactsWithClaude** : définie (l.776), appelée dans processAnalysis (else Apify, else no Apify, last_resort). OK.
- **enrichLinkedInContactsWithClaude** : définie, appelée si linkedinContacts.length > 0. OK.
- **scrapeLinkedInPeople** : retourne toujours un tableau (ou [] en catch). OK.
- Aucune promesse oubliée (await partout où il faut).

## Corrections appliquées

1. Rendre **linkedinContacts** défensif : s’assurer que c’est un tableau avant d’utiliser `.length`.
2. **Log** explicite dans la branche else juste après apify_detail (step5_apify_fallback).
3. **Vérifier** le retour de l’update `status: 'completed'` et logger en cas d’erreur.
4. Log **step7_before_completed** avant l’update pour confirmer qu’on atteint bien cette ligne.
