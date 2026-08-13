import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { logError } from '@/services/errorMonitoringService';

// Configure foreground push behavior (conforming to native conventions)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests push permission, yields Expo Push Token, and uploads it to Supabase.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Safe exit on Web (since Web uses native browser push instead of Expo push tokens)
  if (Platform.OS === 'web') {
    return null;
  }

  // Ensure it's a physical device, as simulators don't receive push notifications
  if (!Device.isDevice) {
    console.log('Push Monitor: Simulator detected. Push token skipped.');
    return null;
  }

  try {
    interface PermissionResponseLike {
      granted: boolean;
    }
    
    const permissions = (await Notifications.getPermissionsAsync()) as unknown as PermissionResponseLike;
    let isGranted = permissions.granted;

    if (!isGranted) {
      const request = (await Notifications.requestPermissionsAsync()) as unknown as PermissionResponseLike;
      isGranted = request.granted;
    }

    if (!isGranted) {
      console.log('Push Monitor: Notification permissions denied.');
      return null;
    }

    // Resolve Expo projectId
    const projectId = 
      Constants.expoConfig?.extra?.eas?.projectId ?? 
      Constants.easConfig?.projectId;

    if (!projectId) {
      throw new Error('Project ID not found in app.json configuration.');
    }

    // Fetch Expo token
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Upsert token in Database registry
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert(
          {
            user_id: user.id,
            expo_push_token: token,
            platform: Platform.OS,
            device_name: Device.modelName || 'Unknown Device',
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,expo_push_token' }
        );

      if (error) throw error;
      console.log('Push Monitor: Registered token successfully.');
    }

    return token;
  } catch (err: any) {
    logError(err, { action: 'registerForPushNotifications' });
    return null;
  }
}

/**
 * Removes active Expo Push Token mapping on profile logout.
 */
export async function unregisterForPushNotificationsAsync(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;

  try {
    const projectId = 
      Constants.expoConfig?.extra?.eas?.projectId ?? 
      Constants.easConfig?.projectId;
    if (!projectId) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('user_push_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('expo_push_token', token);

      if (error) throw error;
      console.log('Push Monitor: Unregistered token successfully.');
    }
  } catch (err: any) {
    logError(err, { action: 'unregisterForPushNotifications' });
  }
}

/**
 * Handles the user tapping on a push notification to open the correct route.
 */
export function handleNotificationTap(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data;
  if (!data) return;

  const { type, auction_id, conversation_id } = data;

  try {
    if (type === 'new_message' && conversation_id) {
      router.push(`/chat/${conversation_id}`);
    } else if ((type === 'auction_won' || type === 'outbid' || type === 'auction_started') && auction_id) {
      router.push(`/auction/${auction_id}`);
    } else if (type === 'auction_ended' && auction_id) {
      router.push(`/auction/${auction_id}`);
    }
  } catch (err: any) {
    logError(err, { action: 'handleNotificationTap', data });
  }
}
