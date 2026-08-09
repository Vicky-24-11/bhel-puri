import { supabase } from '@/lib/supabase';
import { Auction } from '@/types/database.types';

/**
 * Resolves and finalizes a single expired auction in the database.
 */
export async function finalizeAuction(auctionId: string): Promise<{
  success: boolean;
  message: string;
  auction?: Auction;
}> {
  const { data, error } = await supabase.rpc('finalize_auction', {
    p_auction_id: auctionId,
  });

  if (error) {
    console.error('Error in finalizeAuction:', error);
    throw new Error(error.message || 'Unable to finalize the auction.');
  }

  return data as any;
}

/**
 * Sweeps and finalizes all expired live auctions in the database.
 */
export async function finalizeExpiredAuctions(): Promise<void> {
  const { error } = await supabase.rpc('finalize_expired_auctions');

  if (error) {
    console.error('Error in finalizeExpiredAuctions:', error);
  }
}
