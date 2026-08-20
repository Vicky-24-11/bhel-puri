-- 023_PHASE_15D_COMMISSION_AND_FINANCIAL_CONTROLS.SQL
-- Implements versioned commission configurations, protection configurations, snapshots, and append-only financial audit trail.

-- 1. Create Platform Fee Config Table (Versioned)
CREATE TABLE IF NOT EXISTS public.platform_fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00 CHECK (commission_rate >= 0.00 AND commission_rate <= 100.00),
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Constraint: Only one configuration can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_platform_fee_config 
  ON public.platform_fee_config (is_active) 
  WHERE (is_active = true);

-- 2. Create Platform Protection Config Table
CREATE TABLE IF NOT EXISTS public.platform_protection_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_protection_period_days INTEGER NOT NULL DEFAULT 7 CHECK (buyer_protection_period_days >= 0),
  payout_requires_buyer_confirmation BOOLEAN NOT NULL DEFAULT true,
  payout_auto_after_protection_expiry BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Constraint: Only one configuration can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_platform_protection_config 
  ON public.platform_protection_config (is_active) 
  WHERE (is_active = true);

-- 3. Add Commission Snapshot and Provider Cost Accounting Columns to public.payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS seller_payable_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS provider_costs_estimated NUMERIC(12, 2) DEFAULT 0.00 CHECK (provider_costs_estimated >= 0.00),
  ADD COLUMN IF NOT EXISTS provider_costs_actual NUMERIC(12, 2) DEFAULT 0.00 CHECK (provider_costs_actual >= 0.00),
  ADD COLUMN IF NOT EXISTS seller_net_payout NUMERIC(12, 2) DEFAULT 0.00 CHECK (seller_net_payout >= 0.00);

-- 4. Create Financial Audit Logs Table (Append-Only)
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('commission_config', 'protection_config', 'payment', 'transfer', 'refund', 'audit')),
  entity_id TEXT,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Trigger to automatically snapshot active commission configurations
CREATE OR REPLACE FUNCTION public.snapshot_payment_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_rate NUMERIC(5, 2);
BEGIN
  -- Fetch current active platform commission rate
  SELECT commission_rate INTO v_rate
  FROM public.platform_fee_config
  WHERE is_active = true
  ORDER BY effective_at DESC
  LIMIT 1;

  -- Default fallback
  IF v_rate IS NULL THEN
    v_rate := 5.00;
  END IF;

  new.commission_rate := v_rate;
  new.commission_amount := ROUND((new.amount * (v_rate / 100.00))::numeric, 2);
  new.seller_payable_amount := new.amount - new.commission_amount;
  new.seller_net_payout := new.seller_payable_amount - coalesce(new.provider_costs_actual, 0.00);

  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_snapshot_payment_commission ON public.payments;
CREATE TRIGGER tr_snapshot_payment_commission
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_payment_commission();

-- 6. Trigger to automatically log commission configuration audit trails
CREATE OR REPLACE FUNCTION public.log_financial_config_changes()
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
      'commission_created',
      'commission_config',
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
      'commission_updated',
      'commission_config',
      new.id::text,
      to_jsonb(old),
      to_jsonb(new)
    );
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_financial_config_changes ON public.platform_fee_config;
CREATE TRIGGER tr_log_financial_config_changes
  AFTER INSERT OR UPDATE ON public.platform_fee_config
  FOR EACH ROW
  EXECUTE FUNCTION public.log_financial_config_changes();

-- 7. Add updated_at trigger updates
DROP TRIGGER IF EXISTS tr_update_platform_fee_config_timestamp ON public.platform_fee_config;
CREATE TRIGGER tr_update_platform_fee_config_timestamp
  BEFORE UPDATE ON public.platform_fee_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_update_platform_protection_config_timestamp ON public.platform_protection_config;
CREATE TRIGGER tr_update_platform_protection_config_timestamp
  BEFORE UPDATE ON public.platform_protection_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 8. Add Indexes
CREATE INDEX IF NOT EXISTS idx_platform_fee_config_active ON public.platform_fee_config(is_active);
CREATE INDEX IF NOT EXISTS idx_platform_protection_config_active ON public.platform_protection_config(is_active);
CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_actor ON public.financial_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_created_at ON public.financial_audit_logs(created_at DESC);

-- 9. Enable RLS
ALTER TABLE public.platform_fee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_protection_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies
-- A. Platform configs: Authenticated users can view, only Super Admins can write
CREATE POLICY select_platform_fee_config ON public.platform_fee_config
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY write_platform_fee_config ON public.platform_fee_config
  FOR ALL USING (public.get_admin_role(auth.uid()) = 'super_admin');

CREATE POLICY select_platform_protection_config ON public.platform_protection_config
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY write_platform_protection_config ON public.platform_protection_config
  FOR ALL USING (public.get_admin_role(auth.uid()) = 'super_admin');

-- B. Financial Audit Logs: Only Super Admins can SELECT (Read)
CREATE POLICY select_financial_audit_logs ON public.financial_audit_logs
  FOR SELECT USING (public.get_admin_role(auth.uid()) = 'super_admin');

-- Seed initial configs
INSERT INTO public.platform_fee_config (commission_rate, is_active)
VALUES (5.00, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.platform_protection_config (buyer_protection_period_days, payout_requires_buyer_confirmation, payout_auto_after_protection_expiry, is_active)
VALUES (7, true, true, true)
ON CONFLICT DO NOTHING;
