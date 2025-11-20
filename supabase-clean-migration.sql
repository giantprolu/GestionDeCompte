-- Script complet pour nettoyer et recréer les tables avec user_id
-- À exécuter dans Supabase SQL Editor

-- 1. SUPPRIMER LES ANCIENNES DONNÉES (si ce sont des tests)
DELETE FROM transactions;
DELETE FROM accounts;

-- 2. Ajouter la colonne user_id à la table accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 3. Supprimer l'ancienne contrainte UNIQUE sur name
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_name_key;

-- 4. Ajouter une nouvelle contrainte UNIQUE sur (user_id, name)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_user_id_name_key'
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_user_id_name_key UNIQUE(user_id, name);
  END IF;
END $$;

-- 5. Créer un index sur user_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- 6. Mettre à jour les politiques RLS
DROP POLICY IF EXISTS "Enable all access for accounts" ON accounts;
DROP POLICY IF EXISTS "Users can only access their own accounts" ON accounts;

CREATE POLICY "Users can only access their own accounts" 
  ON accounts 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Vérification
SELECT 'Migration terminée!' as status;
SELECT COUNT(*) as nombre_comptes FROM accounts;
