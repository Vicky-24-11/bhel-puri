CREATE TABLE IF NOT EXISTS public.payment_provider_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'cashfree',
  provider_account_id TEXT UNIQUE,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
  payout_enabled BOOLEAN NOT NULL DEFAULT false,
  onboarding_status TEXT NOT NULL DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'submitted', 'under_review', 'approved', 'rejected', 'suspended')),
  failure_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user query
CREATE INDEX IF NOT EXISTS idx_payment_provider_accounts_user ON public.payment_provider_accounts(user_id);

-- Register handle_updated_at trigger
DROP TRIGGER IF EXISTS tr_update_provider_accounts_timestamp ON public.payment_provider_accounts;
CREATE TRIGGER tr_update_provider_accounts_timestamp
  BEFORE UPDATE ON public.payment_provider_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. Create System payment Configuration Table (Safety Switch)
CREATE TABLE IF NOT EXISTS public.payment_system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_payments_enabled BOOLEAN NOT NULL DEFAULT false,
  payment_environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (payment_environment IN ('sandbox', 'production')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Constraint index to enforce only one active system configuration
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_payment_system_config
  ON public.payment_system_config (is_active)
  WHERE (is_active = true);

-- Register handle_updated_at trigger
DROP TRIGGER IF EXISTS tr_update_payment_system_config_timestamp ON public.payment_system_config;
CREATE TRIGGER tr_update_payment_system_config_timestamp
  BEFORE UPDATE ON public.payment_system_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Trigger to automatically log system config updates to financial audit logs
CREATE OR REPLACE FUNCTION public.log_payment_system_config_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      previous_value,
      new_value
    )
    VALUES (
      auth.uid(),
      'system_config_created',
      'audit',
      new.id::text,
      NULL,
      to_jsonb(new)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.financial_audit_logs (
      actor_id,
      action,
      entity_type,
      entity_id,
      previous_value,
      new_value
    )
    VALUES (
      auth.uid(),
      'system_config_updated',
      'audit',
      new.id::text,
      to_jsonb(old),
      to_jsonb(new)
    );
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_payment_system_config_changes ON public.payment_system_config;
CREATE TRIGGER tr_log_payment_system_config_changes
  AFTER INSERT OR UPDATE ON public.payment_system_config
  FOR EACH ROW
  EXECUTE FUNCTION public.log_payment_system_config_changes();

-- 4. Enable RLS on new tables
ALTER TABLE public.payment_provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_system_config ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- A. Seller accounts: Users can SELECT their own records, only Super Admins can SELECT all or modify
CREATE POLICY select_my_provider_account ON public.payment_provider_accounts
  FOR SELECT USING (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY manage_all_provider_accounts ON public.payment_provider_accounts
  FOR ALL USING (public.get_admin_role(auth.uid()) = 'super_admin');

-- B. System configs: Authenticated users can read config, only Super Admins can write config
CREATE POLICY select_payment_system_config ON public.payment_system_config
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY write_payment_system_config ON public.payment_system_config
  FOR ALL USING (public.get_admin_role(auth.uid()) = 'super_admin');

-- Seed default initial configuration (Production = false, Environment = sandbox)
INSERT INTO public.payment_system_config (production_payments_enabled, payment_environment, is_active)
VALUES (false, 'sandbox', true)
ON CONFLICT DO NOTHING;
