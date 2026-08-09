import { useEffect, useState } from 'react';
import { useColorScheme, View, Text } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useSegments, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { LoadingState } from '../components/ui/LoadingState';

import '../global.css';

// Prevent the splash screen from auto-hiding before assets load.
SplashScreen.preventAutoHideAsync().catch(() => {});

let isSplashHidden = false;

export default function RootLayout() {
  return (
    <AuthProvider>
      <InnerLayout />
    </AuthProvider>
  );
}

function InnerLayout() {
  const colorScheme = useColorScheme();
  const { authState } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Hide splash screen when session restoration status completes
    if (authState !== 'INITIALIZING' && !isSplashHidden) {
      isSplashHidden = true;
      SplashScreen.hideAsync().catch((err) => {
        console.log('SplashScreen.hideAsync warning:', err.message);
      });
    }
  }, [authState]);

  useEffect(() => {
    if (authState === 'INITIALIZING') return;
    if (segments.length === 0) return;

    const firstSegment = segments[0] as string;
    const inAuthGroup = 
      firstSegment === 'welcome' || 
      firstSegment === 'login' || 
      firstSegment === 'verify' || 
      firstSegment === 'auth-callback';
      
    const inProfileSetup = firstSegment === 'profile-setup';

    if (authState === 'SIGNED_OUT' && !inAuthGroup) {
      // Redirect unsigned users to welcome screen
      router.replace('/welcome');
    } else if (authState === 'PROFILE_INCOMPLETE' && !inProfileSetup) {
      // Redirect authenticated users with incomplete profiles to setup screen
      router.replace('/profile-setup');
    } else if (
      (authState === 'PROFILE_COMPLETE' || authState === 'SIGNED_IN') && 
      (inAuthGroup || inProfileSetup)
    ) {
      // Redirect successfully authenticated and completed profiles to marketplace
      router.replace('/(tabs)');
    }
  }, [authState, segments, router]);

  if (authState === 'INITIALIZING' || !mounted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDFBF7' }}>
        <LoadingState variant="spinner" />
        <Text style={{ fontFamily: 'System', fontSize: 14, color: '#7F8C8D', marginTop: 12 }}>
          Initializing Bhel Puri...
        </Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="verify" options={{ headerShown: false }} />
        <Stack.Screen name="profile-setup" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen 
          name="auction/[id]" 
          options={{ 
            headerShown: false, 
            title: 'Auction Details',
            headerStyle: { backgroundColor: '#FDFBF7' },
            headerTintColor: '#FF6B35',
            headerTitleStyle: { fontWeight: 'bold' }
          }} 
        />
      </Stack>
    </ThemeProvider>
  );
}
