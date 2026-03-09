# Diagnostic complet — pipeline de génération de contacts

## 1. Parcours d’une requête dans `processAnalysis`

| # | Étape | Log(s) | Condition / remarque |
|---|--------|--------|------------------------|
| 1 | Début | `analysis_start` | — |
| 2 | Brave | `brave_done`, `brave_detail` | `searchBrave()` toujours appelé |
| 3 | Firecrawl | `firecrawl_done`, `firecrawl_detail` | `scrapePages()` toujours appelé |
| 4 | RAG | (aucun) | `searchRAG()` await, pas de log |
| 5 | Claude analyse | `claude_analysis_done`, `claude_detail` | `analyzeWithClaude()` → 0 contacts attendu |
| 6 | Persistance | (aucun) | Update account, insert angles, insert action_plans |
| 7 | **Contacts** | **Voir ci‑dessous** | Branchement sur `APIFY_API_TOKEN` et `linkedinContacts.length` |
| 8 | Filet | `last_resort_fallback`, `contacts_source` (last_resort) | Si `finalContacts.length === 0` |
| 9 | Insert contacts | (aucun) | Si `finalContacts.length > 0` |
| 10 | Statut | `step7_before_completed`, `step7_completed_ok` ou `step7_completed_failed` | Update `status: 'completed'` |
| 11 | Fin | `analysis_complete` | Toujours si on n’a pas throw |

Détail de l’étape 7 (contacts) :

- **Si `APIFY_API_TOKEN` est truthy**
  - `scrapeLinkedInCompany()` puis `scrapeLinkedInPeople(300)`.
  - Log **`apify_detail`** (avec `linkedinContactsCount: linkedinContacts.length`).
  - **Si `linkedinContacts.length > 0`**  
    → `enrichLinkedInContactsWithClaude()` → log `contacts_source` (apify_enriched).
  - **Sinon (Apify retourne 0)**  
    → log `step5_apify_fallback`, `apify_failed_using_claude_fallback`  
    → `try { finalContacts = await generateContactsWithClaude(...) } catch { ... }`  
    → log `contacts_source` (claude_fallback_after_apify).
- **Sinon (pas de clé Apify)**  
  → log `no_apify_using_claude`  
  → `try { finalContacts = await generateContactsWithClaude(...) } catch { ... }`  
  → log `contacts_source` (claude_no_apify).

Ensuite, filet (étape 8) si `finalContacts.length === 0` : `last_resort_fallback` puis nouvel appel `generateContactsWithClaude` et log `contacts_source` (last_resort).

---

## 2. Pourquoi les contacts ne sont pas générés (côté code actuel)

Dans le **code actuel du fichier** :

- Dès qu’Apify retourne 0 contacts, on entre dans le `else` (l.245–256) : on log `step5_apify_fallback` et `apify_failed_using_claude_fallback`, puis on appelle `generateContactsWithClaude` dans un `try/catch`. Donc **aucun chemin ne permet d’aller de `apify_detail` à `analysis_complete` sans au moins ces logs et cet appel**.
- Si l’appel à `generateContactsWithClaude` échoue (throw), le `catch` met `finalContacts = []` et on log `generate_contacts_crash`. Ensuite on log quand même `contacts_source` (claude_fallback_after_apify). Puis le filet (last_resort) s’exécute si `finalContacts.length === 0` et rappelle `generateContactsWithClaude`.
- Donc avec le code **actuel** :
  - Soit les logs intermédiaires ne sont pas présents parce que **la version déployée est une ancienne version** (sans ces logs ni ce fallback).
  - Soit la fonction **timeout** ou est **tuée** par la plateforme (ex. limite d’exécution Edge) **avant** que les logs après `generateContactsWithClaude` ne soient émis ; dans ce cas on ne devrait pas voir `analysis_complete` non plus, sauf si un autre run affiche ce log.

Conclusion : avec le code **tel qu’il est dans le repo**, les contacts devraient être tentés (Apify 0 → fallback Claude → filet last_resort) et au moins les logs `step5_apify_fallback`, `apify_failed_using_claude_fallback`, puis `contacts_source`, puis éventuellement `last_resort_fallback` et `generate_contacts_start` devraient apparaître. **L’écart avec ce que tu vois (apify_detail puis directement analysis_complete, 0 contacts) pointe vers une version déployée différente ou un timeout/kill avant la fin du bloc contacts.**

