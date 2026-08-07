import React from 'react';
import { View, Text, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, ShieldCheck, Star, Settings, Gavel, LogOut, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';

export default function ProfileScreen() {
  const user = {
    name: 'Vikas Pandey',
    email: 'vikas@bhelpuri.app',
    rating: 4.9,
    dealsCount: 12,
    auctionsWon: 3,
    auctionsCreated: 7,
    isVerified: true,
  };

  const handleMenuPress = (label: string) => {
    const msg = `This launches the "${label}" interface, synchronized via Supabase in production.`;
    if (Platform.OS === 'web') {
      window.alert(`Bhel Puri: ${msg}`);
    } else {
      Alert.alert('Bhel Puri', msg);
    }
  };

  const handleLogout = () => {
    const action = () => {
      const resetMsg = 'Session cleared. In production, this redirects to the Auth/Welcome screen.';
      if (Platform.OS === 'web') {
        window.alert(`Bhel Puri: ${resetMsg}`);
      } else {
        Alert.alert('Logged Out', resetMsg);
      }
      // Redirect to home tab
      router.replace('/(tabs)');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        action();
      }
    } else {
      Alert.alert(
        'Confirm Log Out',
        'Are you sure you want to log out of Bhel Puri?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive', onPress: action }
        ]
      );
    }
  };

  const menuItems = [
    { label: 'My Active Listings', count: 3, icon: Gavel },
    { label: 'Won Handover Coordinates', count: 2, icon: ShieldCheck },
    { label: 'Account Settings', icon: Settings },
  ];

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header */}
      <View className="px-5 pt-3 pb-2 flex-row justify-between items-center border-b border-stone-200">
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            My Profile
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            Manage your bidding credentials
          </Text>
        </View>
        <User size={24} color="#FF6B35" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="w-full max-w-2xl mx-auto px-5 pt-6 pb-12">
          
          {/* User Hero Section Card */}
          <View className="w-full bg-white border border-stone-200 rounded-3xl p-5 mb-6 shadow-sm items-center">
            {/* Large Avatar */}
            <View 
              style={{ backgroundColor: 'rgba(255, 107, 53, 0.1)', borderColor: 'rgba(255, 107, 53, 0.25)' }}
              className="w-20 h-20 border rounded-full items-center justify-center mb-3"
            >
              <User size={40} color="#FF6B35" />
            </View>

            {/* Name and Verification Badge */}
            <View className="flex-row items-center justify-center gap-1.5 mb-1">
              <Text className="text-xl font-display font-extrabold text-brand-text">
                {user.name}
              </Text>
              {user.isVerified && <ShieldCheck size={18} color="#2EC4B6" fill="#2EC4B6" fillOpacity={0.2} />}
            </View>

            <Text className="text-sm font-display text-brand-muted mb-3">
              {user.email}
            </Text>

            {/* Star Ratings */}
            <View 
              style={{ backgroundColor: 'rgba(255, 182, 39, 0.15)' }}
              className="flex-row items-center px-3 py-1.5 rounded-full mb-5"
            >
              <Star size={14} color="#FFB627" fill="#FFB627" className="mr-1" />
              <Text className="text-xs font-display font-bold text-brand-text">
                {user.rating} Seller Rating ({user.dealsCount} deals)
              </Text>
            </View>

            {/* Stats row */}
            <View className="w-full flex-row justify-around border-t border-stone-100 pt-4">
              <View className="items-center">
                <Text className="text-xl font-display font-extrabold text-brand-text">
                  {user.auctionsCreated}
                </Text>
                <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold mt-0.5">
                  Created
                </Text>
              </View>
              
              <View className="h-8 w-[1px] bg-stone-200 self-center" />

              <View className="items-center">
                <Text className="text-xl font-display font-extrabold text-brand-text">
                  {user.auctionsWon}
                </Text>
                <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold mt-0.5">
                  Won
                </Text>
              </View>
            </View>
          </View>

          {/* Action List Menu */}
          <View className="bg-white border border-stone-200 rounded-3xl overflow-hidden mb-6 shadow-sm">
            {menuItems.map((item, idx) => {
              const IconComp = item.icon;
              return (
                <Pressable
                  key={idx}
                  onPress={() => handleMenuPress(item.label)}
                  className={`flex-row items-center justify-between p-4.5 ${
                    idx < menuItems.length - 1 ? 'border-b border-stone-100' : ''
                  } active:bg-stone-50`}
                >
                  <View className="flex-row items-center">
                    <View 
                      style={{ backgroundColor: 'rgba(255, 107, 53, 0.1)' }}
                      className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                    >
                      <IconComp size={16} color="#FF6B35" />
                    </View>
                    <Text className="font-display font-semibold text-brand-text text-sm">
                      {item.label}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-1">
                    {item.count !== undefined && (
                      <View className="bg-stone-100 px-2 py-0.5 rounded-full">
                        <Text className="text-xs font-display text-brand-muted font-bold">
                          {item.count}
                        </Text>
                      </View>
                    )}
                    <ChevronRight size={16} color="#BDC3C7" />
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Log Out Button */}
          <Button
            label="Log Out"
            variant="outline"
            icon={<LogOut size={16} color="#E71D36" />}
            onPress={handleLogout}
            className="border-brand-error/20 active:bg-red-50"
          />

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
