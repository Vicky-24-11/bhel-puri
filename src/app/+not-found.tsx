import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCircle, ArrowRight, Home } from 'lucide-react-native';
import { router, Stack } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <SafeAreaView className="flex-1 bg-brand-background justify-center items-center p-6">
      <Stack.Screen options={{ title: 'Page Not Found', headerShown: false }} />
      
      <View className="w-full max-w-sm bg-white border border-stone-200 rounded-3xl p-6 shadow-sm items-center gap-5">
        <View 
          style={{ backgroundColor: 'rgba(255, 107, 53, 0.08)' }}
          className="w-14 h-14 rounded-full items-center justify-center"
        >
          <AlertCircle size={28} color="#FF6B35" />
        </View>

        <View className="items-center gap-1.5">
          <Text className="font-display font-extrabold text-brand-text text-base text-center">
            {"Oops! Page doesn't exist"}
          </Text>
          <Text className="text-xs font-display text-brand-muted text-center leading-relaxed">
            {"The page or auction you are looking for has either expired, been deleted, or the link is incorrect."}
          </Text>
        </View>

        <View className="w-full gap-2.5 mt-2">
          <Pressable
            onPress={() => router.replace('/(tabs)/explore' as any)}
            className="w-full h-11 bg-brand-primary active:bg-brand-primary/95 rounded-2xl items-center justify-center flex-row gap-2"
          >
            <Home size={14} color="#FFFFFF" />
            <Text className="text-xs font-display font-bold text-white">
              Go Home
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(tabs)/explore' as any)}
            style={{ borderColor: 'rgba(255, 107, 53, 0.25)' }}
            className="w-full h-11 border rounded-2xl items-center justify-center flex-row gap-2 active:bg-stone-50"
          >
            <Text className="text-xs font-display font-bold text-brand-primary">
              Browse Live Auctions
            </Text>
            <ArrowRight size={14} color="#FF6B35" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
