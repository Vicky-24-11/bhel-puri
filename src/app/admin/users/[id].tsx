import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, User, ShieldAlert, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { updateUserStatus } from '@/services/adminService';
import { Button } from '@/components/ui/Button';

export default function AdminUserDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modal states for suspension
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const loadUserDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);

      // 1. Fetch profile
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profErr) throw profErr;
      setProfile(prof);

      // 2. Fetch user listings
      const { data: lists } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', id)
        .order('created_at', { ascending: false });

      setListings(lists || []);

      // 3. Fetch reports targeting this user
      const { data: reps } = await supabase
        .from('reports')
        .select('*, reporter:profiles!reports_reporter_id_fkey(username)')
        .eq('reported_user_id', id)
        .order('created_at', { ascending: false });

      setReports(reps || []);
    } catch (err: any) {
      console.error('Error loading user admin details:', err);
      Alert.alert('Error', 'Failed to retrieve user administrative profile data.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadUserDetails();
  }, [loadUserDetails]);

  const handleSuspend = async () => {
    if (!id || !suspendReason.trim()) {
      Alert.alert('Reason Required', 'Please enter a justification for suspending this account.');
      return;
    }
    try {
      setUpdating(true);
      await updateUserStatus(id, 'suspended', suspendReason.trim());
      setProfile((prev: any) => prev ? { ...prev, account_status: 'suspended' } : null);
      setShowSuspendModal(false);
      setSuspendReason('');
      Alert.alert('Success', 'User access suspended successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to suspend user.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRestore = async () => {
    Alert.alert(
      'Restore Account',
      'Are you sure you want to restore access for this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore User',
          onPress: async () => {
            try {
              setUpdating(true);
              await updateUserStatus(id!, 'active', 'Restored access by admin');
              setProfile((prev: any) => prev ? { ...prev, account_status: 'active' } : null);
              Alert.alert('Success', 'User account restored successfully.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Unable to restore user.');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-stone-50">
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 justify-center items-center bg-stone-50 px-6">
        <ShieldAlert size={48} color="#E71D36" className="mb-4" />
        <Text className="text-base font-display font-bold text-brand-text mb-2">Profile Not Found</Text>
        <Pressable onPress={() => router.back()} className="px-6 py-3 bg-brand-primary rounded-xl">
          <Text className="text-white font-display font-bold text-xs">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isSuspended = profile.account_status === 'suspended';

  return (
    <ScrollView className="flex-1 bg-stone-50 p-6">
      {/* Header */}
      <View className="flex-row items-center gap-3 mb-6">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center bg-white border border-stone-200 rounded-full shadow-sm active:bg-stone-50"
        >
          <ChevronLeft size={20} color="#1A1A1A" />
        </Pressable>
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            User Details
          </Text>
          <Text className="text-xs font-display text-brand-muted">
            Managing administrator settings for @{profile.username}
          </Text>
        </View>
      </View>

      <View className="flex-col lg:flex-row gap-6 mb-12">
        {/* Left Column: Profile Card & Actions */}
        <View className="flex-1 lg:max-w-sm gap-6">
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm items-center">
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} className="w-20 h-20 rounded-full mb-3 border border-stone-200" />
            ) : (
              <View className="w-20 h-20 border rounded-full bg-stone-50 border-stone-200 items-center justify-center mb-3">
                <User size={30} color="#7F8C8D" />
              </View>
            )}

            <Text className="text-lg font-display font-extrabold text-brand-text">
              {profile.full_name || 'Bhel Puri Member'}
            </Text>
            <Text className="text-xs font-display text-brand-muted mb-4">
              @{profile.username}
            </Text>

            {/* Verification Status info */}
            <View className="flex-row items-center gap-1 bg-stone-50 border border-stone-200 px-3 py-1 rounded-full mb-4">
              <Text className="text-[10px] font-display font-bold text-brand-muted uppercase">
                Status: {profile.verification_status}
              </Text>
            </View>

            <View className="w-full flex-row justify-around border-t border-stone-100 pt-4">
              <View className="items-center">
                <Text className="text-sm font-display font-bold text-brand-text">
                  ⭐ {profile.rating ? Number(profile.rating).toFixed(1) : '0.0'}
                </Text>
                <Text className="text-[9px] font-display text-brand-muted uppercase font-semibold mt-0.5">Rating</Text>
              </View>
              <View className="h-6 w-[1px] bg-stone-200 self-center" />
              <View className="items-center">
                <Text className="text-sm font-display font-bold text-brand-text">
                  {profile.total_ratings || 0}
                </Text>
                <Text className="text-[9px] font-display text-brand-muted uppercase font-semibold mt-0.5">Reviews</Text>
              </View>
            </View>
          </View>

          {/* Moderate Actions Panel */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-4">
            <Text className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
              Administration Actions
            </Text>

            {isSuspended ? (
              <View className="gap-3">
                <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 p-3 rounded-2xl">
                  <ShieldAlert size={18} color="#EF4444" />
                  <Text className="text-[11px] font-display font-semibold text-red-700 flex-1 leading-relaxed">
                    This account is currently suspended. All listing creations, bid inputs, and chat updates are blocked.
                  </Text>
                </View>

                <Button
                  label="Restore User Access"
                  onPress={handleRestore}
                  disabled={updating}
                  className="bg-emerald-600 active:bg-emerald-700 w-full"
                />
              </View>
            ) : (
              <View className="gap-3">
                <View className="flex-row items-center gap-2 bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                  <ShieldCheck size={18} color="#10B981" />
                  <Text className="text-[11px] font-display font-semibold text-emerald-700 flex-1 leading-relaxed">
                    This account is active and has full access to place bids and create listings.
                  </Text>
                </View>

                <Button
                  label="Suspend User Access"
                  onPress={() => setShowSuspendModal(true)}
                  disabled={updating}
                  className="bg-brand-error active:bg-brand-error/95 w-full"
                />
              </View>
            )}
          </View>
        </View>

        {/* Right Column: User Listings & Reports */}
        <View className="flex-1 gap-6">
          {/* User Listings Card */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm">
            <Text className="text-sm font-display font-extrabold text-brand-text mb-4 uppercase tracking-wider">
              User Listings ({listings.length})
            </Text>

            {listings.length === 0 ? (
              <Text className="text-xs font-display text-brand-muted py-6">
                This user has not listed any items for sale.
              </Text>
            ) : (
              <View className="gap-3">
                {listings.slice(0, 5).map((list) => (
                  <Pressable
                    key={list.id}
                    onPress={() => router.push(`/admin/listings?search=${list.title}`)}
                    className="flex-row items-center justify-between border-b border-stone-100 pb-2.5 active:opacity-75"
                  >
                    <View className="flex-1 pr-4">
                      <Text className="font-display font-bold text-brand-text text-xs" numberOfLines={1}>
                        {list.title}
                      </Text>
                      <Text className="text-[9px] font-display text-brand-muted mt-0.5">
                        Price: ₹{Number(list.starting_price).toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View className={`px-2 py-0.5 rounded-full ${list.moderation_status === 'removed' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                      <Text className={`text-[8px] font-display font-bold uppercase ${list.moderation_status === 'removed' ? 'text-red-600' : 'text-green-600'}`}>
                        {list.moderation_status}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* User Reports Card */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm">
            <Text className="text-sm font-display font-extrabold text-brand-text mb-4 uppercase tracking-wider">
              Safety Reports Received ({reports.length})
            </Text>

            {reports.length === 0 ? (
              <Text className="text-xs font-display text-brand-muted py-6">
                No safety complaints or reports have been submitted against this user.
              </Text>
            ) : (
              <View className="gap-3">
                {reports.slice(0, 5).map((rep) => (
                  <Pressable
                    key={rep.id}
                    onPress={() => router.push(`/admin/reports?status=${rep.status}`)}
                    className="border-b border-stone-100 pb-2.5 active:opacity-75"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-display font-bold text-brand-text text-xs capitalize">
                        Reason: {rep.reason.replace('_', ' ')}
                      </Text>
                      <View className={`px-2 py-0.5 rounded-full ${rep.status === 'resolved' ? 'bg-stone-100 border border-stone-200' : 'bg-red-50 border border-red-150'}`}>
                        <Text className={`text-[8px] font-display font-bold uppercase ${rep.status === 'resolved' ? 'text-stone-600' : 'text-red-600'}`}>
                          {rep.status}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-[10px] font-display text-brand-muted mt-1 leading-relaxed" numberOfLines={2}>
                      {rep.description || 'No description provided.'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Suspend Confirmation Modal */}
      <Modal
        visible={showSuspendModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuspendModal(false)}
      >
        <Pressable 
          onPress={() => setShowSuspendModal(false)} 
          className="flex-1 bg-black/40 justify-center items-center px-6"
        >
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm gap-4">
            <View className="flex-row items-center gap-2">
              <AlertCircle size={18} color="#FF6B35" />
              <Text className="font-display font-extrabold text-brand-text text-sm">
                Suspend Account Access
              </Text>
            </View>

            <Text className="text-xs font-display text-brand-muted leading-relaxed">
              Please enter the justification reason for suspending this user account. This will be stored in the admin audit history.
            </Text>

            <TextInput
              placeholder="e.g. Fraudulent listings/activity, spam bids..."
              value={suspendReason}
              onChangeText={setSuspendReason}
              maxLength={200}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 h-12 text-xs font-display text-brand-text"
            />

            <View className="flex-row gap-3 mt-1">
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setShowSuspendModal(false)}
                className="flex-1"
              />
              <Button
                label="Suspend"
                onPress={handleSuspend}
                className="flex-1 bg-brand-error"
                disabled={updating}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
