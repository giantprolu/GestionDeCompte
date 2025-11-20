-- Migration COMPLÈTE pour mettre à jour la base de données
-- À exécuter dans Supabase SQL Editor

-- 1. AJOUTER user_id à la table accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 2. Supprimer l'ancienne contrainte UNIQUE sur name
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_name_key;

-- 3. Ajouter contrainte UNIQUE sur (user_id, name)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_user_id_name_key'
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_name_key UNIQUE(user_id, name);
  END IF;
END $$;

-- 4. Créer index sur user_id
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- 5. AJOUTER les colonnes de récurrence à transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT CHECK (recurrence_frequency IN ('daily', 'weekly', 'monthly', 'yearly'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_day INTEGER;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 6. Mettre à jour les comptes existants avec votre user_id Clerk
-- REMPLACEZ 'user_35kSYiRr0ybPhobPUbRQitNEeC4' par votre vrai user_id si différent
UPDATE accounts 
SET user_id = 'user_35kSYiRr0ybPhobPUbRQitNEeC4' 
WHERE user_id IS NULL;

-- Vérification
SELECT 'Migration terminée!' as status;
SELECT * FROM accounts;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions' AND column_name IN ('is_recurring', 'recurrence_frequency', 'recurrence_day', 'is_active');
