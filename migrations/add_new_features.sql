-- Migration pour les nouvelles fonctionnalités

-- 1. Ajouter les colonnes pour les catégories personnalisées
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;

-- 2. Ajouter la colonne pour éviter les doublons de transactions récurrentes
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS last_processed_date DATE;

-- 3. Ajouter la colonne pour les jours de rappel personnalisés
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS upcoming_recurring_days INTEGER DEFAULT 3;

-- Créer un index sur les colonnes fréquemment utilisées
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_custom ON categories(is_custom);
CREATE INDEX IF NOT EXISTS idx_transactions_last_processed ON transactions(last_processed_date);

-- Note: Exécutez ce script dans votre console Supabase
