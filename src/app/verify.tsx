import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { verifyEmailOtp, sendEmailOtp } from '@/services/authService';

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60); // 60-second countdown
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(true);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Start cooldown timer on mount
    if (cooldown === 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleVerify = useCallback(async (otpCode: string) => {
    if (otpCode.length !== 6 || loading) return;
    
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await verifyEmailOtp(email, otpCode);
    } catch (error: any) {
      console.error('Verification failed:', error);
      setErrorMsg(error.message || 'Verification failed. Please try again.');
      setCode(''); // Reset code on error so they can re-enter
    } finally {
      setLoading(false);
    }
  }, [email, loading]);

  // Automatically submit once 6 digits are entered
  useEffect(() => {
    if (code.length === 6) {
      handleVerify(code);
    }
  }, [code, handleVerify]);

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    
    setErrorMsg('');
    setSuccessMsg('');
    setCooldown(60); // Reset timer to 60s
    
    try {
      await sendEmailOtp(email);
      setSuccessMsg('A new 6-digit code has been sent to your email.');
    } catch (error: any) {
      setErrorMsg(error.message || 'Failed to resend code. Please try again.');
    }
  };

  const renderCodeBoxes = () => {
    const boxes = [];
    for (let i = 0; i < 6; i++) {
      const char = code[i] || '';
      const isFocused = i === code.length && isInputFocused;
      
      boxes.push(
        <View
          key={i}
          className={`w-12 h-14 border-2 rounded-xl items-center justify-center bg-white ${
            isFocused ? 'border-brand-primary' : char ? 'border-brand-text' : 'border-stone-200'
          }`}
        >
          <Text className="text-xl font-display font-extrabold text-brand-text">
            {char || '·'}
          </Text>
        </View>
      );
    }
    return boxes;
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      <View className="flex-1 px-6 py-8 justify-between max-w-lg mx-auto w-full">
        <View className="gap-6 mt-4">
          <View>
            <Text className="text-3xl font-display font-extrabold text-brand-text tracking-tight">
              Verify your email
            </Text>
            <Text className="text-sm font-display text-brand-muted mt-2">
              We sent a 6-digit code to
            </Text>
            <Text className="text-sm font-display font-bold text-brand-text mt-0.5">
              {email}
            </Text>
          </View>

          {/* Custom Code Input Boxes */}
          <Pressable 
            onPress={() => inputRef.current?.focus()}
            className="flex-row justify-between py-4"
          >
            {renderCodeBoxes()}
          </Pressable>

          {/* Hidden absolute textinput to capture keys */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(text) => {
              const cleanText = text.replace(/[^0-9]/g, '').slice(0, 6);
              setCode(cleanText);
              // Clear error state when user edits OTP
              if (errorMsg) setErrorMsg('');
            }}
            keyboardType="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              opacity: 0,
            }}
          />

          {/* Status Indicators */}
          <View className="min-h-[20px]">
            {loading && (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#FF6B35" />
                <Text className="text-xs font-display text-brand-primary font-medium">
                  Verifying code...
                </Text>
              </View>
            )}
            {errorMsg ? (
              <Text className="text-xs font-display text-brand-error font-medium">
                {errorMsg}
              </Text>
            ) : null}
            {successMsg ? (
              <Text className="text-xs font-display text-brand-success font-medium">
                {successMsg}
              </Text>
            ) : null}
          </View>

          {/* Verify Button */}
          <Button
            label="Verify Code"
            disabled={code.length !== 6 || loading}
            loading={loading}
            onPress={() => handleVerify(code)}
            className="mt-2"
          />
        </View>

        {/* Change Email & Resend Cooldown Actions */}
        <View className="items-center gap-4">
          <Pressable
            onPress={() => router.back()}
            className="py-1 active:opacity-70"
          >
            <Text className="text-xs font-display text-brand-primary font-bold">
              Change email
            </Text>
          </Pressable>

          {cooldown > 0 ? (
            <Text className="text-xs font-display text-brand-muted font-medium">
              Resend code in {cooldown}s
            </Text>
          ) : (
            <Pressable
              onPress={handleResend}
              className="flex-row items-center gap-1.5 py-1 active:opacity-70"
            >
              <RefreshCw size={14} color="#FF6B35" />
              <Text className="text-xs font-display text-brand-primary font-bold">
                Resend code
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