---

## 3. Pourquoi le statut ne passe jamais à « completed »

Dans le code actuel :

- La mise à jour `status: 'completed'` (l.301–305) est exécutée **après** le bloc contacts et **avant** le log `analysis_complete`.
- Si tu vois **`analysis_complete`** dans les logs, ce bloc a donc été exécuté ; en principe le statut est passé à `completed` (sauf si l’update Supabase échoue).
- Si le compte reste en « analyzing » alors que les logs montrent `analysis_complete`, possibilités :
  - **Update en échec** (ex. RLS, contrainte, réseau) : le code actuel logue `step7_completed_failed` si `updateStatusError` est renseigné. Si tu ne vois pas ce log, soit l’ancienne version déployée ne le faisait pas, soit l’update réussit et le problème est ailleurs (cache, autre run, etc.).
  - **Run différent** : le log `analysis_complete` vient d’un autre run que le compte que tu regardes (ex. run qui a fini vs run qui a timeout avant la mise à jour).

Donc : **dans le code actuel**, le statut est bien mis à `completed` et les échecs d’update sont logués. Un déploiement à jour + une nouvelle analyse permettront de vérifier (notamment présence de `step7_before_completed` et `step7_completed_ok` ou `step7_completed_failed`).

---

## 4. Incohérences relevées (et corrections proposées)

1. **Filet last_resort — catch sans réaffectation**  
   En cas de throw dans le filet (`finalContacts = await generateContactsWithClaude(...)`), le `catch` logue mais ne fait pas `finalContacts = []`. Si `generateContactsWithClaude` avait déjà été partiellement évalué ou en cas de réutilisation de variable, mieux vaut **assigner explicitement `finalContacts = []` dans ce catch** pour garantir un état cohérent avant `step7_before_completed` et l’update.

2. **Traçabilité du chemin « Apify a retourné 0 »**  
   Pour être sûr que le bon chemin est pris côté déploiement, on peut ajouter un log **synchrone** juste avant l’appel à `generateContactsWithClaude` dans le bloc « Apify a échoué » (ex. `about_to_call_generate_contacts`). Ainsi, si ce log n’apparaît pas alors qu’on a bien `apify_detail` avec 0 contacts, on saura qu’on n’entre pas dans ce bloc (donc ancienne version ou autre branche).

3. **Aucune autre incohérence structurelle**  
   - `generateContactsWithClaude` est bien définie (l.803) et appelée depuis `processAnalysis` (else Apify + else no Apify + filet).  
   - Pas de double déclaration de `finalContacts`, pas de `return` prématuré entre contacts et update, pas de promesse oubliée (les appels async sont bien await).  
   - Les try/catch autour de `generateContactsWithClaude` loguent (`generate_contacts_crash`) et remettent `finalContacts = []` (sauf dans le catch du filet, à corriger).

---

## 5. Vérification mentale du scénario (Brave 30, Firecrawl 43k, Claude 0 contacts, Apify 0)

- On a `APIFY_API_TOKEN` → on entre dans le bloc Apify.
- `linkedinContacts = []` → `linkedinContacts.length > 0` est faux → on entre dans le `else`.
- Logs `step5_apify_fallback`, `apify_failed_using_claude_fallback`, puis `await generateContactsWithClaude(...)`.  
  - Si Claude renvoie une liste : `finalContacts` est rempli, on log `contacts_source` (claude_fallback_after_apify).  
  - Si Claude throw ou renvoie [] : `finalContacts = []`, on log quand même `contacts_source` (count 0).
- Ensuite : `finalContacts.length === 0` → on entre dans le filet : `last_resort_fallback`, nouvel appel `generateContactsWithClaude`, puis log `contacts_source` (last_resort). Si ce second appel renvoie des contacts, on a bien des contacts.
- Puis `step7_before_completed`, update `status: 'completed'`, `step7_completed_ok` ou `step7_completed_failed`, puis `analysis_complete`.

Donc **avec le code corrigé (et déployé)** : même avec Brave 30, Firecrawl 43k, Claude 0 contacts et Apify 0, on tente au moins deux fois la génération de contacts (fallback après Apify + filet) et on passe bien par la mise à jour du statut à `completed`, avec des logs explicites à chaque étape.
