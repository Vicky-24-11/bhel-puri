-- 020_PHASE_13_DISPUTES_AND_EVIDENCE.SQL
-- Implements disputes tracking, dispute evidence registry, audit trails, and storage configurations.

-- 1. Create public.disputes table
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'under_review', 'resolved_buyer', 'resolved_seller', 'cancelled')) DEFAULT 'open',
  resolution TEXT,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  resolved_at TIMESTAMPTZ
);

-- 2. Create public.dispute_evidence table
CREATE TABLE IF NOT EXISTS public.dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create public.dispute_events table
CREATE TABLE IF NOT EXISTS public.dispute_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Create public.transaction_events table
CREATE TABLE IF NOT EXISTS public.transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS idx_disputes_transaction_id ON public.disputes(transaction_id);
CREATE INDEX IF NOT EXISTS idx_disputes_created_by ON public.disputes(created_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute_id ON public.dispute_evidence(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_events_dispute_id ON public.dispute_events(dispute_id);
CREATE INDEX IF NOT EXISTS idx_transaction_events_transaction_id ON public.transaction_events(transaction_id);

-- Enforce exactly one active (open or under_review) dispute per transaction via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_dispute_per_transaction 
  ON public.disputes (transaction_id) 
  WHERE (status IN ('open', 'under_review'));

-- 6. Trigger to force current authenticated user as dispute creator
CREATE OR REPLACE FUNCTION public.set_dispute_creator()
RETURNS TRIGGER AS $$
BEGIN
  new.created_by := auth.uid();
  new.status := 'open';
  new.resolution := NULL;
  new.resolution_note := NULL;
  new.resolved_at := NULL;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_dispute_creator ON public.disputes;
CREATE TRIGGER enforce_dispute_creator
  BEFORE INSERT ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_dispute_creator();

-- 7. Trigger to automatically log transaction creations and updates (Audit Trail)
CREATE OR REPLACE FUNCTION public.log_transaction_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (new.status <> old.status) THEN
    INSERT INTO public.transaction_events (
      transaction_id,
      actor_id,
      event_type,
      from_status,
      to_status
    )
    VALUES (
      new.id,
      auth.uid(),
      'status_changed',
      old.status,
      new.status
    );
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_transaction_status_change ON public.transactions;
CREATE TRIGGER tr_log_transaction_status_change
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_transaction_status_change();

CREATE OR REPLACE FUNCTION public.log_transaction_insert_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.transaction_events (
    transaction_id,
    actor_id,
    event_type,
    from_status,
    to_status
  )
  VALUES (
    new.id,
    new.seller_id,
    'transaction_created',
    NULL,
    new.status
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_transaction_insert ON public.transactions;
CREATE TRIGGER tr_log_transaction_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_transaction_insert_event();

-- 8. Trigger to automatically log dispute creations, resolution changes, and notifications
CREATE OR REPLACE FUNCTION public.log_dispute_insert_event()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id UUID;
  v_buyer_id UUID;
  v_auction_id UUID;
  v_recipient_id UUID;
  v_party_label TEXT;
BEGIN
  -- Log audit event
  INSERT INTO public.dispute_events (
    dispute_id,
    actor_id,
    event_type,
    metadata
  )
  VALUES (
    new.id,
    new.created_by,
    'dispute_created',
    jsonb_build_object('reason', new.reason)
  );

  -- Fetch transaction details using scalar assignments
  v_seller_id := (SELECT seller_id FROM public.transactions WHERE id = new.transaction_id);
  v_buyer_id := (SELECT buyer_id FROM public.transactions WHERE id = new.transaction_id);
  v_auction_id := (SELECT auction_id FROM public.transactions WHERE id = new.transaction_id);

  IF new.created_by = v_buyer_id THEN
    v_recipient_id := v_seller_id;
    v_party_label := 'Buyer';
  ELSE
    v_recipient_id := v_buyer_id;
    v_party_label := 'Seller';
  END IF;

  -- Notify opposite party
  IF (v_recipient_id IS NOT NULL) THEN
    INSERT INTO public.notifications (user_id, type, title, body, auction_id)
    VALUES (
      v_recipient_id,
      'auction_ended',
      '⚠️ Dispute Opened',
      v_party_label || ' has opened a dispute for your transaction.',
      v_auction_id
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_dispute_insert ON public.disputes;
CREATE TRIGGER tr_log_dispute_insert
  AFTER INSERT ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_dispute_insert_event();

CREATE OR REPLACE FUNCTION public.log_dispute_update_event()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_id UUID;
  v_buyer_id UUID;
  v_auction_id UUID;
BEGIN
  -- Log audit event on status update
  IF (new.status <> old.status) THEN
    INSERT INTO public.dispute_events (
      dispute_id,
      actor_id,
      event_type,
      metadata
    )
    VALUES (
      new.id,
      auth.uid(),
      'status_changed',
      jsonb_build_object('from_status', old.status, 'to_status', new.status, 'resolution_note', new.resolution_note)
    );

    -- Fetch transaction details using scalar assignments
    v_seller_id := (SELECT seller_id FROM public.transactions WHERE id = new.transaction_id);
    v_buyer_id := (SELECT buyer_id FROM public.transactions WHERE id = new.transaction_id);
    v_auction_id := (SELECT auction_id FROM public.transactions WHERE id = new.transaction_id);

    -- Notify both parties
    IF (v_seller_id IS NOT NULL) THEN
      INSERT INTO public.notifications (user_id, type, title, body, auction_id)
      VALUES (
        v_seller_id,
        'auction_ended',
        '⚖️ Dispute Status Updated',
        'Your transaction dispute status was changed to ' || new.status || '.',
        v_auction_id
      );
    END IF;

    IF (v_buyer_id IS NOT NULL) THEN
      INSERT INTO public.notifications (user_id, type, title, body, auction_id)
      VALUES (
        v_buyer_id,
        'auction_ended',
        '⚖️ Dispute Status Updated',
        'Your transaction dispute status was changed to ' || new.status || '.',
        v_auction_id
      );
    END IF;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_dispute_update ON public.disputes;
CREATE TRIGGER tr_log_dispute_update
  AFTER UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_dispute_update_event();

-- 9. Enable Row Level Security (RLS) on Disputes & Events Tables
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies

-- Disputes SELECT: Buyer, Seller, or Admin
DROP POLICY IF EXISTS select_disputes ON public.disputes;
CREATE POLICY select_disputes ON public.disputes
  FOR SELECT
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id AND (auth.uid() = t.seller_id OR auth.uid() = t.buyer_id)
    ) OR
    public.is_admin(auth.uid())
  );

-- Disputes INSERT: Buyer or Seller of that transaction
DROP POLICY IF EXISTS insert_disputes ON public.disputes;
CREATE POLICY insert_disputes ON public.disputes
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id AND (auth.uid() = t.seller_id OR auth.uid() = t.buyer_id)
    )
  );

