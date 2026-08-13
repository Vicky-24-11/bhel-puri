-- 013_PHASE_7_WEBHOOK_FIX.SQL
-- Configures async webhook relays using the pg_net extension to bypass missing supabase_functions schema errors.

-- 1. Enable pg_net extension (Supabase-supported async HTTP request library)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Initialize public anon key in Vault (idempotent check)
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'anon_key') THEN
    PERFORM vault.create_secret('sb_publishable_udCoQISXdMw4bHUIwyQSFw_exIPEN0i', 'anon_key');
  END IF;
END $body$;

-- 2. Create the Trigger Function to dispatch HTTP requests asynchronously
CREATE OR REPLACE FUNCTION public.handle_notification_push_trigger()
RETURNS TRIGGER AS $body$
DECLARE
  v_url text := 'https://nmwtpozrywbkgekugqzd.supabase.co/functions/v1/send-push-notification';
  v_anon_key text;
  v_req_id bigint;
BEGIN
  -- Retrieve public anon key from Supabase Vault (decrypted_secrets)
  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'anon_key'
  LIMIT 1;

  -- Fallback: If Vault query fails or is empty, resolve key from active request header settings
  IF v_anon_key IS NULL THEN
    BEGIN
      v_anon_key := NULLIF(current_setting('request.headers', true), '')::json->>'apikey';
    EXCEPTION WHEN OTHERS THEN
      v_anon_key := NULL;
    END;
  END IF;

  -- Fire asynchronous HTTP POST request in the background
  IF v_anon_key IS NOT NULL THEN
    SELECT net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_anon_key,
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object('record', to_jsonb(new))
    ) INTO v_req_id;
  END IF;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Emit warning in logs but NEVER block/fail the database insert transaction!
    RAISE WARNING 'Notification push webhook trigger failed: %', SQLERRM;
    RETURN new;
END;
$body$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Register the trigger on public.notifications
DROP TRIGGER IF EXISTS tr_notifications_push_webhook ON public.notifications;
CREATE TRIGGER tr_notifications_push_webhook
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_notification_push_trigger();
