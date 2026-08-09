import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { LoadingState } from '../components/ui/LoadingState';

export default function Index() {
  const { authState } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authState === 'INITIALIZING') return;

    if (authState === 'SIGNED_OUT') {
      router.replace('/welcome');
    } else if (authState === 'PROFILE_INCOMPLETE') {
      router.replace('/profile-setup');
    } else if (authState === 'PROFILE_COMPLETE' || authState === 'SIGNED_IN') {
      router.replace('/(tabs)');
    }
  }, [authState, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFBF7' }}>
      <LoadingState variant="spinner" />
      <Text style={{ fontFamily: 'System', fontSize: 14, color: '#7F8C8D', marginTop: 12 }}>
        Connecting to Bhel Puri...
      </Text>
    </View>
  );
}
