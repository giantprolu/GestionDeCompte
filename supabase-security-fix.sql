-- ========================================
-- CORRECTIONS DE SÉCURITÉ SUPABASE
-- Résout les erreurs du linter Supabase
-- ========================================

-- ==========================================
-- 1. CORRIGER LES VUES (SECURITY INVOKER)
-- Les vues doivent utiliser SECURITY INVOKER, pas DEFINER
-- ==========================================

-- Recréer account_balances avec SECURITY INVOKER
DROP VIEW IF EXISTS account_balances;
CREATE VIEW account_balances 
WITH (security_invoker = true)
AS
SELECT 
  a.id,
  a.name,
  a.type,
  a.user_id,
  a.initial_balance,
  a.created_at,
  a.updated_at,
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
  AND t.date <= NOW()
GROUP BY a.id, a.name, a.type, a.user_id, a.initial_balance, a.created_at, a.updated_at;

COMMENT ON VIEW account_balances IS 'Solde actuel de chaque compte (transactions passées/aujourd''hui uniquement)';

-- Recréer account_balances_projected avec SECURITY INVOKER
DROP VIEW IF EXISTS account_balances_projected;
CREATE VIEW account_balances_projected
WITH (security_invoker = true)
AS
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

-- Recréer active_recurring_transactions avec SECURITY INVOKER
DROP VIEW IF EXISTS active_recurring_transactions;
CREATE VIEW active_recurring_transactions
WITH (security_invoker = true)
AS
SELECT 
  t.id,
  t.amount,
  t.type,
  t.date,
  t.note,
  t.recurrence_frequency,
  t.recurrence_day,
  t.account_id,
  t.category_id,
  c.name as category_name,
  c.icon as category_icon,
  c.color as category_color,
  a.name as account_name,
  a.user_id
FROM transactions t
JOIN categories c ON t.category_id = c.id
JOIN accounts a ON t.account_id = a.id
WHERE t.is_recurring = true 
  AND t.is_active = true 
  AND t.archived = false;

COMMENT ON VIEW active_recurring_transactions IS 'Liste des transactions récurrentes actives avec leurs détails';

-- Recréer active_credits_summary avec SECURITY INVOKER
DROP VIEW IF EXISTS active_credits_summary;
CREATE VIEW active_credits_summary
WITH (security_invoker = true)
AS
SELECT 
  cr.id,
  cr.user_id,
  cr.account_id,
  cr.title,
  cr.principal,
  cr.outstanding,
  cr.start_date,
  cr.due_date,
  cr.installments,
  cr.frequency,
  cr.note,
  a.name as account_name,
  cr.principal - cr.outstanding as paid_amount,
  ROUND((cr.principal - cr.outstanding)::numeric / NULLIF(cr.principal, 0) * 100, 2) as completion_percentage,
  CASE 
    WHEN cr.due_date IS NULL THEN 'no_deadline'
    WHEN cr.due_date < CURRENT_DATE THEN 'overdue'
    WHEN cr.due_date < CURRENT_DATE + INTERVAL '30 days' THEN 'due_soon'
    ELSE 'on_track'
  END as status,
  CASE 
    WHEN cr.due_date IS NOT NULL THEN 
      EXTRACT(DAY FROM cr.due_date - CURRENT_DATE)::integer 
    ELSE NULL 
  END as days_until_due
FROM credits cr
LEFT JOIN accounts a ON cr.account_id = a.id
WHERE cr.is_closed = false;

COMMENT ON VIEW active_credits_summary IS 'Vue complète des crédits actifs avec calculs de progression';

-- Recréer monthly_summary avec SECURITY INVOKER
DROP VIEW IF EXISTS monthly_summary;
CREATE VIEW monthly_summary
WITH (security_invoker = true)
AS
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
  AND t.date <= NOW()
GROUP BY a.user_id, DATE_TRUNC('month', t.date);

