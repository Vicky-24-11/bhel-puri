import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Search, ArrowUpRight, User } from 'lucide-react-native';
import { Image } from 'expo-image';
import { getAdminUsersList } from '@/services/adminService';

export default function AdminUsersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const pageSize = 20;

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count: total } = await getAdminUsersList(search, statusFilter, pageSize, page * pageSize);
      setUsers(data);
      setCount(total);
    } catch (err) {
      console.error('Error loading users list:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Reset page when search or filter changes
  const handleSearchChange = (text: string) => {
    setSearch(text);
    setPage(0);
  };

  const handleStatusFilterChange = (val: 'all' | 'active' | 'suspended') => {
    setStatusFilter(val);
    setPage(0);
  };

  const totalPages = Math.ceil(count / pageSize) || 1;

  return (
    <View className="flex-1 bg-stone-50 p-6">
      {/* Title */}
      <View className="mb-6">
        <Text className="text-2xl font-display font-extrabold text-brand-text">
          User Accounts
        </Text>
        <Text className="text-xs font-display text-brand-muted mt-0.5">
          View member credentials and manage suspensions
        </Text>
      </View>

      {/* Filter panel */}
      <View className="bg-white border border-stone-200 p-4 rounded-3xl shadow-sm mb-6 flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search bar */}
        <View className="flex-1 w-full bg-stone-50 border border-stone-200 px-4 h-11 rounded-xl flex-row items-center gap-2">
          <Search size={16} color="#7F8C8D" />
          <TextInput
            placeholder="Search by username or name..."
            value={search}
            onChangeText={handleSearchChange}
            className="flex-1 h-full text-xs font-display text-brand-text p-0 m-0 bg-transparent"
          />
        </View>

        {/* Status filters */}
        <View className="flex-row bg-stone-100 rounded-xl p-1 w-full md:w-auto self-stretch md:self-auto">
          {(['all', 'active', 'suspended'] as const).map((tab) => {
            const isActive = statusFilter === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => handleStatusFilterChange(tab)}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg items-center ${isActive ? 'bg-white shadow-sm' : 'bg-transparent'}`}
              >
                <Text className={`text-[11px] font-display font-bold capitalize ${isActive ? 'text-brand-text' : 'text-brand-muted'}`}>
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Table view */}
      <View className="flex-1 bg-white border border-stone-200 rounded-3xl shadow-sm overflow-hidden mb-4">
        {loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#FF6B35" />
          </View>
        ) : users.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-6">
            <User size={48} color="#BDC3C7" className="mb-3" />
            <Text className="text-base font-display font-bold text-brand-text">No Users Found</Text>
            <Text className="text-xs font-display text-brand-muted text-center mt-1 leading-relaxed">
              No registered user profiles matched your current search parameters.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="min-w-full">
              {/* Header */}
              <View className="flex-row border-b border-stone-200 bg-stone-50/50 px-5 py-3">
                <Text className="w-16 font-display font-bold text-[10px] text-brand-muted uppercase">Avatar</Text>
                <Text className="w-48 font-display font-bold text-[10px] text-brand-muted uppercase">Username</Text>
                <Text className="w-48 font-display font-bold text-[10px] text-brand-muted uppercase">Full Name</Text>
                <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Reputation</Text>
                <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Status</Text>
                <Text className="w-36 font-display font-bold text-[10px] text-brand-muted uppercase">Date Joined</Text>
                <Text className="w-24 font-display font-bold text-[10px] text-brand-muted uppercase text-right">Actions</Text>
              </View>

              {/* Rows */}
              <ScrollView className="flex-1">
                {users.map((item) => (
                  <View key={item.id} className="flex-row items-center border-b border-stone-100 px-5 py-3.5 hover:bg-stone-50/20">
                    {/* Avatar */}
                    <View className="w-16">
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} className="w-8 h-8 rounded-full border border-stone-200" />
                      ) : (
                        <View className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 items-center justify-center">
                          <User size={12} color="#7F8C8D" />
                        </View>
                      )}
                    </View>

                    {/* Username */}
                    <Text className="w-48 font-display font-bold text-brand-text text-xs">
                      @{item.username}
                    </Text>

                    {/* Name */}
                    <Text className="w-48 font-display text-brand-text text-xs" numberOfLines={1}>
                      {item.full_name || 'Bhel Puri Member'}
                    </Text>

                    {/* Reputation */}
                    <Text className="w-32 font-display text-brand-text text-xs">
                      ⭐ {item.rating ? Number(item.rating).toFixed(1) : '0.0'} ({item.total_ratings || 0})
                    </Text>

                    {/* Status */}
                    <View className="w-32">
                      <View className={`self-start px-2.5 py-1 rounded-full ${item.account_status === 'suspended' ? 'bg-red-50 border border-red-150' : 'bg-green-50 border border-green-150'}`}>
                        <Text className={`text-[9px] font-display font-bold uppercase ${item.account_status === 'suspended' ? 'text-red-600' : 'text-green-600'}`}>
                          {item.account_status}
                        </Text>
                      </View>
                    </View>

                    {/* Created date */}
                    <Text className="w-36 font-display text-brand-muted text-xs">
                      {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>

                    {/* Action */}
                    <Pressable
                      onPress={() => router.push(`/admin/users/${item.id}` as any)}
                      className="w-24 flex-row items-center justify-end gap-1.5 active:opacity-75"
                    >
                      <Text className="text-brand-primary font-display font-bold text-xs">View</Text>
                      <ArrowUpRight size={12} color="#FF6B35" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <View className="flex-row items-center justify-between px-2 py-3 bg-white border border-stone-200 rounded-3xl shadow-sm">
          <Pressable
            onPress={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className={`w-10 h-10 items-center justify-center rounded-full border border-stone-200 bg-white ${page === 0 ? 'opacity-40' : 'active:bg-stone-50'}`}
          >
            <ChevronLeft size={16} color="#1A1A1A" />
          </Pressable>

          <Text className="font-display font-semibold text-brand-muted text-xs">
            Page {page + 1} of {totalPages}
          </Text>

          <Pressable
            onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1 || loading}
            className={`w-10 h-10 items-center justify-center rounded-full border border-stone-200 bg-white ${page === totalPages - 1 ? 'opacity-40' : 'active:bg-stone-50'}`}
          >
            <ChevronRight size={16} color="#1A1A1A" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
