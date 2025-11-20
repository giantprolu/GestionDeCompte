-- Script SQL pour créer les tables dans Supabase

-- Table des catégories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  icon TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des comptes
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ponctuel', 'obligatoire')),
  initial_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Table des transactions (entrées et sorties)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  note TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_frequency TEXT CHECK (recurrence_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_day INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Activer RLS (Row Level Security)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS - Les catégories sont publiques, mais les comptes et transactions sont isolés par utilisateur
CREATE POLICY "Enable all access for categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can only access their own accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Users can only access their own transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);

-- Insertion des catégories de dépenses par défaut
INSERT INTO categories (name, type, icon, color) VALUES
  -- Dépenses
  ('Alimentation', 'expense', '🛒', '#ef4444'),
  ('Transport', 'expense', '🚗', '#f59e0b'),
  ('Logement', 'expense', '🏠', '#8b5cf6'),
  ('Santé', 'expense', '💊', '#ec4899'),
  ('Loisirs', 'expense', '🎮', '#06b6d4'),
  ('Vêtements', 'expense', '👕', '#10b981'),
  ('Éducation', 'expense', '📚', '#6366f1'),
  ('Factures', 'expense', '📄', '#f97316'),
  ('Restaurants', 'expense', '🍽️', '#84cc16'),
  ('Abonnements', 'expense', '📱', '#a855f7'),
  ('Cadeaux', 'expense', '🎁', '#f472b6'),
  ('Assurances', 'expense', '🛡️', '#64748b'),
  ('Impôts', 'expense', '🏛️', '#dc2626'),
  ('Épargne', 'expense', '💰', '#059669'),
  ('Autres dépenses', 'expense', '📦', '#78716c'),
  
  -- Revenus
  ('Salaire', 'income', '💼', '#22c55e'),
  ('Prime', 'income', '🎉', '#3b82f6'),
  ('Freelance', 'income', '💻', '#8b5cf6'),
  ('Investissements', 'income', '📈', '#06b6d4'),
  ('Remboursement', 'income', '💳', '#14b8a6'),
  ('Vente', 'income', '🏷️', '#f59e0b'),
  ('Cadeau reçu', 'income', '🎁', '#ec4899'),
  ('Allocation', 'income', '👨‍👩‍👧', '#a855f7'),
  ('Autres revenus', 'income', '💵', '#10b981')
ON CONFLICT (name) DO NOTHING;
