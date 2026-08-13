import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, UserX, Search, ShieldCheck } from 'lucide-react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { getBlockedUsers, unblockUser, BlockedRelationship } from '@/services/moderationService';

export default function BlockedUsersScreen() {
  const [blocked, setBlocked] = useState<BlockedRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadBlockedList = async () => {
    try {
      const data = await getBlockedUsers();
      setBlocked(data);
    } catch (err: any) {
      Alert.alert('Load Failure', err.message || 'Unable to retrieve blocked users list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlockedList();
  }, []);

  const triggerHaptic = () => {
    if (Haptics && Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleUnblock = async (blockedUserId: string, username: string) => {
    setUnblockingId(blockedUserId);
    try {
      triggerHaptic();
      await unblockUser(blockedUserId);
      setBlocked(prev => prev.filter(item => item.blocked_id !== blockedUserId));
      Alert.alert('User Unblocked', `@${username} has been unblocked successfully.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to unblock user.');
    } finally {
      setUnblockingId(null);
    }
  };

  // Filter blocked users based on search
  const filteredBlocked = blocked.filter(item => {
    const username = item.blocked?.username || '';
    const fullName = item.blocked?.full_name || '';
    return (
      username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header Panel */}
      <View className="px-5 py-3 flex-row items-center border-b border-stone-200 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 mr-2">
          <ArrowLeft size={20} color="#1A1A1A" />
        </Pressable>
        <View>
          <Text className="text-lg font-display font-extrabold text-brand-text">
            Blocked Users
          </Text>
          <Text className="text-[10px] font-display text-brand-muted mt-0.5">
            Manage blocked accounts who cannot message you
          </Text>
        </View>
      </View>

      {/* Search Input Box */}
      {blocked.length > 0 && (
        <View className="px-5 pt-4 pb-1">
          <View className="flex-row items-center bg-white border border-stone-200 rounded-2xl px-3.5 h-11">
            <Search size={16} color="#7F8C8D" className="mr-2" />
            <TextInput
              placeholder="Search blocked users..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 h-full font-display text-xs text-brand-text p-0 m-0 bg-transparent"
            />
          </View>
        </View>
      )}

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <FlatList
          data={filteredBlocked}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center py-16 px-6">
              <View className="w-14 h-14 rounded-full bg-stone-100 items-center justify-center mb-4">
                <UserX size={24} color="#7F8C8D" />
              </View>
              <Text className="text-sm font-display font-bold text-brand-text mb-1 text-center">
                {searchQuery ? 'No Results Found' : 'No Blocked Users'}
              </Text>
              <Text className="text-xs font-display text-brand-muted text-center max-w-xs leading-relaxed">
                {searchQuery 
                  ? 'Try altering your search text.' 
                  : 'Profiles you block will appear here. Blocked users cannot start conversations or send messages.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const profile = item.blocked;
            const displayUsername = profile?.username || 'user';
            const displayFullName = profile?.full_name || 'Bhel Puri Bidder';
            const isUnblocking = unblockingId === item.blocked_id;

            return (
              <View className="flex-row items-center justify-between p-4 bg-white border border-stone-200 rounded-3xl mb-3 shadow-sm">
                <View className="flex-row items-center flex-1 mr-3">
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} className="w-10 h-10 rounded-full mr-3 border border-stone-200" />
                  ) : (
                    <View className="w-10 h-10 rounded-full bg-brand-primary/10 border border-brand-primary/20 items-center justify-center mr-3">
                      <Text className="font-display font-extrabold text-brand-primary text-xs">
                        {displayUsername.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View className="flex-1">
                    <View className="flex-row items-center gap-1">
                      <Text className="font-display font-bold text-brand-text text-xs" numberOfLines={1}>
                        {displayFullName}
                      </Text>
                      {profile?.is_verified && <ShieldCheck size={13} color="#2EC4B6" />}
                    </View>
                    <Text className="text-[10px] font-display text-brand-muted mt-0.5" numberOfLines={1}>
                      @{displayUsername}
                    </Text>
                  </View>
                </View>

                {isUnblocking ? (
                  <ActivityIndicator size="small" color="#FF6B35" className="px-3" />
                ) : (
                  <Pressable
                    onPress={() => handleUnblock(item.blocked_id, displayUsername)}
                    className="border border-stone-300 bg-white px-4 py-2 rounded-full active:bg-stone-50"
                  >
                    <Text className="text-[10px] font-display font-bold text-brand-text">
                      Unblock
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
