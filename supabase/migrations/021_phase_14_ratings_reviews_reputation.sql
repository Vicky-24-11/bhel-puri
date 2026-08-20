-- 021_PHASE_14_RATINGS_REVIEWS_REPUTATION.SQL
-- Implements status column and automatic database triggers to aggregate published user ratings on profiles.

-- 1. Add status column to ratings table if it doesn't exist
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed'));

-- 2. Create trigger function to aggregate published ratings
CREATE OR REPLACE FUNCTION public.aggregate_user_ratings()
RETURNS TRIGGER AS $$
DECLARE
  v_reviewee_id UUID;
  v_avg_rating NUMERIC(3, 2);
  v_total_ratings INTEGER;
BEGIN
  -- Determine the affected profile ID
  IF TG_OP = 'DELETE' THEN
    v_reviewee_id := old.reviewee_id;
  ELSE
    v_reviewee_id := new.reviewee_id;
  END IF;

  -- Calculate average rating and count (only published reviews count towards reputation)
  SELECT coalesce(avg(rating_value), 0.00), count(id)
  INTO v_avg_rating, v_total_ratings
  FROM public.ratings
  WHERE reviewee_id = v_reviewee_id
    AND status = 'published';

  -- Sync values to profiles cache columns
  UPDATE public.profiles
  SET
    rating = v_avg_rating,
    total_ratings = v_total_ratings,
    updated_at = now()
  WHERE id = v_reviewee_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Register trigger on ratings table
DROP TRIGGER IF EXISTS tr_aggregate_user_ratings ON public.ratings;
CREATE TRIGGER tr_aggregate_user_ratings
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.aggregate_user_ratings();
