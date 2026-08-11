import { useState, useEffect, useCallback, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { subscribeToAuction } from '@/services/auctionRealtimeService';
import { getAuctionById } from '@/services/auctionService';
import { getBids } from '@/services/bidService';
import { getParticipantCount } from '@/services/auctionParticipantService';
import { Auction, Bid, AuctionImage } from '@/types/database.types';

export type AuctionWithRelations = Auction & {
  seller: any;
  winner?: any;
  images: AuctionImage[];
};

/**
 * Manages the lifetime of a Supabase Realtime Channel subscription.
 * Resolves loading sequences, initial values, and updates components reactively on database triggers.
 */
export function useAuctionRealtime(auctionId: string) {
  const [auction, setAuction] = useState<AuctionWithRelations | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [aucData, bidsData, countData] = await Promise.all([
        getAuctionById(auctionId),
        getBids(auctionId, 30),
        getParticipantCount(auctionId),
      ]);

      if (aucData) {
        setAuction(aucData);
      } else {
        setError('Auction not found.');
      }
      setBids(bidsData);
      setParticipantCount(countData);
    } catch (err: any) {
      console.error('Error fetching initial data for auction:', err);
      setError(err.message || 'Failed to load auction details.');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  // Public reload operation triggered on app resume or manual swipe pulls
  const refresh = useCallback(async () => {
    try {
      const [aucData, bidsData, countData] = await Promise.all([
        getAuctionById(auctionId),
        getBids(auctionId, 30),
        getParticipantCount(auctionId),
      ]);

      if (aucData) {
        setAuction(aucData);
      }
      setBids(bidsData);
      setParticipantCount(countData);
    } catch (err) {
      console.error('Error refreshing auction data:', err);
    }
  }, [auctionId]);

  useEffect(() => {
    let active = true;

    // Load static values
    fetchInitialData();

    // Subscribe to realtime database channels
    const channel = subscribeToAuction(auctionId, {
      onPriceUpdate: (payload) => {
        if (!active) return;
        console.log(`[Realtime][Auction Update] Received update payload:`, payload);
        if (payload) {
          setAuction((prev) => {
            if (!prev) return null;
            // Prevent overwriting with older state if events are received out-of-order
            if (Number(payload.current_price) >= prev.current_price) {
              console.log(`[Realtime][Current Price] Updating current price to ₹${payload.current_price} from auction update`);
              return {
                ...prev,
                current_price: Number(payload.current_price),
                highest_bidder_id: payload.highest_bidder_id,
                status: payload.status as any,
                winner_id: payload.winner_id,
                ends_at: payload.ends_at,
              };
            }
            return prev;
          });
        }
      },
      onNewBid: (newBid) => {
        if (!active) return;
        console.log(`[Realtime][Bid Insert] Received bid payload:`, newBid);
        
        // Query the bids table dynamically to include bidder names/avatars
        getBids(auctionId, 30)
          .then((newBids) => {
            if (active) setBids(newBids);
          })
          .catch((err) => console.error('Error updating realtime bids list:', err.message));

        // Update current price if new bid is greater than local current price
        if (newBid) {
          setAuction((prev) => {
            if (!prev) return null;
            if (Number(newBid.amount) > prev.current_price) {
              console.log(`[Realtime][Current Price] Updating current price to ₹${newBid.amount} from bid insert`);
              return {
                ...prev,
                current_price: Number(newBid.amount),
                highest_bidder_id: newBid.bidder_id,
              };
            }
            return prev;
          });
        }
      },
      onParticipantChange: () => {
        if (!active) return;
        getParticipantCount(auctionId)
          .then((count) => {
            if (active) setParticipantCount(count);
          })
          .catch((err) => console.error('Error updating participant count:', err.message));
      },
    });

    channelRef.current = channel;
    setIsConnected(true);

    return () => {
      active = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [auctionId, fetchInitialData]);

  return {
    auction,
    bids,
    participantCount,
    loading,
    error,
    isConnected,
    refresh,
  };
}
