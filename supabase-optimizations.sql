-- ========================================
-- OPTIMISATIONS "LIGHT" POUR GESTION DE COMPTES
-- Compatible avec la logique existante de l'app
-- ========================================

-- ==========================================
-- 1. VUE account_balances CORRIGÉE
-- Filtre par date <= NOW() comme votre app
-- ==========================================

-- Supprimer l'ancienne vue si elle existe
DROP VIEW IF EXISTS account_balances;

-- Vue : Solde actuel de tous les comptes (transactions passées/aujourd'hui uniquement)
CREATE OR REPLACE VIEW account_balances AS
SELECT 
  a.id,
  a.name,
  a.type,
  a.user_id,
  a.initial_balance,
  COALESCE(
    a.initial_balance + 
    SUM(CASE 
      WHEN t.type = 'income' THEN t.amount 
      WHEN t.type = 'expense' THEN -t.amount 
      ELSE 0
    END), 
    a.initial_balance
  ) as current_balance,
  COUNT(t.id) as transaction_count,
  MAX(t.date) as last_transaction_date
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id 
  AND t.archived = false
  AND t.date <= NOW()  -- ✅ Filtre ajouté : uniquement transactions passées/aujourd'hui
GROUP BY a.id, a.name, a.type, a.user_id, a.initial_balance;

COMMENT ON VIEW account_balances IS 'Solde actuel de chaque compte (transactions passées/aujourd''hui uniquement)';

-- ==========================================
-- 2. VUE pour solde incluant TOUTES les transactions
-- (utile pour projections futures)
-- ==========================================

CREATE OR REPLACE VIEW account_balances_projected AS
SELECT 
  a.id,
  a.name,
  a.type,
  a.user_id,
  a.initial_balance,
  COALESCE(
    a.initial_balance + 
    SUM(CASE 
      WHEN t.type = 'income' THEN t.amount 
      WHEN t.type = 'expense' THEN -t.amount 
      ELSE 0
    END), 
    a.initial_balance
  ) as projected_balance,
  COUNT(t.id) as transaction_count,
  MAX(t.date) as last_transaction_date
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id AND t.archived = false
GROUP BY a.id, a.name, a.type, a.user_id, a.initial_balance;

COMMENT ON VIEW account_balances_projected IS 'Solde projeté incluant les transactions futures';

-- ==========================================
-- 3. FONCTION get_account_balance_at_date CORRIGÉE
-- Prend en compte le filtre archived = false
-- ==========================================

DROP FUNCTION IF EXISTS get_account_balance_at_date(uuid, timestamp with time zone);

CREATE OR REPLACE FUNCTION get_account_balance_at_date(
  p_account_id uuid,
  p_date timestamp with time zone DEFAULT now()
)
RETURNS numeric AS $$
DECLARE
  v_balance numeric;
BEGIN
  SELECT 
    a.initial_balance + 
    COALESCE(
      SUM(CASE 
        WHEN t.type = 'income' THEN t.amount 
        WHEN t.type = 'expense' THEN -t.amount 
        ELSE 0
      END),
      0
    )
  INTO v_balance
  FROM accounts a
  LEFT JOIN transactions t ON t.account_id = a.id 
    AND t.date <= p_date 
    AND t.archived = false
  WHERE a.id = p_account_id
  GROUP BY a.id, a.initial_balance;
  
  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_account_balance_at_date IS 'Calcule le solde d''un compte à une date spécifique (transactions non archivées uniquement)';

-- ==========================================
-- 4. FONCTION get_user_balances_summary
-- Récupère tous les soldes d'un utilisateur en une requête
-- ==========================================

CREATE OR REPLACE FUNCTION get_user_balances_summary(p_user_id text)
RETURNS TABLE (
  account_id uuid,
  account_name text,
  account_type text,
  initial_balance numeric,
  current_balance numeric,
  transaction_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.type,
    a.initial_balance,
    COALESCE(
      a.initial_balance + 
      SUM(CASE 
        WHEN t.type = 'income' THEN t.amount 
        WHEN t.type = 'expense' THEN -t.amount 
        ELSE 0
      END), 
      a.initial_balance
    ) as current_balance,
    COUNT(t.id)::bigint as transaction_count
  FROM accounts a
  LEFT JOIN transactions t ON t.account_id = a.id 
    AND t.archived = false
    AND t.date <= NOW()
  WHERE a.user_id = p_user_id
  GROUP BY a.id, a.name, a.type, a.initial_balance
  ORDER BY a.name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_user_balances_summary IS 'Récupère tous les soldes actuels d''un utilisateur en une seule requête';

-- ==========================================
-- 5. VUE monthly_summary CORRIGÉE
-- Ajout du filtre par date pour cohérence
-- ==========================================

DROP VIEW IF EXISTS monthly_summary;

CREATE OR REPLACE VIEW monthly_summary AS
SELECT 
  a.user_id,
  DATE_TRUNC('month', t.date) as month,
  SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as total_income,
  SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as total_expenses,
  SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END) as net_amount,
  COUNT(DISTINCT t.id) as transaction_count,
  COUNT(DISTINCT t.category_id) as categories_used
FROM transactions t
JOIN accounts a ON t.account_id = a.id
WHERE t.archived = false
  AND t.date <= NOW()  -- ✅ Ne compte que les transactions passées
GROUP BY a.user_id, DATE_TRUNC('month', t.date);

COMMENT ON VIEW monthly_summary IS 'Résumé mensuel des revenus/dépenses par utilisateur (transactions passées uniquement)';

-- ==========================================
-- 6. INDEX ADDITIONNELS POUR LES NOUVELLES VUES
-- ==========================================

-- Index composite pour les requêtes de solde par date
CREATE INDEX IF NOT EXISTS idx_transactions_account_archived_date 
ON public.transactions(account_id, archived, date DESC)
WHERE archived = false;

-- Index pour les recherches par user_id avec date
CREATE INDEX IF NOT EXISTS idx_transactions_user_date 
ON public.transactions(date DESC)
WHERE archived = false;

-- ==========================================
-- 7. EXEMPLES D'UTILISATION
-- ==========================================

/*
-- Utilisation de la vue account_balances (remplace les boucles N+1)
-- AVANT :
const accountsWithBalance = await Promise.all(
  (ownAccounts || []).map(async (account) => {
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('account_id', account.id)
      .lte('date', now.toISOString())
    // ... calcul manuel
  })
)

-- APRÈS :
const { data: accountsWithBalance } = await supabase
  .from('account_balances')
  .select('*')
  .eq('user_id', userId)

-- Ou avec la fonction RPC pour plus de contrôle :
const { data: balances } = await supabase.rpc('get_user_balances_summary', {
  p_user_id: userId
})

-- Pour un solde historique :
const { data } = await supabase.rpc('get_account_balance_at_date', {
  p_account_id: accountId,
  p_date: '2024-01-01'
})
*/

-- ==========================================
-- FIN DES OPTIMISATIONS
-- ==========================================
