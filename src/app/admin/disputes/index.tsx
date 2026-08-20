import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, ShieldAlert, ArrowUpRight, Search } from 'lucide-react-native';
import { getAdminDisputes } from '@/services/disputeService';
import { Dispute } from '@/types/database.types';

export default function AdminDisputesScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const pageSize = 15;

  const loadDisputes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAdminDisputes(statusFilter);
      setDisputes(data);
    } catch (err) {
      console.error('Error loading admin disputes:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

  const filteredDisputes = disputes.filter((disp) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const tx = disp.transaction as any;
    const prodTitle = tx?.auction?.title?.toLowerCase() || '';
    const buyerName = tx?.buyer?.username?.toLowerCase() || '';
    const sellerName = tx?.seller?.username?.toLowerCase() || '';
    const reasonText = disp.reason?.toLowerCase() || '';
    return (
      prodTitle.includes(q) ||
      buyerName.includes(q) ||
      sellerName.includes(q) ||
      reasonText.includes(q) ||
      disp.id.toLowerCase().includes(q)
    );
  });

  const paginatedDisputes = filteredDisputes.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredDisputes.length / pageSize) || 1;

  const getStatusBadgeStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'open') return 'bg-red-50 border border-red-200 text-red-700';
    if (s === 'under_review') return 'bg-amber-50 border border-amber-200 text-amber-700';
    if (s === 'resolved_buyer') return 'bg-emerald-50 border border-emerald-200 text-emerald-700';
    if (s === 'resolved_seller') return 'bg-blue-50 border border-blue-200 text-blue-700';
    return 'bg-stone-100 border border-stone-200 text-stone-600';
  };

  return (
    <View className="flex-1 bg-stone-50 p-6">
      {/* Title */}
      <View className="mb-6">
        <Text className="text-2xl font-display font-extrabold text-brand-text">
          Transaction Disputes
        </Text>
        <Text className="text-xs font-display text-brand-muted mt-0.5">
          Moderate buyer/seller transaction issues, review evidence, and rule resolutions
        </Text>
      </View>

      {/* Search and Filters panel */}
      <View className="bg-white border border-stone-200 p-4 rounded-3xl shadow-sm mb-6 gap-4">
        {/* Search */}
        <View className="flex-row items-center bg-stone-150 border border-stone-200 rounded-xl px-3 h-10">
          <Search size={16} color="#7F8C8D" className="mr-2" />
          <TextInput
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setPage(0);
            }}
            placeholder="Search by buyer, seller, product, reason or ID..."
            placeholderTextColor="#94A3B8"
            className="flex-1 h-full text-xs font-display text-brand-text"
          />
        </View>

        {/* Filter Tabs */}
        <View className="flex-row items-center justify-between flex-wrap gap-2">
          <Text className="text-xs font-display font-bold text-brand-text">Filter Status:</Text>
          <View className="flex-row bg-stone-100 rounded-xl p-1 flex-wrap">
            {([
              { label: 'All', value: 'all' },
              { label: 'Open', value: 'open' },
              { label: 'Under Review', value: 'under_review' },
              { label: 'Resolved Buyer', value: 'resolved_buyer' },
              { label: 'Resolved Seller', value: 'resolved_seller' },
              { label: 'Cancelled', value: 'cancelled' },
            ] as const).map((tab) => {
              const isActive = statusFilter === tab.value;
              return (
                <Pressable
                  key={tab.value}
                  onPress={() => {
                    setStatusFilter(tab.value);
                    setPage(0);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg items-center ${isActive ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                >
                  <Text className={`text-[9px] font-display font-bold ${isActive ? 'text-brand-text' : 'text-brand-muted'}`}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Table grid */}
      <View className="flex-1 bg-white border border-stone-200 rounded-3xl shadow-sm overflow-hidden mb-4">
        {loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#FF6B35" />
          </View>
        ) : paginatedDisputes.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-6">
            <ShieldAlert size={48} color="#BDC3C7" className="mb-3" />
            <Text className="text-base font-display font-bold text-brand-text">No Disputes Registered</Text>
            <Text className="text-xs font-display text-brand-muted text-center mt-1 leading-relaxed">
              No disputes found with the selected criteria.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="min-w-full">
              {/* Header */}
              <View className="flex-row border-b border-stone-200 bg-stone-50/50 px-5 py-3">
                <Text className="w-48 font-display font-bold text-[10px] text-brand-muted uppercase">Product Title</Text>
                <Text className="w-36 font-display font-bold text-[10px] text-brand-muted uppercase">Reason</Text>
                <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Buyer</Text>
                <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Seller</Text>
                <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Status</Text>
                <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Created</Text>
                <Text className="w-24 font-display font-bold text-[10px] text-brand-muted uppercase text-right">Actions</Text>
              </View>

              {/* Rows list */}
              <ScrollView className="flex-1">
                {paginatedDisputes.map((item) => {
                  const tx = item.transaction as any;
                  return (
                    <View key={item.id} className="flex-row items-center border-b border-stone-100 px-5 py-3.5">
                      {/* Product Title */}
                      <Text className="w-48 font-display font-bold text-brand-text text-xs" numberOfLines={1}>
                        {tx?.auction?.title || 'Unknown Listing'}
                      </Text>

                      {/* Reason */}
                      <Text className="w-36 font-display text-brand-text text-xs" numberOfLines={1}>
                        {item.reason}
                      </Text>

                      {/* Buyer */}
                      <Text className="w-32 font-display text-brand-text text-xs">
                        @{tx?.buyer?.username || 'buyer'}
                      </Text>

                      {/* Seller */}
                      <Text className="w-32 font-display text-brand-text text-xs">
                        @{tx?.seller?.username || 'seller'}
                      </Text>

                    {/* Status */}
                    <View className="w-32">
                      <View className={`self-start px-2.5 py-0.5 rounded-full ${getStatusBadgeStyle(item.status)}`}>
                        <Text className="text-[8px] font-display font-bold uppercase text-inherit">
                          {item.status.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>

                    {/* Created */}
                    <Text className="w-32 font-display text-brand-muted text-xs">
                      {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>

                    {/* Actions */}
                    <Pressable
                      onPress={() => router.push(`/admin/disputes/${item.id}` as any)}
                      className="w-24 flex-row items-center justify-end gap-1.5 active:opacity-75"
                    >
                      <Text className="text-brand-primary font-display font-bold text-xs">Manage</Text>
                      <ArrowUpRight size={12} color="#FF6B35" />
                    </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Pagination */}
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
