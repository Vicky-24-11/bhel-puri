import { supabase } from '@/lib/supabase';
import { activePaymentProvider } from '@/services/payment';

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

/**
 * Fetches reviews and ratings for admin moderation.
 */
export async function getAdminReviews(statusFilter = 'all') {
  let query = supabase
    .from('ratings')
    .select('*, reviewer:profiles!ratings_reviewer_id_fkey(username), reviewee:profiles!ratings_reviewee_id_fkey(username)');

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: ratings, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching admin reviews list:', error);
    return [];
  }

  if (!ratings || ratings.length === 0) {
    return [];
  }

  // Fetch auctions separately
  const auctionIds = Array.from(new Set(ratings.map((r) => r.auction_id).filter(Boolean)));
  let auctionsMap = new Map<string, any>();
  if (auctionIds.length > 0) {
    const { data: auctions } = await supabase
      .from('auctions')
      .select('id, title')
      .in('id', auctionIds);
    if (auctions) {
      auctionsMap = new Map(auctions.map((a) => [a.id, a]));
    }
  }

  return ratings.map((r) => ({
    ...r,
    auction: auctionsMap.get(r.auction_id) || null,
  }));
}

/**
 * Fetches a single review by ID with details.
 */
export async function getAdminReviewById(id: string) {
  const { data: review, error } = await supabase
    .from('ratings')
    .select('*, reviewer:profiles!ratings_reviewer_id_fkey(*), reviewee:profiles!ratings_reviewee_id_fkey(*)')
    .eq('id', id)
    .single();

  if (error || !review) {
    console.error('Error fetching admin review details:', error);
    return null;
  }

  // Fetch auction separately
  if (review.auction_id) {
    const { data: auction } = await supabase
      .from('auctions')
      .select('*')
      .eq('id', review.auction_id)
      .single();
    if (auction) {
      review.auction = auction;
    }
  }

  return review;
}

/**
 * Moderates a review by changing its status (published, hidden, removed).
 */
export async function moderateReview(
  id: string,
  newStatus: 'published' | 'hidden' | 'removed',
  reason: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('ratings')
    .update({ status: newStatus })
    .eq('id', id)
    .select('reviewer_id, reviewee_id, rating_value, auction_id')
    .single();

  if (error) {
    console.error('Error moderating review:', error);
    throw new Error(error.message || 'Failed to moderate review.');
  }

  // Write audit log
  await writeAuditLog(
    `REVIEW_MODERATED_${newStatus.toUpperCase()}`,
    'report',
    id,
    reason || `Set status to ${newStatus}`
  );

  // Send notification to the reviewer to alert them of moderation action
  try {
    let title = '📢 Review Update';
    let body = 'Your transaction review was reviewed by support.';
    if (newStatus === 'hidden' || newStatus === 'removed') {
      title = '⚠️ Review Moderated';
      body = 'Your submitted review was hidden/removed due to community guidelines violation.';
    }

    await supabase.from('notifications').insert({
      user_id: data.reviewer_id,
      type: 'new_message',
      title,
      body,
      auction_id: data.auction_id,
    });
  } catch (notifErr) {
    console.warn('Failed to insert review moderation notification:', notifErr);
  }

  return true;
}

/**
 * Fetches the active platform fee config
 */
export async function getPlatformFeeConfig() {
  const { data, error } = await supabase
    .from('platform_fee_config')
    .select('*')
    .eq('is_active', true)
    .order('effective_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching platform fee config:', error);
    return null;
  }
  return data;
}

/**
 * Fetches platform fee config history
 */
export async function getPlatformFeeConfigHistory() {
  const { data, error } = await supabase
    .from('platform_fee_config')
    .select('*, creator:profiles!created_by(username)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching platform fee config history:', error);
    return [];
  }
  return data || [];
}

/**
 * Creates and activates a new platform fee config (deactivating current one)
 */
export async function createPlatformFeeConfig(commissionRate: number) {
  // Deactivate existing active ones
  await supabase
    .from('platform_fee_config')
    .update({ is_active: false })
    .eq('is_active', true);

  const { data, error } = await supabase
    .from('platform_fee_config')
    .insert({
      commission_rate: commissionRate,
      is_active: true,
      created_by: (await supabase.auth.getUser()).data.user?.id
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating platform fee config:', error);
    throw new Error(error.message || 'Failed to update commission rate.');
  }
  return data;
}

/**
 * Fetches the active platform protection config
 */
export async function getPlatformProtectionConfig() {
  const { data, error } = await supabase
    .from('platform_protection_config')
    .select('*')
    .eq('is_active', true)
    .order('effective_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching platform protection config:', error);
    return null;
  }
  return data;
}

