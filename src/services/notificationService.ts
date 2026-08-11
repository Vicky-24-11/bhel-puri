import { supabase } from '@/lib/supabase';
import { Notification } from '@/types/database.types';

/**
 * Retrieves notifications for the authenticated user, joined with the corresponding auction details,
 * and orders them chronologically (newest first).
 */
export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, auction:auctions(*, images:auction_images(*)), conversation:conversations(*, auction:auctions(*, images:auction_images(*)))')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
    throw new Error('Unable to retrieve notifications.');
  }

  // Pre-map images for display convenience in notifications
  return (data || []).map((item: any) => {
    let targetAuction = item.auction;
    if (!targetAuction && item.conversation && item.conversation.auction) {
      targetAuction = item.conversation.auction;
    }

    if (targetAuction && targetAuction.images && targetAuction.images.length > 0) {
      const sortedImgs = [...targetAuction.images].sort((a, b) => a.display_order - b.display_order);
      targetAuction.primary_image_url = sortedImgs[0].storage_path;
    }

    return item as Notification;
  });
}

/**
 * Marks a specific notification as read by calling the secure definer RPC function.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });

  if (error) {
    console.error('Error marking notification read:', error);
    throw new Error('Failed to update notification status.');
  }
}

/**
 * Marks all notifications for the current authenticated user as read by calling the secure definer RPC.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read');

  if (error) {
    console.error('Error marking all notifications read:', error);
    throw new Error('Failed to clear notifications.');
  }
}

/**
 * Returns the exact count of unread notifications for the user.
 */
export async function getUnreadNotificationsCount(currentUserId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', currentUserId)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread notification count:', error);
    return 0;
  }

  return count || 0;
}
