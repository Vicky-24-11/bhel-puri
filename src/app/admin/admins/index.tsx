import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { ShieldAlert, UserX, UserPlus } from 'lucide-react-native';
import { getAdminsList, promoteToAdmin, deactivateAdminUser, AdminUser } from '@/services/adminService';
import { Button } from '@/components/ui/Button';

export default function AdminManagementScreen() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [selectedRole, setSelectedRole] = useState<'moderator' | 'support'>('moderator');

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const data = await getAdminsList();
      setAdmins(data);
    } catch (err) {
      console.error('Error loading admins list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handlePromote = async () => {
    const usernameClean = newUsername.trim().replace(/^@/, '');
    if (!usernameClean) {
      Alert.alert('Required', 'Please enter a valid Bhel Puri username.');
      return;
    }

    try {
      setPromoting(true);
      await promoteToAdmin(usernameClean, selectedRole);
      setNewUsername('');
      Alert.alert('Success', `Successfully promoted @${usernameClean} to ${selectedRole}.`);
      loadAdmins();
    } catch (err: any) {
      Alert.alert('Promotion Failed', err.message || 'Unable to promote user.');
    } finally {
      setPromoting(false);
    }
  };

  const handleDeactivate = async (adminId: string, userId: string, username: string) => {
    Alert.alert(
      'Deactivate Admin Access',
      `Are you sure you want to deactivate administrative access for @${username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deactivateAdminUser(adminId, userId);
              Alert.alert('Success', 'Admin access deactivated.');
              loadAdmins();
            } catch (err: any) {
              Alert.alert('Deactivation Failed', err.message || 'Unable to deactivate.');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-stone-50 p-6">
      {/* Title */}
      <View className="mb-6">
        <Text className="text-2xl font-display font-extrabold text-brand-text">
          Admin Role Management
        </Text>
        <Text className="text-xs font-display text-brand-muted mt-0.5">
          Promote users to administrative positions or manage active privileges
        </Text>
      </View>

      <View className="flex-col lg:flex-row gap-6 mb-12">
        {/* Left Column: Promote Admin Form */}
        <View className="flex-1 lg:max-w-sm gap-6">
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-4">
            <View className="flex-row items-center gap-2">
              <UserPlus size={16} color="#FF6B35" />
              <Text className="text-xs font-display font-bold text-brand-text uppercase">
                Promote Admin User
              </Text>
            </View>

            <View className="gap-1.5">
              <Text className="text-[10px] font-display font-bold text-brand-muted uppercase">Username:</Text>
              <TextInput
                placeholder="Username (e.g. rahul)"
                value={newUsername}
                onChangeText={setNewUsername}
                autoCapitalize="none"
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 h-12 text-xs font-display text-brand-text"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-[10px] font-display font-bold text-brand-muted uppercase">Role:</Text>
              <View className="flex-row bg-stone-100 rounded-xl p-1">
                {(['moderator', 'support'] as const).map((roleVal) => {
                  const isActive = selectedRole === roleVal;
                  return (
                    <Pressable
                      key={roleVal}
                      onPress={() => setSelectedRole(roleVal)}
                      className={`flex-1 py-2 rounded-lg items-center ${isActive ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                    >
                      <Text className={`text-[10px] font-display font-bold capitalize ${isActive ? 'text-brand-text' : 'text-brand-muted'}`}>
                        {roleVal}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Button
              label="Promote User"
              onPress={handlePromote}
              disabled={promoting}
              className="bg-brand-primary active:bg-brand-primary/95 mt-2"
            />
          </View>
        </View>

        {/* Right Column: Admins List */}
        <View className="flex-1">
          <View className="bg-white border border-stone-200 rounded-3xl shadow-sm overflow-hidden">
            {loading ? (
              <View className="items-center justify-center py-20">
                <ActivityIndicator size="large" color="#FF6B35" />
              </View>
            ) : admins.length === 0 ? (
              <View className="items-center justify-center py-20">
                <ShieldAlert size={48} color="#BDC3C7" className="mb-3" />
                <Text className="text-base font-display font-bold text-brand-text">No Admins Logged</Text>
              </View>
            ) : (
              <View className="min-w-full">
                {/* Header */}
                <View className="flex-row border-b border-stone-200 bg-stone-50/50 px-5 py-3">
                  <Text className="w-40 font-display font-bold text-[10px] text-brand-muted uppercase">Admin User</Text>
                  <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Role</Text>
                  <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Status</Text>
                  <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Created Date</Text>
                  <Text className="flex-1 font-display font-bold text-[10px] text-brand-muted uppercase text-right">Actions</Text>
                </View>

                {/* Rows */}
                <View>
                  {admins.map((item) => (
                    <View key={item.id} className="flex-row items-center border-b border-stone-100 px-5 py-3.5">
                      {/* User */}
                      <Text className="w-40 font-display font-bold text-brand-text text-xs">
                        @{item.profile?.username || 'user'}
                      </Text>

                      {/* Role */}
                      <Text className="w-32 font-display text-brand-text text-xs font-semibold capitalize">
                        {item.role.replace('_', ' ')}
                      </Text>

                      {/* Status */}
                      <View className="w-32">
                        <View className={`self-start px-2 py-0.5 rounded-full ${item.is_active ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-stone-100 border border-stone-200 text-stone-600'}`}>
                          <Text className="text-[8px] font-display font-bold uppercase text-inherit">
                            {item.is_active ? 'active' : 'inactive'}
                          </Text>
                        </View>
                      </View>

                      {/* Created date */}
                      <Text className="w-32 font-display text-brand-muted text-xs">
                        {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>

                      {/* Actions */}
                      <View className="flex-1 items-end">
                        {item.is_active && item.role !== 'super_admin' ? (
                          <Pressable
                            onPress={() => handleDeactivate(item.id, item.user_id, item.profile?.username)}
                            className="flex-row items-center gap-1 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg active:bg-red-100"
                          >
                            <UserX size={11} color="#E71D36" />
                            <Text className="text-[10px] font-display font-bold text-brand-error">Deactivate</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
