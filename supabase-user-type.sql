-- Migration pour ajouter le type d'utilisateur (visionneur ou utilisateur complet)
-- À exécuter dans Supabase SQL Editor

-- Ajouter la colonne user_type à la table user_settings
-- 'viewer' = visionneur (accès en lecture seule aux dashboards partagés)
-- 'user' = utilisateur complet (peut créer ses propres comptes/transactions)
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS user_type TEXT CHECK (user_type IN ('viewer', 'user')) DEFAULT NULL;

-- Ajouter un commentaire pour documentation
COMMENT ON COLUMN user_settings.user_type IS 'Type d''utilisateur: viewer (lecture seule) ou user (accès complet)';