-- Disputes UPDATE: Admin only
DROP POLICY IF EXISTS update_disputes ON public.disputes;
CREATE POLICY update_disputes ON public.disputes
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Dispute Evidence SELECT: Participant or Admin
DROP POLICY IF EXISTS select_dispute_evidence ON public.dispute_evidence;
CREATE POLICY select_dispute_evidence ON public.dispute_evidence
  FOR SELECT
  USING (
    auth.uid() = uploader_id OR
    EXISTS (
      SELECT 1 FROM public.disputes d
      JOIN public.transactions t ON d.transaction_id = t.id
      WHERE d.id = dispute_id AND (auth.uid() = t.seller_id OR auth.uid() = t.buyer_id)
    ) OR
    public.is_admin(auth.uid())
  );

-- Dispute Evidence INSERT: Participant uploader only (Append-only: no updates or deletes)
DROP POLICY IF EXISTS insert_dispute_evidence ON public.dispute_evidence;
CREATE POLICY insert_dispute_evidence ON public.dispute_evidence
  FOR INSERT
  WITH CHECK (
    auth.uid() = uploader_id AND
    EXISTS (
      SELECT 1 FROM public.disputes d
      JOIN public.transactions t ON d.transaction_id = t.id
      WHERE d.id = dispute_id AND (auth.uid() = t.seller_id OR auth.uid() = t.buyer_id)
    )
  );

-- Dispute Events SELECT: Participant or Admin
DROP POLICY IF EXISTS select_dispute_events ON public.dispute_events;
CREATE POLICY select_dispute_events ON public.dispute_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.disputes d
      JOIN public.transactions t ON d.transaction_id = t.id
      WHERE d.id = dispute_id AND (auth.uid() = t.seller_id OR auth.uid() = t.buyer_id)
    ) OR
    public.is_admin(auth.uid())
  );

-- Transaction Events SELECT: Participant or Admin
DROP POLICY IF EXISTS select_transaction_events ON public.transaction_events;
CREATE POLICY select_transaction_events ON public.transaction_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_id AND (auth.uid() = t.seller_id OR auth.uid() = t.buyer_id)
    ) OR
    public.is_admin(auth.uid())
  );

-- 11. Private Storage Setup for dispute-evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('dispute-evidence', 'dispute-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow dispute participants to download evidence" ON storage.objects;
CREATE POLICY "Allow dispute participants to download evidence" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'dispute-evidence' AND (
      public.is_admin(auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.disputes d
        JOIN public.transactions t ON d.transaction_id = t.id
        WHERE d.id::text = (storage.foldername(name))[1] AND (
          auth.uid() = t.seller_id OR auth.uid() = t.buyer_id
        )
      )
    )
  );

DROP POLICY IF EXISTS "Allow dispute uploader to insert evidence" ON storage.objects;
CREATE POLICY "Allow dispute uploader to insert evidence" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'dispute-evidence' AND (
      auth.uid() IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.disputes d
        JOIN public.transactions t ON d.transaction_id = t.id
        WHERE d.id::text = (storage.foldername(name))[1] AND (
          auth.uid() = t.seller_id OR auth.uid() = t.buyer_id
        )
      )
    )
  );

DROP POLICY IF EXISTS "Allow admins to delete evidence objects" ON storage.objects;
CREATE POLICY "Allow admins to delete evidence objects" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'dispute-evidence' AND public.is_admin(auth.uid())
  );