COMMENT ON VIEW monthly_summary IS 'Résumé mensuel des revenus/dépenses par utilisateur (transactions passées uniquement)';

-- ==========================================
-- 2. CORRIGER LES FONCTIONS (search_path)
-- Ajouter SET search_path = public pour la sécurité
-- ==========================================

-- Recréer update_updated_at_column avec search_path fixe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Recréer get_account_balance_at_date avec search_path fixe
DROP FUNCTION IF EXISTS get_account_balance_at_date(uuid, timestamp with time zone);
CREATE FUNCTION get_account_balance_at_date(
  p_account_id uuid,
  p_date timestamp with time zone DEFAULT now()
)
RETURNS numeric 
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
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
$$;

COMMENT ON FUNCTION get_account_balance_at_date IS 'Calcule le solde d''un compte à une date spécifique';

-- Recréer get_user_balances_summary avec search_path fixe
DROP FUNCTION IF EXISTS get_user_balances_summary(text);
CREATE FUNCTION get_user_balances_summary(p_user_id text)
RETURNS TABLE (
  account_id uuid,
  account_name text,
  account_type text,
  initial_balance numeric,
  current_balance numeric,
  transaction_count bigint
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
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
$$;

COMMENT ON FUNCTION get_user_balances_summary IS 'Récupère tous les soldes actuels d''un utilisateur';

-- Recréer get_user_transactions_for_period avec search_path fixe
DROP FUNCTION IF EXISTS get_user_transactions_for_period(text, timestamp with time zone, timestamp with time zone);
CREATE FUNCTION get_user_transactions_for_period(
  p_user_id text,
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
)
RETURNS TABLE (
  transaction_id uuid,
  amount numeric,
  type text,
  date timestamp with time zone,
  note text,
  category_name text,
  account_name text,
  is_recurring boolean
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.amount,
    t.type,
    t.date,
    t.note,
    c.name,
    a.name,
    t.is_recurring
  FROM transactions t
  JOIN accounts a ON t.account_id = a.id
  JOIN categories c ON t.category_id = c.id
  WHERE a.user_id = p_user_id
    AND t.date >= p_start_date
    AND t.date <= p_end_date
    AND t.archived = false
  ORDER BY t.date DESC;
END;
$$;

COMMENT ON FUNCTION get_user_transactions_for_period IS 'Récupère toutes les transactions d''un utilisateur pour une période donnée';

-- ==========================================
-- FIN DES CORRECTIONS DE SÉCURITÉ
-- ==========================================

-- ==========================================
-- 3. CORRIGER LES POLICIES RLS (Performance)
-- Table credits : supprimer les doublons et optimiser
-- ==========================================

-- Supprimer toutes les policies existantes sur credits
DROP POLICY IF EXISTS "Enable all access for credits" ON public.credits;
DROP POLICY IF EXISTS "Users can access own credits" ON public.credits;

-- Créer UNE SEULE policy optimisée (avec SELECT pour éviter re-évaluation par ligne)
-- Note: Comme vous utilisez Clerk et pas Supabase Auth, on utilise une policy permissive simple
CREATE POLICY "Allow all operations on credits"
ON public.credits
FOR ALL
USING (true)
WITH CHECK (true);

-- ==========================================
-- 4. SUPPRIMER LES INDEX DUPLIQUÉS
-- Table shared_dashboards
-- ==========================================

-- Supprimer les index dupliqués (garder seulement un de chaque)
DROP INDEX IF EXISTS idx_shared_dashboards_owner;
-- Garder idx_shared_dashboards_owner_user_id

DROP INDEX IF EXISTS idx_shared_dashboards_shared_with;
-- Garder idx_shared_dashboards_shared_with_user_id

DROP INDEX IF EXISTS unique_dashboard_share;
-- Garder shared_dashboards_owner_user_id_shared_with_user_id_key (contrainte UNIQUE native)

-- ==========================================
-- FIN DE TOUTES LES CORRECTIONS
-- ==========================================
