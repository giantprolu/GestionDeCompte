-- Migration pour ajouter le type de compte "livret"

-- 1. Modifier la contrainte CHECK sur le type de compte pour inclure 'livret'
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
  CHECK (type = ANY (ARRAY['ponctuel'::text, 'obligatoire'::text, 'livret'::text]));

-- 2. Créer un index sur le type de compte pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);

-- 3. Créer un index composite pour les requêtes filtrant par user_id et type
CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON accounts(user_id, type);

-- Note: Exécutez ce script dans votre console Supabase SQL Editor
