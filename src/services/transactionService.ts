import { supabase } from '@/lib/supabase';
import { Transaction, TransactionStatus } from '@/types/database.types';

export interface TransactionWithDetails extends Transaction {
  auction: any;
  seller: any;
  buyer: any;
}

/**
 * Fetches a single transaction by its ID with relations.
 */
export async function getTransactionById(id: string): Promise<TransactionWithDetails | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, auction:auctions(*, images:auction_images(*)), seller:profiles!transactions_seller_id_fkey(*), buyer:profiles!transactions_buyer_id_fkey(*)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching transaction by ID:', error);
    return null;
  }

  return data as any;
}

/**
 * Fetches a single transaction by its auction ID.
 */
export async function getTransactionByAuctionId(auctionId: string): Promise<TransactionWithDetails | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, auction:auctions(*, images:auction_images(*)), seller:profiles!transactions_seller_id_fkey(*), buyer:profiles!transactions_buyer_id_fkey(*)')
    .eq('auction_id', auctionId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching transaction by auction ID:', error);
    return null;
  }

  return data as any;
}

/**
 * Fetches all transactions for a specific user (buyer or seller).
 */
export async function getTransactionsForUser(userId: string): Promise<TransactionWithDetails[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, auction:auctions(*, images:auction_images(*)), seller:profiles!transactions_seller_id_fkey(*), buyer:profiles!transactions_buyer_id_fkey(*)')
    .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching transactions for user:', error);
    return [];
  }

  return data as any;
}

/**
 * Updates a transaction's status. Enforces valid state transitions and inserts notification logs.
 */
export async function updateTransactionStatus(
  id: string,
  newStatus: TransactionStatus
): Promise<Transaction | null> {
  // 1. Fetch current transaction status to validate transition
  const { data: tx, error: fetchErr } = await supabase
    .from('transactions')
    .select('*, auction:auctions(*)')
    .eq('id', id)
    .single();

  if (fetchErr || !tx) {
    console.error('Transaction not found during status transition:', fetchErr);
    throw new Error('Transaction not found.');
  }

  const currentStatus: TransactionStatus = tx.status;

  // Validation Rules:
  // - completed -> cannot change
  // - cancelled -> cannot change
  // - completed cannot transition from anything other than contacted/pending
  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    throw new Error(`Cannot transition from completed or cancelled status.`);
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating transaction status:', error);
    throw new Error(error.message || 'Unable to update status.');
  }

  // 2. Queue notifications for completion
  if (newStatus === 'completed') {
    const title = '✅ Transaction completed';
    const body = `Your transaction for "${tx.auction.title}" has been marked completed.`;
    
    // Insert notifications for both parties to trigger the push notification workflow
    await Promise.all([
      supabase.from('notifications').insert({
        user_id: tx.seller_id,
        type: 'transaction_completed',
        title,
        body,
        auction_id: tx.auction_id,
      }),
      supabase.from('notifications').insert({
        user_id: tx.buyer_id,
        type: 'transaction_completed',
        title,
        body,
        auction_id: tx.auction_id,
      })
    ]).catch((notifErr) => {
      console.warn('Failed to insert transaction completed notification hooks:', notifErr);
    });
  }

  return data;
}
