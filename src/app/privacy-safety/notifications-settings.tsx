import React, { useState, useEffect } from 'react';
import { View, Text, Switch, Pressable, ScrollView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, MessageSquare, Gavel, Save } from 'lucide-react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const PREFS_KEY = 'bhelpuri_notification_preferences';

export default function NotificationSettingsScreen() {
  const [auctionAlerts, setAuctionAlerts] = useState(true);
  const [messageAlerts, setMessageAlerts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        if (Platform.OS === 'web') {
          const localVal = localStorage.getItem(PREFS_KEY);
          if (localVal) {
            const parsed = JSON.parse(localVal);
            setAuctionAlerts(parsed.auctionAlerts ?? true);
            setMessageAlerts(parsed.messageAlerts ?? true);
          }
        } else {
          const secureVal = await SecureStore.getItemAsync(PREFS_KEY);
          if (secureVal) {
            const parsed = JSON.parse(secureVal);
            setAuctionAlerts(parsed.auctionAlerts ?? true);
            setMessageAlerts(parsed.messageAlerts ?? true);
          }
        }
      } catch (err) {
        console.error('Error loading notification preferences:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const prefs = { auctionAlerts, messageAlerts };
      const prefsStr = JSON.stringify(prefs);
      
      if (Platform.OS === 'web') {
        localStorage.setItem(PREFS_KEY, prefsStr);
      } else {
        await SecureStore.setItemAsync(PREFS_KEY, prefsStr);
      }

      if (Platform.OS === 'web') {
        window.alert('Settings Saved: Your notification preferences have been updated.');
      } else {
        Alert.alert('Settings Saved', 'Your notification preferences have been updated.');
      }
      router.back();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to save preferences.';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errMsg}`);
      } else {
        Alert.alert('Error', errMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header Panel */}
      <View className="px-5 py-3 flex-row items-center border-b border-stone-200 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 mr-2">
          <ArrowLeft size={20} color="#1A1A1A" />
        </Pressable>
        <View className="flex-row items-center gap-1.5 flex-1">
          <Bell size={18} color="#FF6B35" />
          <View>
            <Text className="text-lg font-display font-extrabold text-brand-text">
              Notification Settings
            </Text>
            <Text className="text-[10px] font-display text-brand-muted mt-0.5">
              Control transactional alerts
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-white">
          <View className="w-full max-w-2xl mx-auto px-5 pt-6 pb-12 gap-6">
            
            <View className="bg-stone-50 border border-stone-200 rounded-3xl p-5 mb-2 gap-1.5">
              <Text className="text-xs font-display font-bold text-brand-text">
                Transactional Alert Channel
              </Text>
              <Text className="text-[11px] font-display text-brand-muted leading-relaxed">
                Transactional alerts regarding bidding, wins, or messages are critical. Toggle specific notification categories you want sent to your device.
              </Text>
            </View>

            {/* Auction Activity Alerts */}
            <View className="flex-row items-center justify-between p-4 bg-white border border-stone-200 rounded-3xl shadow-sm">
              <View className="flex-row items-center flex-1 mr-3 gap-3">
                <View 
                  style={{ backgroundColor: 'rgba(255, 107, 53, 0.08)' }}
                  className="w-8 h-8 rounded-lg items-center justify-center"
                >
                  <Gavel size={16} color="#FF6B35" />
                </View>
                <View className="flex-1">
                  <Text className="font-display font-bold text-brand-text text-xs">
                    Auction Activity
                  </Text>
                  <Text className="text-[10px] font-display text-brand-muted mt-0.5">
                    Outbids, starts, and ended alerts
                  </Text>
                </View>
              </View>
              <Switch
                value={auctionAlerts}
                onValueChange={setAuctionAlerts}
                trackColor={{ false: '#BDC3C7', true: '#FF6B35' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Direct Message Alerts */}
            <View className="flex-row items-center justify-between p-4 bg-white border border-stone-200 rounded-3xl shadow-sm">
              <View className="flex-row items-center flex-1 mr-3 gap-3">
                <View 
                  style={{ backgroundColor: 'rgba(255, 107, 53, 0.08)' }}
                  className="w-8 h-8 rounded-lg items-center justify-center"
                >
                  <MessageSquare size={16} color="#FF6B35" />
                </View>
                <View className="flex-1">
                  <Text className="font-display font-bold text-brand-text text-xs">
                    Direct Messages
                  </Text>
                  <Text className="text-[10px] font-display text-brand-muted mt-0.5">
                    Messages from sellers and winners
                  </Text>
                </View>
              </View>
              <Switch
                value={messageAlerts}
                onValueChange={setMessageAlerts}
                trackColor={{ false: '#BDC3C7', true: '#FF6B35' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Save Button */}
            {saving ? (
              <ActivityIndicator size="small" color="#FF6B35" className="py-2" />
            ) : (
              <Pressable
                onPress={handleSave}
                className="w-full h-11 bg-brand-primary active:bg-brand-primary/95 rounded-2xl items-center justify-center flex-row gap-2 mt-4"
              >
                <Save size={14} color="#FFFFFF" />
                <Text className="text-xs font-display font-bold text-white">
                  Save Preferences
                </Text>
              </Pressable>
            )}

          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
