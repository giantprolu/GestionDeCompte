-- Table pour stocker les périodes de clôture de chaque mois
CREATE TABLE IF NOT EXISTS month_closures (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  month_year varchar(7) NOT NULL, -- format YYYY-MM
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp DEFAULT now()
);

-- Index pour accélérer les recherches par utilisateur et mois
CREATE INDEX IF NOT EXISTS idx_month_closures_user_month ON month_closures(user_id, month_year);
