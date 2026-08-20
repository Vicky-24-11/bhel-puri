import { supabase } from '../lib/supabase';
import { Dispute, DisputeEvidence, DisputeEvent, TransactionEvent } from '../types/database.types';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

// Helper to convert URIs to Blobs/ArrayBuffers cross-platform
async function readImageData(uri: string): Promise<Blob | ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return await response.blob();
  } else {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return decode(base64);
  }
}

/**
 * Creates a new dispute for a transaction.
 */
export async function createDispute(
  transactionId: string,
  reason: string,
  description: string
): Promise<Dispute> {
  const { data, error } = await supabase
    .from('disputes')
    .insert({
      transaction_id: transactionId,
      reason,
      description,
    })
    .select()
    .single();

  if (error) {
    console.error('Error in createDispute:', error);
    throw new Error(error.message || 'Unable to file dispute.');
  }

  return data;
}

/**
 * Fetches the active dispute for a transaction.
 */
export async function getDisputeByTransactionId(transactionId: string): Promise<Dispute | null> {
  const { data, error } = await supabase
    .from('disputes')
    .select('*, creator:profiles!disputes_created_by_fkey(*)')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error in getDisputeByTransactionId:', error);
    return null;
  }

  return data;
}

/**
 * Fetches dispute details by its ID.
 */
export async function getDisputeById(id: string): Promise<Dispute | null> {
  const { data, error } = await supabase
    .from('disputes')
    .select('*, creator:profiles!disputes_created_by_fkey(*), transaction:transactions(*)')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error in getDisputeById:', error);
    return null;
  }

  return data;
}

/**
 * Uploads evidence photo for a dispute.
 */
export async function uploadDisputeEvidence(
  disputeId: string,
  uri: string,
  uploaderId: string
): Promise<string> {
  const fileData = await readImageData(uri);
  const extension = uri.split('.').pop() || 'jpg';
  const fileUuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const storagePath = `${disputeId}/${fileUuid}.${extension}`;

  // 1. Upload file to private storage bucket
  const { error: uploadError } = await supabase.storage
    .from('dispute-evidence')
    .upload(storagePath, fileData, {
      contentType: `image/${extension === 'png' ? 'png' : 'jpeg'}`,
    });

  if (uploadError) {
    console.error('Error in uploadDisputeEvidence storage upload:', uploadError);
    throw new Error('Failed to upload evidence image.');
  }

  // 2. Insert reference row in database
  const { error: dbError } = await supabase
    .from('dispute_evidence')
    .insert({
      dispute_id: disputeId,
      uploader_id: uploaderId,
      storage_path: storagePath,
    });

  if (dbError) {
    console.error('Error in dispute_evidence DB insert:', dbError);
    // Cleanup storage file on db failure
    await supabase.storage.from('dispute-evidence').remove([storagePath]);
    throw new Error('Failed to save dispute evidence reference.');
  }

  return storagePath;
}

/**
 * Retrieves evidence registry rows for a dispute.
 */
export async function getDisputeEvidence(disputeId: string): Promise<DisputeEvidence[]> {
  const { data, error } = await supabase
    .from('dispute_evidence')
    .select('*, uploader:profiles!dispute_evidence_uploader_id_fkey(*)')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error in getDisputeEvidence:', error);
    return [];
  }

  return data || [];
}

/**
 * Generates a temporary signed URL for viewing private dispute evidence.
 */
export async function getSignedEvidenceUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('dispute-evidence')
    .createSignedUrl(storagePath, 3600); // 1 hour expiration

  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }

  return data?.signedUrl || null;
}

/**
 * Fetches all transaction events for a transaction.
 */
export async function getTransactionEvents(transactionId: string): Promise<TransactionEvent[]> {
  const { data, error } = await supabase
    .from('transaction_events')
    .select('*, actor:profiles!transaction_events_actor_id_fkey(*)')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching transaction events:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetches all dispute events for a dispute.
 */
export async function getDisputeEvents(disputeId: string): Promise<DisputeEvent[]> {
  const { data, error } = await supabase
    .from('dispute_events')
    .select('*, actor:profiles!dispute_events_actor_id_fkey(*)')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching dispute events:', error);
    return [];
  }

  return data || [];
}

/**
 * Admin action: update dispute status.
 */
export async function resolveDispute(
  id: string,
  newStatus: Dispute['status'],
  note: string,
  resolution: string
): Promise<Dispute | null> {
  const { data, error } = await supabase
    .from('disputes')
    .update({
      status: newStatus,
      resolution_note: note,
      resolution,
      resolved_at: newStatus.startsWith('resolved') ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error resolving dispute:', error);
    throw new Error(error.message || 'Failed to update dispute status.');
  }

  return data;
}

/**
 * Admin action: fetch all disputes.
 */
export async function getAdminDisputes(statusFilter?: string): Promise<Dispute[]> {
  let query = supabase
    .from('disputes')
    .select('*, creator:profiles!disputes_created_by_fkey(*), transaction:transactions(*, auction:auctions(*))')
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching admin disputes:', error);
    return [];
  }

  return data || [];
}
