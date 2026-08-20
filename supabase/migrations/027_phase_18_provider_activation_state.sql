ALTER TABLE public.payment_system_config
  ADD COLUMN IF NOT EXISTS provider_activation_status TEXT NOT NULL DEFAULT 'pending' CHECK (provider_activation_status IN ('pending', 'active', 'blocked'));
