-- Désactiver RLS sur user_settings
ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;

-- Politique permissive : accès total à user_settings
CREATE POLICY "Enable all access for user_settings" ON user_settings
FOR ALL
TO public
USING (true);
-- Migration pour ajouter la fonctionnalité de partage de dashboard

-- Table pour gérer les partages de dashboard complet (tous les comptes + transactions)
CREATE TABLE shared_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  shared_with_user_id TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(owner_user_id, shared_with_user_id)
);

-- Index pour améliorer les performances
CREATE INDEX idx_shared_dashboards_owner_user_id ON shared_dashboards(owner_user_id);
CREATE INDEX idx_shared_dashboards_shared_with_user_id ON shared_dashboards(shared_with_user_id);

CREATE TRIGGER update_shared_dashboards_updated_at
BEFORE UPDATE ON shared_dashboards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY,
  spend_targets jsonb,
  savings_rate numeric,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
