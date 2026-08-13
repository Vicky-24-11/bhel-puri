import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database.types';

export interface BlockedRelationship {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
  blocked?: Profile;
}

export interface UserReport {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  auction_id: string | null;
  message_id: string | null;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed' | 'action_taken';
  created_at: string;
  updated_at: string;
  reported_user?: Profile | null;
  auction?: { title: string } | null;
}

/**
 * Submits a trust, safety, or moderation report for an auction, user, or message.
 */
export async function submitReport(
  targetType: 'user' | 'auction' | 'message',
  targetId: string,
  reason: string,
  description?: string
): Promise<UserReport> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to submit a report.');

  const payload: any = {
    reporter_id: user.id,
    reason,
    description: description || null,
  };

  if (targetType === 'user') payload.reported_user_id = targetId;
  else if (targetType === 'auction') payload.auction_id = targetId;
  else if (targetType === 'message') payload.message_id = targetId;

  const { data, error } = await supabase
    .from('reports')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Error submitting report:', error);
    if (error.code === '23505') {
      throw new Error('You have already submitted a report for this target with the same reason.');
    }
    throw new Error(error.message || 'Failed to submit safety report.');
  }

  return data as UserReport;
}

/**
 * Adds a user to the blocker's block list.
 */
export async function blockUser(userId: string): Promise<BlockedRelationship> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to block a user.');

  const { data, error } = await supabase
    .from('blocked_users')
    .insert({
      blocker_id: user.id,
      blocked_id: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error blocking user:', error);
    if (error.code === '23505') {
      throw new Error('This user is already blocked.');
    }
    throw new Error(error.message || 'Failed to block user.');
  }

  return data as BlockedRelationship;
}

/**
 * Removes a user from the blocker's block list.
 */
export async function unblockUser(userId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to unblock a user.');

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', userId);

  if (error) {
    console.error('Error unblocking user:', error);
    throw new Error(error.message || 'Failed to unblock user.');
  }
}

/**
 * Retrieves the list of profiles blocked by the current authenticated user.
 */
export async function getBlockedUsers(): Promise<BlockedRelationship[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('blocked_users')
    .select('*, blocked:profiles!blocked_users_blocked_id_fkey(*)')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading blocked list:', error);
    throw new Error('Unable to load blocked users.');
  }

  return (data || []) as BlockedRelationship[];
}

/**
 * Retrieves report logs submitted by the current authenticated user.
 */
export async function getReportHistory(limit = 20, beforeTimestamp?: string): Promise<UserReport[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('reports')
    .select('*, reported_user:profiles!reports_reported_user_id_fkey(*), auction:auctions(title)')
    .eq('reporter_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (beforeTimestamp) {
    query = query.lt('created_at', beforeTimestamp);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading report history:', error);
    throw new Error('Unable to retrieve report history.');
  }

  return (data || []) as UserReport[];
}

/**
 * Invokes server-side account deletion and deactivation.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_user_account');
  if (error) {
    console.error('Error deleting account:', error);
    throw new Error(error.message || 'Failed to delete account.');
  }
}
