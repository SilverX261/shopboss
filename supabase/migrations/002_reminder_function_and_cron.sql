-- ============================================================
-- Migration 002 — Daily checklist reminder infrastructure
-- ============================================================

-- Helper: calculate next reminder date skipping Fridays (DOW=5)
CREATE OR REPLACE FUNCTION get_next_reminder_date(from_date date)
RETURNS date AS $$
DECLARE
  next_date   date    := from_date;
  days_counted integer := 0;
BEGIN
  WHILE days_counted < 3 LOOP
    next_date := next_date + 1;
    -- Skip Fridays (DOW 5)
    IF EXTRACT(DOW FROM next_date) != 5 THEN
      days_counted := days_counted + 1;
    END IF;
  END LOOP;
  RETURN next_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Schedule the Edge Function via pg_cron
-- Runs at 4:00 AM UTC = 9:00 AM PKT (UTC+5)
-- Requires pg_cron extension enabled in Supabase dashboard
SELECT cron.schedule(
  'send-checklist-reminders',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/send-checklist-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := '{}'::jsonb
  )
  $$
);

-- Index to speed up daily reminder lookup
CREATE INDEX IF NOT EXISTS idx_shops_next_reminder_date
  ON shops(next_reminder_date)
  WHERE subscription_status IN ('trial', 'active');
