-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['ponctuel'::text, 'obligatoire'::text, 'livret'::text])),
  initial_balance numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id text,
  exclude_from_previsionnel boolean DEFAULT false,
  CONSTRAINT accounts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  icon text,
  color text,
  created_at timestamp with time zone DEFAULT now(),
  user_id character varying,
  is_custom boolean DEFAULT false,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.credits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  account_id uuid,
  title text NOT NULL,
  principal numeric NOT NULL CHECK (principal >= 0::numeric),
  outstanding numeric NOT NULL CHECK (outstanding >= 0::numeric),
  start_date timestamp with time zone DEFAULT now(),
  due_date timestamp with time zone,
  installments integer,
  frequency text DEFAULT 'oneoff'::text CHECK (frequency = ANY (ARRAY['oneoff'::text, 'monthly'::text, 'weekly'::text, 'custom'::text])),
  note text,
  is_closed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT credits_pkey PRIMARY KEY (id),
  CONSTRAINT credits_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id)
);
CREATE TABLE public.month_closures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  month_year text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT month_closures_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  negative_balance boolean DEFAULT true,
  low_balance_threshold numeric DEFAULT 100,
  low_balance boolean DEFAULT true,
  upcoming_recurring boolean DEFAULT true,
  monthly_summary boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  upcoming_recurring_days integer DEFAULT 3,
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id)
);
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sent_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  notification_type text NOT NULL,
  reference_id text,
  sent_at timestamp with time zone DEFAULT now(),
  sent_date date NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT sent_notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE public.shared_dashboards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_user_id text NOT NULL,
  shared_with_user_id text NOT NULL,
  permission text NOT NULL CHECK (permission = ANY (ARRAY['view'::text, 'edit'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shared_dashboards_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  category_id uuid NOT NULL,
  account_id uuid NOT NULL,
  date timestamp with time zone NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_recurring boolean DEFAULT false,
  recurrence_frequency text CHECK (recurrence_frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text])),
  recurrence_day integer,
  is_active boolean DEFAULT true,
  credit_id uuid,
  archived boolean DEFAULT false,
  last_processed_date date,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT transactions_credit_id_fkey FOREIGN KEY (credit_id) REFERENCES public.credits(id)
);
CREATE TABLE public.transfers (
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
  CONSTRAINT transfers_from_account_fkey FOREIGN KEY (from_account_id) REFERENCES public.accounts(id),
  CONSTRAINT transfers_to_account_fkey FOREIGN KEY (to_account_id) REFERENCES public.accounts(id)
);
CREATE TABLE public.tutorial_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  completed boolean DEFAULT false,
  skipped boolean DEFAULT false,
  current_step integer DEFAULT 0,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tutorial_progress_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_settings (
  user_id text NOT NULL,
  spend_targets jsonb,
  savings_rate numeric,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  user_type text CHECK (user_type = ANY (ARRAY['viewer'::text, 'user'::text])),
  CONSTRAINT user_settings_pkey PRIMARY KEY (user_id)
);