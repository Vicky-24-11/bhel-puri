import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Ensure the WebBrowser callback is set up correctly (essential for Web fallback)
if (Platform.OS === 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

/**
 * Extracts session tokens from a redirect callback URL (hash or query parameters).
 */
const extractTokens = (url: string) => {
  const cleanUrl = decodeURIComponent(url);
  const getParam = (name: string) => {
    // Look for parameter in both query ? and hash #
    const regex = new RegExp(`[#?&]${name}=([^&]*)`);
    const match = cleanUrl.match(regex);
    return match ? match[1] : '';
  };

  return {
    accessToken: getParam('access_token'),
    refreshToken: getParam('refresh_token'),
  };
};

/**
 * Sends a passwordless one-time verification passcode (OTP) to the specified email address.
 */
export async function sendEmailOtp(email: string) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
  });

  if (error) {
    // Map rate-limits and other errors to user-friendly messages
    if (error.status === 429) {
      throw new Error('Too many verification requests. Please wait a moment and try again.');
    }
    throw error;
  }
  return data;
}

/**
 * Verifies the 6-digit email verification code (OTP) and signs the user in.
 */
export async function verifyEmailOtp(email: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    if (error.message.toLowerCase().includes('expired')) {
      throw new Error('Your code has expired. Please request a new one.');
    }
    if (error.message.toLowerCase().includes('invalid') || error.status === 401) {
      throw new Error("That code doesn't look right. Please double check and try again.");
    }
    throw error;
  }
  return data;
}

/**
 * Executes a Google OAuth login sequence. Opens a web authentication sheet on mobile,
 * or redirects the window on web.
 */
export async function signInWithGoogle() {
  const redirectUrl = Platform.OS === 'web'
    ? Linking.createURL('auth-callback')
    : 'bhelpuri://auth/callback';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true, // Do not redirect app automatically on native; let WebBrowser load sheet
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('No OAuth redirection URL received from authentication server.');

  if (Platform.OS === 'web') {
    window.location.href = data.url;
    return;
  }

  // Native iOS/Android: Open inside a secure in-app Safari / Chrome browser sheet
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

  if (result.type === 'success' && result.url) {
    // Extract tokens from redirect URL hash/query params using our custom helper
    const { accessToken, refreshToken } = extractTokens(result.url);

    if (accessToken && refreshToken) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
    } else {
      throw new Error('Successfully authenticated with Google, but failed to retrieve session credentials.');
    }
  } else if (result.type === 'cancel') {
    throw new Error('Google sign-in cancelled by user.');
  } else {
    throw new Error('Failed to establish a Google authentication connection.');
  }
}

/**
 * Signs the current user out, clearing both native SecureStore and server session states.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Gets the current active session.
 */
export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Gets the current authenticated user object.
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Listens for updates in the authentication session.
 */
export function onAuthStateChange(callback: (event: any, session: any) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return subscription;
}
