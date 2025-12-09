-- Migration pour ajouter l'exclusion des comptes du prévisionnel
-- Exécuter ce script dans Supabase SQL Editor

-- Ajouter la colonne exclude_from_previsionnel à la table accounts
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS exclude_from_previsionnel BOOLEAN DEFAULT FALSE;

-- Mettre à jour la vue account_balances pour inclure le nouveau champ
DROP VIEW IF EXISTS account_balances;

CREATE OR REPLACE VIEW account_balances AS
SELECT 
    a.id,
    a.user_id,
    a.name,
    a.type,
    a.initial_balance,
    a.exclude_from_previsionnel,
    a.created_at,
    a.updated_at,
    COALESCE(
        a.initial_balance + 
        SUM(
            CASE 
                WHEN t.type = 'income' THEN t.amount
                WHEN t.type = 'expense' THEN -t.amount
                ELSE 0
            END
        ) FILTER (WHERE t.archived IS NOT TRUE),
        a.initial_balance
    ) AS current_balance
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id
GROUP BY a.id, a.user_id, a.name, a.type, a.initial_balance, a.exclude_from_previsionnel, a.created_at, a.updated_at;

-- Commentaire pour documentation
COMMENT ON COLUMN accounts.exclude_from_previsionnel IS 'Si TRUE, ce compte est exclu des calculs du prévisionnel (ex: carte ticket resto)';
