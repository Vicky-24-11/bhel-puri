import { supabase } from '@/lib/supabase';

export interface AdminUser {
  id: string;
  user_id: string;
  role: 'super_admin' | 'moderator' | 'support';
  is_active: boolean;
  created_at: string;
  profile?: any;
}

export interface AuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  metadata: any;
  created_at: string;
  admin_profile?: any;
}

/**
 * Checks if a user is an active administrator and returns their role.
 */
export async function getAdminRole(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching admin role:', error);
    return null;
  }
  return data?.role || null;
}

/**
 * Logs an administrative action to the audit logs.
 */
export async function writeAuditLog(
  action: string,
  targetType: 'user' | 'product' | 'report' | 'admin',
  targetId: string,
  reason: string,
  metadata?: any
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('admin_audit_logs')
    .insert({
      admin_user_id: user.id,
      action,
      target_type: targetType,
      target_id: targetId,
      reason: reason || 'No reason provided',
      metadata: metadata || null,
    });

  if (error) {
    console.error('Failed to write admin audit log:', error);
  }
}

/**
 * Fetches basic statistics of the marketplace.
 */
export async function getMarketplaceStats() {
  const [
    { count: totalUsers },
    { count: activeListings },
    { count: liveAuctions },
    { count: completedAuctions },
    { count: openReports },
    { count: suspendedUsers }
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('moderation_status', 'active'),
    supabase.from('auctions').select('id', { count: 'exact', head: true }).eq('status', 'live'),
    supabase.from('auctions').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('account_status', 'suspended')
  ]);

  return {
    totalUsers: totalUsers || 0,
    activeListings: activeListings || 0,
    liveAuctions: liveAuctions || 0,
    completedAuctions: completedAuctions || 0,
    openReports: openReports || 0,
    suspendedUsers: suspendedUsers || 0,
  };
}

/**
 * Gets a paginated list of users.
 */
export async function getAdminUsersList(
  search = '',
  statusFilter = 'all',
  limit = 20,
  offset = 0
) {
  let query = supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, account_status, rating, total_ratings, created_at', { count: 'exact' });

  if (search) {
    query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  if (statusFilter !== 'all') {
    query = query.eq('account_status', statusFilter);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching admin users list:', error);
    return { data: [], count: 0 };
  }

  return { data: data || [], count: count || 0 };
}

/**
 * Updates a user's account status (suspend/restore).
 */
export async function updateUserStatus(
  userId: string,
  status: 'active' | 'suspended',
  reason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ account_status: status })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user status:', error);
    throw new Error(error.message || 'Failed to update user status.');
  }

  // Create an audit log record
  const action = status === 'suspended' ? 'USER_SUSPENDED' : 'USER_RESTORED';
  await writeAuditLog(action, 'user', userId, reason);

  // Queue a notification log
  try {
    const title = status === 'suspended' ? '⚠️ Account Suspended' : '✅ Account Restored';
    const body = status === 'suspended'
      ? 'Your account has been suspended due to marketplace policy violations.'
      : 'Your account access has been fully restored.';

    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'auction_ended',
      title,
      body,
    });
  } catch (notifErr) {
    console.warn('Failed to insert user status change notification:', notifErr);
  }

  return true;
}

/**
 * Gets a paginated list of product listings.
 */
export async function getAdminListings(
  search = '',
  statusFilter = 'all',
  limit = 20,
  offset = 0
) {
  let query = supabase
    .from('products')
    .select('*, seller:profiles(username, full_name)', { count: 'exact' });

  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  if (statusFilter !== 'all') {
    query = query.eq('moderation_status', statusFilter);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error loading admin listings:', error);
    return { data: [], count: 0 };
  }

  return { data: data || [], count: count || 0 };
}

/**
 * Updates a listing's moderation status (remove/restore).
 */
export async function updateListingStatus(
  productId: string,
  status: 'active' | 'removed',
  reason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('products')
    .update({ moderation_status: status })
    .eq('id', productId);

  if (error) {
    console.error('Error updating listing status:', error);
    throw new Error(error.message || 'Failed to update listing.');
  }

  const action = status === 'removed' ? 'LISTING_REMOVED' : 'LISTING_RESTORED';
  await writeAuditLog(action, 'product', productId, reason);

  // Notify seller of listing removal/restoration
  try {
    const productData = await supabase.from('products').select('title, seller_id').eq('id', productId).single();
    if (productData.data) {
      const title = status === 'removed' ? '🚫 Listing Removed' : '✅ Listing Restored';
      const body = status === 'removed'
        ? `Your listing "${productData.data.title}" was removed for violating safety guidelines.`
        : `Your listing "${productData.data.title}" has been restored.`;

      await supabase.from('notifications').insert({
        user_id: productData.data.seller_id,
        type: 'auction_ended',
        title,
        body,
        auction_id: productId,
      });
    }
  } catch (notifErr) {
    console.warn('Failed to insert listing status notification:', notifErr);
  }

  return true;
}

