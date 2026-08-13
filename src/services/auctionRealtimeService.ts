import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeHandlers {
  onPriceUpdate?: (payload: {
    current_price: number;
    highest_bidder_id: string | null;
    status: string;
    winner_id: string | null;
    ends_at: string;
  }) => void;
  onNewBid?: (bid: any) => void;
  onParticipantChange?: () => void;
  onStatusChange?: (status: string) => void;
}

/**
 * Subscribes to real-time updates for a specific auction's bids, participants, and status.
 */
export function subscribeToAuction(
  auctionId: string,
  handlers: RealtimeHandlers
): RealtimeChannel {
  const channel = supabase
    .channel(`auction_${auctionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'auctions',
        filter: `id=eq.${auctionId}`,
      },
      (payload) => {
        if (handlers.onPriceUpdate) {
          handlers.onPriceUpdate(payload.new as any);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bids',
        filter: `auction_id=eq.${auctionId}`,
      },
      (payload) => {
        if (handlers.onNewBid) {
          handlers.onNewBid(payload.new);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'auction_participants',
        filter: `auction_id=eq.${auctionId}`,
      },
      () => {
        if (handlers.onParticipantChange) {
          handlers.onParticipantChange();
        }
      }
    )
    .subscribe((status) => {
      console.log(`Realtime subscription for auction ${auctionId} status:`, status);
      if (handlers.onStatusChange) {
        handlers.onStatusChange(status);
      }
    });

  return channel;
}
