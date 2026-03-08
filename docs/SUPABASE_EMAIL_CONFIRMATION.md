# Lien de confirmation manquant dans l’email Supabase

Si les emails de création de compte n’affichent **aucun lien** pour confirmer, tu as deux options.

---

## Option 1 — Désactiver la confirmation email (recommandé en dev)

Comme ça, après inscription tu es connecté tout de suite et tu arrives sur le questionnaire sans cliquer sur un lien.

1. Ouvre **Supabase Dashboard** → ton projet  
2. **Authentication** → **Providers** → **Email**  
3. Désactive **« Confirm email »** (ou **« Enable email confirmations »**)  
4. Enregistre  

Ensuite : inscription → session créée directement → redirection vers `/onboarding` → questionnaire.

---

## Option 2 — Garder la confirmation et faire apparaître le lien

Si tu veux que les utilisateurs confirment leur email, le lien doit être dans le template.

1. **Supabase Dashboard** → **Authentication** → **Email Templates**  
2. Ouvre le template **« Confirm signup »**  
3. Dans le corps du mail, assure-toi d’avoir au moins :

   ```html
   <a href="{{ .ConfirmationURL }}">Confirmer mon adresse email</a>
   ```

   Ou en texte :

   ```
   Confirmer : {{ .ConfirmationURL }}
   ```

4. **URL Configuration** (Authentication → URL Configuration) :  
   - **Site URL** = l’origine de ton app (ex. `http://localhost:8084`)  
   - **Redirect URLs** = ajoute la même origine + `/onboarding` (ex. `http://localhost:8084/onboarding`)  

Après clic sur le lien, Supabase redirige vers `emailRedirectTo` ; on a configuré `/onboarding` dans le code, donc l’utilisateur arrive sur le questionnaire.

---

## Vérifications utiles

- **Spam / courrier indésirable** : vérifier que l’email Supabase n’est pas classé en spam.  
- **Template par défaut** : si tu as modifié le template, remets la variable `{{ .ConfirmationURL }}` si elle a été supprimée.  
- En **développement**, l’option 1 (désactiver la confirmation) évite d’être bloqué par l’email.
