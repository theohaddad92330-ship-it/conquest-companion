-- Nettoyage des comptes SIEMENS / SIEMES et reset des crédits utilisateur
-- À exécuter manuellement si besoin (Dashboard > SQL Editor) ou via: supabase db push

DELETE FROM contacts WHERE account_id IN (SELECT id FROM accounts WHERE company_name IN ('SIEMENS','SIEMES'));
DELETE FROM attack_angles WHERE account_id IN (SELECT id FROM accounts WHERE company_name IN ('SIEMENS','SIEMES'));
DELETE FROM action_plans WHERE account_id IN (SELECT id FROM accounts WHERE company_name IN ('SIEMENS','SIEMES'));
DELETE FROM accounts WHERE company_name IN ('SIEMENS','SIEMES');
UPDATE user_credits SET accounts_used = 0, accounts_limit = 20 WHERE user_id IN (SELECT id FROM auth.users);
