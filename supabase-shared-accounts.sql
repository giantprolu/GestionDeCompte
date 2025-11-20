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

-- Trigger pour mettre à jour automatiquement updated_at
CREATE TRIGGER update_shared_dashboards_updated_at
BEFORE UPDATE ON shared_dashboards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Note: Les politiques RLS sont désactivées car nous utilisons Clerk pour l'authentification
-- et non pas Supabase Auth. L'authentification est gérée côté API avec Clerk.
-- ALTER TABLE shared_dashboards ENABLE ROW LEVEL SECURITY;
