import { supabase } from '@/lib/supabase';
import { Rating } from '@/types/database.types';

export interface ReputationSummary {
  averageRating: number;
  totalRatingsCount: number;
  completedTransactionsCount: number;
  completedSalesCount: number;
  completedPurchasesCount: number;
  positiveReviewsPercent: number;
  sellerAverageRating: number;
  sellerRatingsCount: number;
  buyerAverageRating: number;
  buyerRatingsCount: number;
}

/**
 * Submits a new rating/review.
 */
export async function submitRating(rating: {
  auction_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating_value: number;
  comment?: string | null;
}) {
  const { data, error } = await supabase
    .from('ratings')
    .insert({
      auction_id: rating.auction_id,
      reviewer_id: rating.reviewer_id,
      reviewee_id: rating.reviewee_id,
      rating_value: rating.rating_value,
      comment: rating.comment ? rating.comment.trim() : null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error submitting rating service:', error);
    throw new Error(error.message || 'Unable to submit rating.');
  }

  // Queue activity notification for the rated user
  try {
    const { data: reviewerProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', rating.reviewer_id)
      .single();

    const reviewerName = reviewerProfile?.username ? `@${reviewerProfile.username}` : 'A user';
    await supabase.from('notifications').insert({
      user_id: rating.reviewee_id,
      type: 'new_message',
      title: '⭐ New Rating Received',
      body: `${reviewerName} left you a ${rating.rating_value}-star rating.`,
      auction_id: rating.auction_id,
    });
  } catch (notifErr) {
    console.warn('Failed to insert rating notification:', notifErr);
  }

  return data;
}

/**
 * Updates an existing rating/review.
 */
export async function updateRating(
  ratingId: string,
  ratingValue: number,
  comment?: string | null
) {
  const { data, error } = await supabase
    .from('ratings')
    .update({
      rating_value: ratingValue,
      comment: comment ? comment.trim() : null,
    })
    .eq('id', ratingId)
    .select()
    .single();

  if (error) {
    console.error('Error updating rating service:', error);
    throw new Error(error.message || 'Unable to update rating.');
  }
  return data;
}

/**
 * Checks if a rating exists for a specific auction and reviewer.
 */
export async function getRatingByReviewer(
  auctionId: string,
  reviewerId: string
): Promise<Rating | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('auction_id', auctionId)
    .eq('reviewer_id', reviewerId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching rating by reviewer:', error);
    return null;
  }
  return data;
}

/**
 * Fetches ratings and reviews received by a user.
 */
export async function getRatingsForUser(
  userId: string,
  role?: 'seller' | 'buyer',
  limit = 10,
  offset = 0
) {
  // Use postgrest inner join filtering to filter on the nested auction seller_id
  let query = supabase
    .from('ratings')
    .select('*, reviewer:profiles!ratings_reviewer_id_fkey(*), auction:auctions!ratings_auction_id_fkey!inner(*)');

  if (role === 'seller') {
    query = query.eq('auction.seller_id', userId);
  } else if (role === 'buyer') {
    query = query.neq('auction.seller_id', userId);
  }

  const { data, error } = await query
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching ratings for user:', error);
    return [];
  }
  return data;
}

/**
 * Calculates a complete reputation summary for a user.
 */
export async function getUserReputationSummary(userId: string): Promise<ReputationSummary> {
  // 1. Fetch completed transaction counts
  const { count: salesCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .eq('seller_id', userId);

  const { count: purchasesCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .eq('buyer_id', userId);

  // 2. Fetch all ratings received by this user
  const { data: ratings, error } = await supabase
    .from('ratings')
    .select('rating_value, auction:auctions(seller_id)')
    .eq('reviewee_id', userId);

  if (error || !ratings || ratings.length === 0) {
    return {
      averageRating: 0,
      totalRatingsCount: 0,
      completedTransactionsCount: (salesCount || 0) + (purchasesCount || 0),
      completedSalesCount: salesCount || 0,
      completedPurchasesCount: purchasesCount || 0,
      positiveReviewsPercent: 0,
      sellerAverageRating: 0,
      sellerRatingsCount: 0,
      buyerAverageRating: 0,
      buyerRatingsCount: 0,
    };
  }

  // Calculate statistics
  let totalRatingVal = 0;
  let positiveCount = 0;

  let sellerRatingVal = 0;
  let sellerCount = 0;

  let buyerRatingVal = 0;
  let buyerCount = 0;

  for (const rating of ratings) {
    const val = rating.rating_value;
    const isSellerRating = (rating.auction as any)?.seller_id === userId;

    totalRatingVal += val;
    if (val >= 4) {
      positiveCount++;
    }

    if (isSellerRating) {
      sellerRatingVal += val;
      sellerCount++;
    } else {
      buyerRatingVal += val;
      buyerCount++;
    }
  }

  const totalCount = ratings.length;

  return {
    averageRating: Math.round((totalRatingVal / totalCount) * 10) / 10,
    totalRatingsCount: totalCount,
    completedTransactionsCount: (salesCount || 0) + (purchasesCount || 0),
    completedSalesCount: salesCount || 0,
    completedPurchasesCount: purchasesCount || 0,
    positiveReviewsPercent: Math.round((positiveCount / totalCount) * 100),
    sellerAverageRating: sellerCount > 0 ? Math.round((sellerRatingVal / sellerCount) * 10) / 10 : 0,
    sellerRatingsCount: sellerCount,
    buyerAverageRating: buyerCount > 0 ? Math.round((buyerRatingVal / buyerCount) * 10) / 10 : 0,
    buyerRatingsCount: buyerCount,
  };
}
