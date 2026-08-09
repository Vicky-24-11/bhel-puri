import { supabase } from '@/lib/supabase';
import { AuctionParticipant } from '@/types/database.types';

/**
 * Idempotently joins an authenticated user to an active live auction.
 */
export async function joinAuction(auctionId: string): Promise<{
  success: boolean;
  message: string;
  participant?: AuctionParticipant;
}> {
  const { data, error } = await supabase.rpc('join_auction', {
    p_auction_id: auctionId,
  });

  if (error) {
    console.error('Error in joinAuction:', error);
    throw new Error(error.message || 'Unable to join the auction. Please try again.');
  }

  return data as any;
}

/**
 * Leaves a joined auction. Only allowed if the participant has not placed any bids.
 */
export async function leaveAuction(auctionId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const { data, error } = await supabase.rpc('leave_auction', {
    p_auction_id: auctionId,
  });

  if (error) {
    console.error('Error in leaveAuction:', error);
    throw new Error(error.message || 'Unable to leave the auction. Please try again.');
  }

  return data as any;
}

/**
 * Retrieves the count of currently active participants in an auction.
 */
export async function getParticipantCount(auctionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('auction_participants')
    .select('*', { count: 'exact', head: true })
    .eq('auction_id', auctionId)
    .eq('status', 'active');

  if (error) {
    console.error('Error in getParticipantCount:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Retrieves the participation record of a specific user in an auction.
 */
export async function getUserParticipation(
  auctionId: string,
  userId: string
): Promise<AuctionParticipant | null> {
  const { data, error } = await supabase
    .from('auction_participants')
    .select('*')
    .eq('auction_id', auctionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error in getUserParticipation:', error);
    return null;
  }

  return data;
}
