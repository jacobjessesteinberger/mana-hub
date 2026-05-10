-- Web Push subscriptions
--
-- Stores per-browser/per-device Web Push endpoints + keys so the server can
-- deliver OS-level notifications to the dashboard user when an approval or
-- a cron-request arrives while the dashboard tab is closed.
--
-- One user can have many subscriptions (laptop browser, phone browser, ...).
-- Endpoints are unique because the browser issues exactly one URL per
-- browser-device-VAPID-key triple.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT,                 -- recipient (admin email; matches ADMIN_EMAIL)
  endpoint TEXT NOT NULL UNIQUE,   -- browser-issued push endpoint URL
  p256dh TEXT NOT NULL,            -- subscription public key
  auth TEXT NOT NULL,              -- subscription auth secret
  user_agent TEXT,                 -- best-effort UA string for housekeeping
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  last_error TEXT,                 -- last delivery error (e.g. 410 Gone)
  failure_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_email
  ON push_subscriptions(user_email);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_all" ON push_subscriptions;
CREATE POLICY "push_subscriptions_all" ON push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);
-- NOTE: same single-tenant assumption as the rest of the core. If you go
-- multi-tenant, restrict by auth.uid() / auth.email() and require a real
-- user_id column.