/**
 * Gets a paginated list of reports.
 */
export async function getAdminReports(
  statusFilter = 'all',
  limit = 20,
  offset = 0
) {
  let query = supabase
    .from('reports')
    .select('*, reporter:profiles!reports_reporter_id_fkey(username), reported_user:profiles!reports_reported_user_id_fkey(username), auction:auctions(title)', { count: 'exact' });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching admin reports:', error);
    return { data: [], count: 0 };
  }

  return { data: data || [], count: count || 0 };
}

/**
 * Updates a report's status (reviewing/resolved/dismissed).
 */
export async function updateReportStatus(
  reportId: string,
  status: 'reviewing' | 'resolved' | 'dismissed',
  note: string
): Promise<boolean> {
  const { error } = await supabase
    .from('reports')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  if (error) {
    console.error('Error resolving report:', error);
    throw new Error(error.message || 'Failed to update report status.');
  }

  const action = status === 'reviewing'
    ? 'REPORT_REVIEWED'
    : status === 'resolved'
    ? 'REPORT_RESOLVED'
    : 'REPORT_DISMISSED';

  await writeAuditLog(action, 'report', reportId, note);

  return true;
}

/**
 * Gets a paginated list of auctions.
 */
export async function getAdminAuctions(
  typeFilter = 'all',
  statusFilter = 'all',
  limit = 20,
  offset = 0
) {
  let query = supabase
    .from('auctions')
    .select('*, seller:profiles!auctions_seller_id_fkey(username, full_name), winner:profiles!auctions_winner_id_fkey(username)', { count: 'exact' });

  if (typeFilter !== 'all') {
    query = query.eq('auction_type', typeFilter);
  }

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error loading admin auctions:', error);
    return { data: [], count: 0 };
  }

  return { data: data || [], count: count || 0 };
}

/**
 * Gets a paginated list of transactions.
 */
export async function getAdminTransactions(
  statusFilter = 'all',
  limit = 20,
  offset = 0
) {
  let query = supabase
    .from('transactions')
    .select('*, seller:profiles!transactions_seller_id_fkey(username), buyer:profiles!transactions_buyer_id_fkey(username), auction:auctions(title)', { count: 'exact' });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error loading admin transactions:', error);
    return { data: [], count: 0 };
  }

  return { data: data || [], count: count || 0 };
}

/**
 * Gets a paginated list of audit logs.
 */
export async function getAdminAuditLogsList(
  limit = 25,
  offset = 0
) {
  const { data, count, error } = await supabase
    .from('admin_audit_logs')
    .select('*, admin_profile:profiles!admin_audit_logs_admin_user_id_fkey(username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching admin audit logs:', error);
    return { data: [], count: 0 };
  }

  return { data: (data || []) as AuditLog[], count: count || 0 };
}

/**
 * Gets a list of administrators (super_admin, moderator, support).
 */
export async function getAdminsList(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*, profile:profiles(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading admins list:', error);
    return [];
  }
  return (data || []) as AdminUser[];
}

/**
 * Promotes an existing profile user to an admin role.
 */
export async function promoteToAdmin(
  username: string,
  role: 'moderator' | 'support'
): Promise<boolean> {
  // Find user profile by username
  const { data: profile, error: searchErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single();

  if (searchErr || !profile) {
    throw new Error('User profile not found with that username.');
  }

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('admin_users')
    .upsert({
      user_id: profile.id,
      role,
      is_active: true,
      created_by: user?.id || null,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error adding admin:', error);
    throw new Error('Failed to promote user to admin role.');
  }

  await writeAuditLog('ADMIN_CREATED', 'admin', profile.id, `Promoted to ${role}`);

  return true;
}

/**
 * Deactivates an admin user.
 */
export async function deactivateAdminUser(
  adminId: string,
  userId: string
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  // Prevent self-deactivation
  if (user?.id === userId) {
    throw new Error('You cannot deactivate your own administrative access.');
  }

  // Count active super admins to prevent locked access
  const admins = await getAdminsList();
  const activeSuperAdmins = admins.filter(a => a.role === 'super_admin' && a.is_active);
  const targetAdmin = admins.find(a => a.id === adminId);

  if (targetAdmin?.role === 'super_admin' && activeSuperAdmins.length <= 1) {
    throw new Error('Deactivation refused. There must be at least one active super_admin.');
  }

  const { error } = await supabase
    .from('admin_users')
    .update({ is_active: false })
    .eq('id', adminId);

  if (error) {
    console.error('Error deactivating admin:', error);
    throw new Error('Failed to deactivate admin.');
  }

  await writeAuditLog('ADMIN_DEACTIVATED', 'admin', userId, 'Deactivated admin privileges');

  return true;
}