/**
 * Updates/Inserts new platform protection config
 */
export async function updatePlatformProtectionConfig(
  buyerProtectionPeriodDays: number,
  payoutRequiresBuyerConfirmation: boolean,
  payoutAutoAfterProtectionExpiry: boolean
) {
  // Deactivate existing active ones
  await supabase
    .from('platform_protection_config')
    .update({ is_active: false })
    .eq('is_active', true);

  const { data, error } = await supabase
    .from('platform_protection_config')
    .insert({
      buyer_protection_period_days: buyerProtectionPeriodDays,
      payout_requires_buyer_confirmation: payoutRequiresBuyerConfirmation,
      payout_auto_after_protection_expiry: payoutAutoAfterProtectionExpiry,
      is_active: true,
      created_by: (await supabase.auth.getUser()).data.user?.id
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating platform protection config:', error);
    throw new Error(error.message || 'Failed to update protection configuration.');
  }
  return data;
}

/**
 * Fetches financial audit logs
 */
export async function getFinancialAuditLogs() {
  const { data, error } = await supabase
    .from('financial_audit_logs')
    .select('*, actor:profiles!actor_id(username)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching financial audit logs:', error);
    return [];
  }
  return data || [];
}

/**
 * Fetches overview stats for payments dashboard
 */
export async function getFinancialStats() {
  const { data: payments, error } = await supabase
    .from('payments')
    .select('*, transaction:transactions(buyer_id, seller_id)');

  if (error || !payments) {
    console.error('Error fetching financial overview stats:', error);
    return null;
  }

  const stats = {
    grossVolume: 0,
    totalPaymentsCount: payments.length,
    successfulPaymentsCount: 0,
    pendingPaymentsCount: 0,
    failedPaymentsCount: 0,
    refundedAmount: 0,
    commissionRevenue: 0,
    providerCosts: 0,
    sellerPayouts: 0,
    pendingPayouts: 0,
    disputedAmount: 0,
  };

  payments.forEach((p: any) => {
    const amount = Number(p.amount) || 0;
    const commission = Number(p.commission_amount) || 0;
    const estCosts = Number(p.provider_costs_estimated) || 0;
    const actCosts = Number(p.provider_costs_actual) || 0;
    const payout = Number(p.seller_net_payout) || 0;

    if (p.status === 'captured' || p.status === 'held' || p.status === 'released') {
      stats.grossVolume += amount;
      stats.successfulPaymentsCount++;
      stats.commissionRevenue += commission;
      stats.providerCosts += actCosts || estCosts;
      
      if (p.status === 'released') {
        stats.sellerPayouts += payout;
      } else {
        stats.pendingPayouts += payout;
      }
    } else if (p.status === 'created' || p.status === 'processing') {
      stats.pendingPaymentsCount++;
    } else if (p.status === 'failed') {
      stats.failedPaymentsCount++;
    } else if (p.status === 'refunded') {
      stats.refundedAmount += amount;
    }
  });

  return stats;
}

/**
 * Fetches admin payments list
 */
export async function getAdminPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select('*, transaction:transactions(*, buyer:profiles!transactions_buyer_id_fkey(username), seller:profiles!transactions_seller_id_fkey(username))')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching admin payments list:', error);
    return [];
  }
  return data || [];
}

/**
 * Initiates a full or partial refund for a payment (Super Admin only)
 */
export async function adminRefundPayment(paymentId: string, amount: number, reason: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user || !user.user) throw new Error('Unauthenticated');

  const result = await activePaymentProvider.requestRefund(paymentId, amount);

  // Log to financial audit logs
  await supabase.from('financial_audit_logs').insert({
    actor_id: user.user.id,
    action: 'refund_processed',
    entity_type: 'refund',
    entity_id: result.refundId,
    new_value: result,
    reason: reason || 'Admin initiated refund'
  });

  return result;
}

/**
 * Releases held payout settlement to the seller's account (Super Admin only)
 */
