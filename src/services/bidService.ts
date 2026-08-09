import { supabase } from '@/lib/supabase';
import { Bid } from '@/types/database.types';

/**
 * Atomically places a bid on a live auction using a secure Postgres function.
 */
export async function placeBid(
  auctionId: string,
  amount: number
): Promise<{ success: boolean; message: string; current_price?: number }> {
  const { data, error } = await supabase.rpc('place_bid', {
    p_auction_id: auctionId,
    p_amount: amount,
  });

  if (error) {
    console.error('Error in placeBid RPC:', error);
    throw new Error(error.message || 'Unable to place bid. Please verify and try again.');
  }

  return data as any;
}

/**
 * Fetches the bid history of a specific auction, sorted newest first.
 */
export async function getBids(auctionId: string, limit = 50): Promise<Bid[]> {
  const { data, error } = await supabase
    .from('bids')
    .select('*, bidder:profiles(username, avatar_url, full_name)')
    .eq('auction_id', auctionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error in getBids:', error);
    throw new Error('Unable to retrieve bid history.');
  }

  return data as any[] as Bid[];
}
