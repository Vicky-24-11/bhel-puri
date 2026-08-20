ALTER TABLE public.payment_system_config
  ADD COLUMN IF NOT EXISTS payments_blocked_globally BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payouts_blocked_globally BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunds_blocked_globally BOOLEAN NOT NULL DEFAULT false;

-- 2. Create Reconciliation discrepancies table
CREATE TABLE IF NOT EXISTS public.financial_reconciliation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL,
  internal_amount NUMERIC(12, 2),
  provider_amount NUMERIC(12, 2),
  internal_status TEXT,
  provider_status TEXT,
  metadata JSONB,
  resolution_status TEXT NOT NULL DEFAULT 'open' CHECK (resolution_status IN ('open', 'under_review', 'resolved', 'ignored')),
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index parameters
CREATE INDEX IF NOT EXISTS idx_reconciliation_issues_payment ON public.financial_reconciliation_issues(payment_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_issues_status ON public.financial_reconciliation_issues(resolution_status);

-- Register handle_updated_at trigger
DROP TRIGGER IF EXISTS tr_update_reconciliation_issues_timestamp ON public.financial_reconciliation_issues;
CREATE TRIGGER tr_update_reconciliation_issues_timestamp
  BEFORE UPDATE ON public.financial_reconciliation_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. Enable RLS on discrepancies
ALTER TABLE public.financial_reconciliation_issues ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Only Super Admins can access and manage discrepancies
DROP POLICY IF EXISTS manage_reconciliation_issues ON public.financial_reconciliation_issues;
CREATE POLICY manage_reconciliation_issues ON public.financial_reconciliation_issues
  FOR ALL USING (public.get_admin_role(auth.uid()) = 'super_admin');
