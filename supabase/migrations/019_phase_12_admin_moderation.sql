-- 019_PHASE_12_ADMIN_MODERATION.SQL
-- Implements administrative roles, moderation status attributes, audit logs, and trigger safety checks.

-- 1. Add moderation columns to profiles and products
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended'));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'active' CHECK (moderation_status IN ('active', 'flagged', 'removed'));

-- 2. Create admin_users Table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'moderator', 'support')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 3. Create admin_audit_logs Table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'product', 'report', 'admin')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_products_moderation_status ON public.products(moderation_status);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);

-- 5. Helper security functions to check roles (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = p_user_id AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_admin_role(p_user_id uuid)
RETURNS text AS $$
BEGIN
  RETURN (
    SELECT role FROM public.admin_users
    WHERE user_id = p_user_id AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger to restrict editing of critical moderation fields on profiles, products, and reports
CREATE OR REPLACE FUNCTION public.check_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF (new.account_status <> old.account_status) THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'You are not authorized to modify account status.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_profile_status_rules ON public.profiles;
CREATE TRIGGER enforce_profile_status_rules
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_updates();

CREATE OR REPLACE FUNCTION public.check_product_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF (new.moderation_status <> old.moderation_status) THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'You are not authorized to modify product moderation status.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_product_status_rules ON public.products;
CREATE TRIGGER enforce_product_status_rules
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_product_updates();

CREATE OR REPLACE FUNCTION public.check_report_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF (new.status <> old.status) THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'You are not authorized to modify report status.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_report_status_rules ON public.reports;
CREATE TRIGGER enforce_report_status_rules
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.check_report_updates();

-- 7. Trigger to prevent suspended users from performing marketplace write operations
CREATE OR REPLACE FUNCTION public.check_suspended_user_action()
RETURNS TRIGGER AS $$
DECLARE
  v_status text;
BEGIN
  v_status := (SELECT account_status FROM public.profiles WHERE id = auth.uid());
  IF v_status = 'suspended' THEN
    RAISE EXCEPTION 'Your account is suspended and you cannot perform this marketplace action.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_suspended_products ON public.products;
CREATE TRIGGER block_suspended_products
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_suspended_user_action();

DROP TRIGGER IF EXISTS block_suspended_auctions ON public.auctions;
CREATE TRIGGER block_suspended_auctions
  BEFORE INSERT ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_suspended_user_action();

DROP TRIGGER IF EXISTS block_suspended_bids ON public.bids;
CREATE TRIGGER block_suspended_bids
  BEFORE INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.check_suspended_user_action();

DROP TRIGGER IF EXISTS block_suspended_conversations ON public.conversations;
CREATE TRIGGER block_suspended_conversations
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_suspended_user_action();

DROP TRIGGER IF EXISTS block_suspended_messages ON public.messages;
CREATE TRIGGER block_suspended_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_suspended_user_action();

-- 8. Enable Row Level Security (RLS) on Admin Tables
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 9. Admin Tables RLS Policies
DROP POLICY IF EXISTS "Allow admins to select admin list" ON public.admin_users;
CREATE POLICY "Allow admins to select admin list"
  ON public.admin_users FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Allow super admins to modify admin list" ON public.admin_users;
CREATE POLICY "Allow super admins to modify admin list"
  ON public.admin_users FOR ALL
  USING (public.get_admin_role(auth.uid()) = 'super_admin')
  WITH CHECK (public.get_admin_role(auth.uid()) = 'super_admin');

DROP POLICY IF EXISTS "Allow admins to view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Allow admins to view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Allow admins to insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Allow admins to insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- 10. Update RLS policies for reports update
DROP POLICY IF EXISTS "Allow admins to update reports" ON public.reports;
CREATE POLICY "Allow admins to update reports"
  ON public.reports FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