export async function adminReleaseSettlement(paymentId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user || !user.user) throw new Error('Unauthenticated');

  const success = await activePaymentProvider.releaseSellerSettlement(paymentId);

  if (success) {
    // Log to financial audit logs
    await supabase.from('financial_audit_logs').insert({
      actor_id: user.user.id,
      action: 'payout_released',
      entity_type: 'transfer',
      entity_id: paymentId,
      new_value: { success: true },
      reason: 'Admin released payout settlement'
    });
  }

  return success;
}

/**
 * Fetches the active system payments configuration
 */
export async function getPaymentSystemConfig() {
  const { data, error } = await supabase
    .from('payment_system_config')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching payment system config:', error);
    return null;
  }
  return data;
}

/**
 * Updates system payments configuration (Super Admin only)
 */
export async function updatePaymentSystemConfig(
  productionPaymentsEnabled: boolean,
  paymentEnvironment: 'sandbox' | 'production',
  paymentsBlockedGlobally: boolean = false,
  payoutsBlockedGlobally: boolean = false,
  refundsBlockedGlobally: boolean = false
) {
  const { data: user } = await supabase.auth.getUser();
  if (!user || !user.user) throw new Error('Unauthenticated');

  // Deactivate old configs
  await supabase
    .from('payment_system_config')
    .update({ is_active: false })
    .eq('is_active', true);

  // Insert new active config
  const { data, error } = await supabase
    .from('payment_system_config')
    .insert({
      production_payments_enabled: productionPaymentsEnabled,
      payment_environment: paymentEnvironment,
      payments_blocked_globally: paymentsBlockedGlobally,
      payouts_blocked_globally: payoutsBlockedGlobally,
      refunds_blocked_globally: refundsBlockedGlobally,
      is_active: true,
      updated_by: user.user.id
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting system payment config:', error);
    throw error;
  }

  return data;
}

/**
 * Fetches all seller payment provider onboarding records (Super Admin only)
 */
export async function getSellerOnboardingProfiles() {
  const { data, error } = await supabase
    .from('payment_provider_accounts')
    .select('*, profile:profiles(username)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching seller onboarding records:', error);
    return [];
  }
  return data || [];
}

/**
 * Updates a seller's onboarding details (Super Admin only)
 */
export async function updateSellerOnboardingStatus(
  accountId: string,
  kycStatus: 'pending' | 'submitted' | 'verified' | 'rejected',
  payoutEnabled: boolean,
  onboardingStatus: 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'suspended',
  failureReason?: string
) {
  const { data: user } = await supabase.auth.getUser();
  if (!user || !user.user) throw new Error('Unauthenticated');

  const { data, error } = await supabase
    .from('payment_provider_accounts')
    .update({
      kyc_status: kycStatus,
      payout_enabled: payoutEnabled,
      onboarding_status: onboardingStatus,
      failure_reason: failureReason || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', accountId)
    .select()
    .single();

  if (error) {
    console.error('Error updating seller onboarding details:', error);
    throw error;
  }

  // Log in financial audit logs
  await supabase.from('financial_audit_logs').insert({
    actor_id: user.user.id,
    action: 'vendor_onboarding_updated',
    entity_type: 'audit',
    entity_id: accountId,
    new_value: data,
    reason: `Onboarding status manually updated to ${onboardingStatus}`
  });

  return data;
}

/**
 * Fetches all financial reconciliation issues (Super Admin only)
 */
export async function getFinancialReconciliationIssues() {
  const { data, error } = await supabase
    .from('financial_reconciliation_issues')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching reconciliation issues:', error);
    return [];
  }
  return data || [];
}

/**
 * Updates a financial reconciliation issue's status (Super Admin only)
 */
export async function updateReconciliationIssueStatus(
  issueId: string,
  newStatus: 'open' | 'under_review' | 'resolved' | 'ignored',
  note?: string
) {
  const { data: user } = await supabase.auth.getUser();
  if (!user || !user.user) throw new Error('Unauthenticated');

  const { data, error } = await supabase
    .from('financial_reconciliation_issues')
    .update({
      resolution_status: newStatus,
      resolved_by: user.user.id,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', issueId)
    .select()
    .single();

  if (error) {
    console.error('Error updating reconciliation issue status:', error);
    throw error;
  }

  // Log in financial audit logs
  await supabase.from('financial_audit_logs').insert({
    actor_id: user.user.id,
    action: 'reconciliation_issue_resolved',
    entity_type: 'reconciliation',
    entity_id: issueId,
    new_value: { status: newStatus, note },
    reason: `Reconciliation issue status manually changed to ${newStatus}`
  });

  return data;
}
