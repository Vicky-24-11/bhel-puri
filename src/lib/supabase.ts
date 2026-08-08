import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const CHUNK_SIZE = 2000;

// Custom storage adapter for Supabase to store sessions securely using Expo SecureStore on Native platforms.
// Automatically splits session strings larger than 2000 bytes into chunks to bypass native iOS/Android size limits.
const ChunkedSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      const chunksCountStr = await SecureStore.getItemAsync(`${key}_chunks`);
      if (!chunksCountStr) {
        return await SecureStore.getItemAsync(key);
      }

      const chunksCount = parseInt(chunksCountStr, 10);
      let value = '';
      for (let i = 0; i < chunksCount; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (!chunk) return null;
        value += chunk;
      }
      return value;
    } catch (err) {
      console.error('SecureStore getItem error:', err);
      return null;
    }
  },

  setItem: async (key: string, value: string) => {
    try {
      const size = value.length;
      if (size <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
        return;
      }

      const chunksCount = Math.ceil(size / CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}_chunks`, String(chunksCount));

      for (let i = 0; i < chunksCount; i++) {
        const chunk = value.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
      }
      // Remove base key if it was previously set without chunks
      await SecureStore.deleteItemAsync(key).catch(() => {});
    } catch (err) {
      console.error('SecureStore setItem error:', err);
    }
  },

  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key).catch(() => {});
      const chunksCountStr = await SecureStore.getItemAsync(`${key}_chunks`).catch(() => null);
      if (chunksCountStr) {
        const chunksCount = parseInt(chunksCountStr, 10);
        for (let i = 0; i < chunksCount; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
      }
    } catch (err) {
      console.error('SecureStore removeItem error:', err);
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key';

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    'Supabase configuration missing: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not defined in your environment variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: Platform.OS !== 'web' ? ChunkedSecureStoreAdapter : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web', // enable URL session detection on web for OAuth redirect
  },
});
