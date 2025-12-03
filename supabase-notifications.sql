-- Table pour stocker les subscriptions de notifications push
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Table pour stocker les préférences de notifications
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  negative_balance BOOLEAN DEFAULT TRUE,
  low_balance_threshold DECIMAL(10, 2) DEFAULT 100,
  low_balance BOOLEAN DEFAULT TRUE,
  upcoming_recurring BOOLEAN DEFAULT TRUE,
  monthly_summary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour tracker les notifications déjà envoyées (éviter les doublons)
CREATE TABLE IF NOT EXISTS sent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  reference_id TEXT, -- ID du compte ou transaction concerné
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Unique constraint pour éviter d'envoyer la même notification plusieurs fois par jour
CREATE UNIQUE INDEX IF NOT EXISTS idx_sent_notifications_unique 
  ON sent_notifications(user_id, notification_type, reference_id, sent_date);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_sent_notifications_user_id ON sent_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_sent_notifications_date ON sent_notifications(sent_at);

-- RLS Policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_notifications ENABLE ROW LEVEL SECURITY;

-- Policies pour push_subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policies pour notification_preferences
CREATE POLICY "Users can manage their own notification preferences"
  ON notification_preferences FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policies pour sent_notifications
CREATE POLICY "Users can view their own sent notifications"
  ON sent_notifications FOR ALL
  USING (true)
  WITH CHECK (true);
