import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Mail, ArrowRight } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { sendEmailOtp } from '@/services/authService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const validateEmail = (input: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input.trim());
  };

  const handleSendOtp = async () => {
    setErrorMsg('');
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail) {
      setErrorMsg('Email address is required.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await sendEmailOtp(trimmedEmail);
      
      // Navigate to OTP verification screen with email parameter
      router.push({
        pathname: '/verify',
        params: { email: trimmedEmail }
      });
    } catch (error: any) {
      console.error('OTP send failed:', error);
      setErrorMsg(error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      <View className="flex-1 px-6 py-8 justify-between max-w-lg mx-auto w-full">
        {/* Header Block / Back Button */}
        <View className="gap-6 mt-4">
          <View>
            <Text className="text-3xl font-display font-extrabold text-brand-text tracking-tight">
              {"What's your email?"}
            </Text>
            <Text className="text-sm font-display text-brand-muted mt-2">
              {"We'll send you a one-time verification code."}
            </Text>
          </View>

          {/* Input Form container */}
          <View className="gap-2">
            <Input
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              autoFocus
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMsg) setErrorMsg('');
              }}
              leftIcon={<Mail size={18} color="#7F8C8D" />}
              error={errorMsg || undefined}
            />
          </View>
        </View>

        {/* Action Button Container */}
        <View>
          <Button
            label="Continue"
            onPress={handleSendOtp}
            loading={loading}
            icon={<ArrowRight size={18} color="#FFFFFF" className="ml-2" />}
            iconPosition="right"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
