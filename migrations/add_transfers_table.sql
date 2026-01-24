-- Migration pour ajouter la fonctionnalité de virements entre comptes

-- 1. Créer la table des virements
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  from_account_id uuid NOT NULL,
  to_account_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  date timestamp with time zone NOT NULL DEFAULT now(),
  note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transfers_pkey PRIMARY KEY (id),
  CONSTRAINT transfers_from_account_fkey FOREIGN KEY (from_account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT transfers_to_account_fkey FOREIGN KEY (to_account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT transfers_different_accounts CHECK (from_account_id <> to_account_id)
);

-- 2. Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_account ON transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_account ON transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date DESC);

-- 3. Ajouter un commentaire pour documenter la table
COMMENT ON TABLE transfers IS 'Table pour gérer les virements entre comptes (livrets, comptes courants, etc.)';

-- Note: Exécutez ce script dans votre console Supabase SQL Editor
