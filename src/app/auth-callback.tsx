import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { LoadingState } from '../components/ui/LoadingState';

export default function AuthCallbackScreen() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (typeof window !== 'undefined') {
          // Parse access and refresh tokens from hash redirect parameters
          const hash = window.location.hash;
          const search = window.location.search;
          
          let accessToken = '';
          let refreshToken = '';

          if (hash) {
            const params = new URLSearchParams(hash.replace('#', '?'));
            accessToken = params.get('access_token') || '';
            refreshToken = params.get('refresh_token') || '';
          } else if (search) {
            const params = new URLSearchParams(search);
            accessToken = params.get('access_token') || '';
            refreshToken = params.get('refresh_token') || '';
          }

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          }
        }
        
        // Redirect back to root index, where root layouts will direct to Setup / Tabs
        router.replace('/');
      } catch (err) {
        console.error('Error handling auth callback:', err);
        router.replace('/welcome');
      }
    };

    handleCallback();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFBF7' }}>
      <LoadingState variant="spinner" />
      <Text style={{ fontFamily: 'System', fontSize: 14, color: '#7F8C8D', marginTop: 12 }}>
        Restoring session...
      </Text>
    </View>
  );
}
