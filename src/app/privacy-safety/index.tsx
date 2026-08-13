import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Users, FileText, ShieldAlert, Trash2, ChevronRight, Lock, Eye, Bell } from 'lucide-react-native';
import { router } from 'expo-router';

import { deleteAccount } from '@/services/moderationService';
import { signOut } from '@/services/authService';

export default function PrivacySafetyDashboard() {
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    const action = async () => {
      setDeleting(true);
      try {
        await deleteAccount();
        await signOut();
        Alert.alert('Account Deactivated', 'Your account has been deleted successfully.');
        router.replace('/welcome' as any);
      } catch (err: any) {
        console.error('Account deletion error:', err);
        Alert.alert('Error', err.message || 'Failed to delete account. Please try again.');
      } finally {
        setDeleting(false);
      }
    };

    const confirmMessage = 
      'Are you absolutely sure you want to delete your Bhel Puri account?\n\n' +
      'This action cannot be undone. All your active watchlists, notifications, and settings will be permanently cleared. ' +
      'Your historical listings and bids will be anonymized to preserve auction integrity.';

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        action();
      }
    } else {
      Alert.alert(
        'Delete Bhel Puri Account?',
        confirmMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete Account', style: 'destructive', onPress: action }
        ]
      );
    }
  };

  const menuSections = [
    {
      title: 'Safety & Moderation',
      items: [
        { label: 'Blocked Users', icon: Users, description: 'Manage profiles you have blocked', route: '/privacy-safety/blocked' },
        { label: 'Report History', icon: ShieldAlert, description: 'View safety report logs submitted by you', route: '/privacy-safety/reports' },
        { label: 'Notification Settings', icon: Bell, description: 'Manage push and transactional alerts', route: '/privacy-safety/notifications-settings' }
      ]
    },
    {
      title: 'Legal & Guidelines',
      items: [
        { label: 'Terms & Conditions', icon: FileText, description: 'Marketplace, bidding and dispute terms', route: '/privacy-safety/terms' },
        { label: 'Privacy Policy', icon: Eye, description: 'How we manage storage and metadata', route: '/privacy-safety/policy' },
        { label: 'Community Guidelines', icon: Lock, description: 'Bidding guidelines and prohibited items', route: '/privacy-safety/guidelines' }
      ]
    }
  ];

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header Panel */}
      <View className="px-5 py-3 flex-row items-center border-b border-stone-200 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 mr-2">
          <ArrowLeft size={20} color="#1A1A1A" />
        </Pressable>
        <View>
          <Text className="text-lg font-display font-extrabold text-brand-text">
            Privacy & Safety
          </Text>
          <Text className="text-[10px] font-display text-brand-muted mt-0.5">
            Manage blocks, guidelines and account options
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="w-full max-w-2xl mx-auto px-5 pt-6 pb-12 gap-6">
          
          {menuSections.map((section, secIdx) => (
            <View key={secIdx} className="gap-2">
              <Text className="text-[10px] font-display font-bold uppercase tracking-wider text-brand-muted px-1.5">
                {section.title}
              </Text>
              
              <View className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm">
                {section.items.map((item, idx) => {
                  const IconComp = item.icon;
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => router.push(item.route as any)}
                      className={`flex-row items-center justify-between p-4 ${
                        idx < section.items.length - 1 ? 'border-b border-stone-100' : ''
                      } active:bg-stone-50`}
                    >
                      <View className="flex-row items-center flex-1 mr-3">
                        <View 
                          style={{ backgroundColor: 'rgba(255, 107, 53, 0.08)' }}
                          className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                        >
                          <IconComp size={16} color="#FF6B35" />
                        </View>
                        <View className="flex-1">
                          <Text className="font-display font-bold text-brand-text text-xs">
                            {item.label}
                          </Text>
                          <Text className="text-[10px] font-display text-brand-muted mt-0.5" numberOfLines={1}>
                            {item.description}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight size={14} color="#BDC3C7" />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Account Deletion Panel */}
          <View className="gap-2 mt-2">
            <Text className="text-[10px] font-display font-bold uppercase tracking-wider text-brand-error px-1.5">
              Account Management
            </Text>
            
            <View className="bg-white border border-stone-200 rounded-3xl p-4.5 shadow-sm gap-3.5">
              <Text className="text-xs font-display text-brand-muted leading-relaxed">
                Deleting your account will remove your authentication profile immediately. Bidding metadata and listing metrics will be preserved anonymously.
              </Text>
              
              {deleting ? (
                <View className="py-2.5 items-center">
                  <ActivityIndicator size="small" color="#E71D36" />
                </View>
              ) : (
                <Pressable
                  onPress={handleDeleteAccount}
                  style={{ borderColor: 'rgba(231, 29, 54, 0.25)' }}
                  className="w-full h-11 border rounded-2xl items-center justify-center flex-row gap-2 active:bg-red-50 bg-white"
                >
                  <Trash2 size={15} color="#E71D36" />
                  <Text className="text-xs font-display font-bold text-brand-error">
                    Delete Account
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
