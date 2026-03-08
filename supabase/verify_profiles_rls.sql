-- À exécuter dans Supabase Dashboard > SQL Editor pour vérifier la config profiles.
-- Ces requêtes sont en lecture seule (SELECT).

-- 1) RLS activé sur profiles
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles';

-- 2) Policies existantes sur profiles (doivent utiliser user_id, pas id)
SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'profiles';

-- 3) Trigger qui crée le profil à l'inscription
SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- 4) Colonne onboarding_completed
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_completed';
