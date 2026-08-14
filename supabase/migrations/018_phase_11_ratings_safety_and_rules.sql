-- 018_PHASE_11_RATINGS_SAFETY_AND_RULES.SQL
-- Implements robust server-side safety checks for ratings, updates, and reports.

-- 1. Enable Update Policy for Ratings
DROP POLICY IF EXISTS "Allow users to update their own ratings" ON public.ratings;
CREATE POLICY "Allow users to update their own ratings"
  ON public.ratings FOR UPDATE
  USING (auth.role() = 'authenticated' AND auth.uid() = reviewer_id)
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = reviewer_id);

-- 2. Create trigger function to validate rating submission rules on INSERT
CREATE OR REPLACE FUNCTION public.check_rating_submission()
RETURNS TRIGGER AS $$
DECLARE
  v_auction_status text;
  v_seller_id uuid;
  v_buyer_id uuid;
BEGIN
  -- Validate rating range
  IF new.rating_value < 1 OR new.rating_value > 5 THEN
    RAISE EXCEPTION 'Rating value must be between 1 and 5.';
  END IF;

  -- Fetch auction status using assignments
  v_auction_status := (SELECT status FROM public.auctions WHERE id = new.auction_id);
  IF v_auction_status IS NULL THEN
    RAISE EXCEPTION 'Auction listing not found.';
  END IF;

  -- Verify auction status is completed
  IF v_auction_status <> 'completed' THEN
    RAISE EXCEPTION 'You can only leave a rating after the auction is completed successfully.';
  END IF;

  -- Fetch transaction details using assignments
  v_seller_id := (SELECT seller_id FROM public.transactions WHERE auction_id = new.auction_id);
  v_buyer_id := (SELECT buyer_id FROM public.transactions WHERE auction_id = new.auction_id);
  IF v_seller_id IS NULL OR v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'No completed transaction record found for this auction.';
  END IF;

  -- Verify reviewer and reviewee credentials relative to the transaction
  IF new.reviewer_id = v_seller_id THEN
    -- Seller is rating the buyer
    IF new.reviewee_id <> v_buyer_id THEN
      RAISE EXCEPTION 'As the seller, you can only rate the winning buyer of this transaction.';
    END IF;
  ELSIF new.reviewer_id = v_buyer_id THEN
    -- Buyer is rating the seller
    IF new.reviewee_id <> v_seller_id THEN
      RAISE EXCEPTION 'As the buyer, you can only rate the seller of this transaction.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Access denied. You are not an authorized participant in this transaction.';
  END IF;

  -- Prevent self-rating
  IF new.reviewer_id = new.reviewee_id THEN
    RAISE EXCEPTION 'You cannot rate yourself.';
  END IF;

  -- Clean and validate comment length
  IF new.comment IS NOT NULL THEN
    new.comment := trim(new.comment);
    IF new.comment = '' THEN
      new.comment := NULL;
    ELSIF length(new.comment) > 500 THEN
      RAISE EXCEPTION 'Review comment must not exceed 500 characters.';
    END IF;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_rating_rules ON public.ratings;
CREATE TRIGGER enforce_rating_rules
  BEFORE INSERT ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_rating_submission();

-- 3. Create trigger function to validate rating update rules on UPDATE
CREATE OR REPLACE FUNCTION public.check_rating_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent altering core references
  IF (new.reviewer_id <> old.reviewer_id OR
      new.reviewee_id <> old.reviewee_id OR
      new.auction_id <> old.auction_id) THEN
    RAISE EXCEPTION 'You cannot modify the reviewer, reviewee, or auction metadata of an existing rating.';
  END IF;

  -- Validate rating range
  IF new.rating_value < 1 OR new.rating_value > 5 THEN
    RAISE EXCEPTION 'Rating value must be between 1 and 5.';
  END IF;

  -- Clean and validate comment length
  IF new.comment IS NOT NULL THEN
    new.comment := trim(new.comment);
    IF new.comment = '' THEN
      new.comment := NULL;
    ELSIF length(new.comment) > 500 THEN
      RAISE EXCEPTION 'Review comment must not exceed 500 characters.';
    END IF;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_rating_update_rules ON public.ratings;
CREATE TRIGGER enforce_rating_update_rules
  BEFORE UPDATE ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_rating_updates();

-- 4. Create trigger function to prevent report spam and enforce safety limits
CREATE OR REPLACE FUNCTION public.check_duplicate_reports()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate description length (max 1000 characters)
  IF (new.description IS NOT NULL) THEN
    new.description := trim(new.description);
    IF (length(new.description) > 1000) THEN
      RAISE EXCEPTION 'Report description exceeds the 1000 character limit.';
    END IF;
  END IF;

  -- Prevent report spam: Check for existing pending/reviewing reports from same reporter
  IF (new.reported_user_id IS NOT NULL) THEN
    IF EXISTS (
      SELECT 1 FROM public.reports
      WHERE reporter_id = new.reporter_id 
        AND reported_user_id = new.reported_user_id 
        AND status IN ('pending', 'reviewing')
    ) THEN
      RAISE EXCEPTION 'You have already submitted a report for this user that is currently under review.';
    END IF;
  END IF;

  IF (new.auction_id IS NOT NULL) THEN
    IF EXISTS (
      SELECT 1 FROM public.reports
      WHERE reporter_id = new.reporter_id 
        AND auction_id = new.auction_id 
        AND status IN ('pending', 'reviewing')
    ) THEN
      RAISE EXCEPTION 'You have already submitted a report for this listing that is currently under review.';
    END IF;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_report_spam ON public.reports;
CREATE TRIGGER prevent_report_spam
  BEFORE INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.check_duplicate_reports();
