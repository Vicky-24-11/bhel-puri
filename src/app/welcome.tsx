import React, { useState } from 'react';
import { View, Text, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Mail } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { signInWithGoogle } from '@/services/authService';
import { useAuth } from '@/lib/AuthContext';

export default function WelcomeScreen() {
  const { setAuthState } = useAuth();
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);
    setAuthState('AUTHENTICATING');
    try {
      await signInWithGoogle();
    } catch (error: any) {
      // Revert state if login fails or is cancelled
      setAuthState('SIGNED_OUT');
      setLoadingGoogle(false);
      
      // Do not alert if user cancelled OAuth session
      if (error.message.includes('cancelled')) {
        return;
      }
      
      if (Platform.OS === 'web') {
        window.alert(`Google Sign-In Error: ${error.message}`);
      } else {
        Alert.alert('Google Sign-In Failed', error.message);
      }
    }
  };

  const handleEmailSignIn = () => {
    router.push('/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      <View className="flex-1 px-6 justify-between py-12 max-w-lg mx-auto w-full">
        {/* Top Space / Spacing */}
        <View />

        {/* Branding Title Section */}
        <View className="items-center">
          {/* Logo Badge Icon */}
          <View 
            style={{ backgroundColor: 'rgba(255, 107, 53, 0.1)' }}
            className="w-20 h-20 rounded-3xl items-center justify-center mb-6 border border-brand-primary/20"
          >
            <Text className="text-4xl">⚡</Text>
          </View>
          
          <Text className="text-5xl font-display font-extrabold text-brand-primary tracking-tight">
            Bhel Puri
          </Text>
          <Text className="text-sm font-display font-bold text-brand-muted uppercase tracking-widest mt-1">
            The Auction App
          </Text>
          
          <Text className="text-center font-display text-base text-brand-muted mt-6 px-4 leading-relaxed">
            Buy, sell, and win through quick live auctions.
          </Text>
        </View>

        {/* Buttons / Actions Block */}
        <View className="gap-3">
          {loadingGoogle ? (
            <View className="h-12 items-center justify-center bg-stone-100 rounded-xl">
              <ActivityIndicator color="#FF6B35" />
            </View>
          ) : (
            <Button
              label="Continue with Google"
              onPress={handleGoogleSignIn}
              variant="outline"
              className="border-stone-300 active:bg-stone-50"
              icon={
                <Text className="text-base mr-2">🔑</Text>
              }
            />
          )}

          <Button
            label="Continue with Email"
            onPress={handleEmailSignIn}
            icon={<Mail size={18} color="#FFFFFF" className="mr-2" />}
          />
          
          <Text className="text-center text-[10px] font-display text-brand-muted leading-relaxed mt-4 px-6">
            By continuing, you agree to our Terms of Service and Privacy Policy. Passwordless login ensures your credentials remain secure.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
