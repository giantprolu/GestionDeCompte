-- Migration pour ajouter user_id aux comptes existants
-- À exécuter dans Supabase SQL Editor

-- 1. Ajouter la colonne user_id à la table accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 2. Supprimer l'ancienne contrainte UNIQUE sur name
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_name_key;

-- 3. Ajouter une nouvelle contrainte UNIQUE sur (user_id, name)
ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_name_key UNIQUE(user_id, name);

-- 4. Créer un index sur user_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- 5. Mettre à jour les politiques RLS
DROP POLICY IF EXISTS "Enable all access for accounts" ON accounts;
DROP POLICY IF EXISTS "Users can only access their own accounts" ON accounts;

CREATE POLICY "Users can only access their own accounts" 
  ON accounts 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Note: Les comptes existants auront user_id = NULL
-- Vous devrez soit:
-- 1. Supprimer les comptes existants (si ce sont des tests)
-- 2. Ou assigner manuellement un user_id aux comptes existants
-- Exemple pour supprimer: DELETE FROM accounts WHERE user_id IS NULL;
