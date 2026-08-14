import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { ChevronLeft, ChevronRight, Gavel, RefreshCw } from 'lucide-react-native';
import { getAdminAuctions } from '@/services/adminService';

export default function AdminAuctionsScreen() {
  const [typeFilter, setTypeFilter] = useState<'all' | 'forward' | 'reverse'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'completed' | 'ended' | 'cancelled'>('all');
  const [auctions, setAuctions] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const pageSize = 20;

  const loadAuctions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count: total } = await getAdminAuctions(typeFilter, statusFilter, pageSize, page * pageSize);
      setAuctions(data);
      setCount(total);
    } catch (err) {
      console.error('Error loading admin auctions list:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, page]);

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  const handleTypeChange = (val: 'all' | 'forward' | 'reverse') => {
    setTypeFilter(val);
    setPage(0);
  };

  const handleStatusChange = (val: 'all' | 'live' | 'completed' | 'ended' | 'cancelled') => {
    setStatusFilter(val);
    setPage(0);
  };

  const totalPages = Math.ceil(count / pageSize) || 1;

  const getStatusBadgeStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'live') return 'bg-amber-50 border border-amber-150 text-amber-700';
    if (s === 'completed') return 'bg-emerald-50 border border-emerald-150 text-emerald-700';
    if (s === 'cancelled') return 'bg-stone-100 border border-stone-200 text-stone-600';
    return 'bg-blue-50 border border-blue-150 text-blue-700';
  };

  return (
    <View className="flex-1 bg-stone-50 p-6">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            Auctions Audit
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            Read-only registry of marketplace bidding operations
          </Text>
        </View>

        <Pressable
          onPress={loadAuctions}
          className="flex-row items-center gap-1.5 px-4.5 py-2.5 bg-white border border-stone-200 rounded-xl active:bg-stone-50 shadow-sm"
        >
          <RefreshCw size={14} color="#FF6B35" />
          <Text className="text-brand-primary font-display font-bold text-xs">Refresh</Text>
        </Pressable>
      </View>

      {/* Filter panel */}
      <View className="bg-white border border-stone-200 p-4 rounded-3xl shadow-sm mb-6 gap-4">
        {/* Type select */}
        <View className="flex-row items-center gap-3">
          <Text className="text-xs font-display font-bold text-brand-text w-24">Auction Type:</Text>
          <View className="flex-row bg-stone-100 rounded-xl p-1">
            {(['all', 'forward', 'reverse'] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => handleTypeChange(tab)}
                className={`px-4 py-1.5 rounded-lg items-center ${typeFilter === tab ? 'bg-white shadow-sm' : 'bg-transparent'}`}
              >
                <Text className={`text-[10px] font-display font-bold capitalize ${typeFilter === tab ? 'text-brand-text' : 'text-brand-muted'}`}>
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Status select */}
        <View className="flex-row items-center gap-3">
          <Text className="text-xs font-display font-bold text-brand-text w-24">Status:</Text>
          <View className="flex-row bg-stone-100 rounded-xl p-1 flex-wrap">
            {(['all', 'live', 'completed', 'ended', 'cancelled'] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => handleStatusChange(tab)}
                className={`px-4 py-1.5 rounded-lg items-center ${statusFilter === tab ? 'bg-white shadow-sm' : 'bg-transparent'}`}
              >
                <Text className={`text-[10px] font-display font-bold capitalize ${statusFilter === tab ? 'text-brand-text' : 'text-brand-muted'}`}>
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* Table */}
      <View className="flex-1 bg-white border border-stone-200 rounded-3xl shadow-sm overflow-hidden mb-4">
        {loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#FF6B35" />
          </View>
        ) : auctions.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-6">
            <Gavel size={48} color="#BDC3C7" className="mb-3" />
            <Text className="text-base font-display font-bold text-brand-text">No Auctions Found</Text>
            <Text className="text-xs font-display text-brand-muted text-center mt-1 leading-relaxed">
              No auctions fit the current search filters.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="min-w-full">
              {/* Header */}
              <View className="flex-row border-b border-stone-200 bg-stone-50/50 px-5 py-3">
                <Text className="w-56 font-display font-bold text-[10px] text-brand-muted uppercase">Listing Title</Text>
                <Text className="w-40 font-display font-bold text-[10px] text-brand-muted uppercase">Seller</Text>
                <Text className="w-28 font-display font-bold text-[10px] text-brand-muted uppercase">Type</Text>
                <Text className="w-28 font-display font-bold text-[10px] text-brand-muted uppercase">Status</Text>
                <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Current Price</Text>
                <Text className="w-40 font-display font-bold text-[10px] text-brand-muted uppercase">Winner</Text>
                <Text className="w-40 font-display font-bold text-[10px] text-brand-muted uppercase">Ends At</Text>
              </View>

              {/* Rows */}
              <ScrollView className="flex-1">
                {auctions.map((item) => (
                  <View key={item.id} className="flex-row items-center border-b border-stone-100 px-5 py-3.5">
                    {/* Title */}
                    <Text className="w-56 font-display font-bold text-brand-text text-xs" numberOfLines={1}>
                      {item.title}
                    </Text>

                    {/* Seller */}
                    <Text className="w-40 font-display text-brand-text text-xs">
                      @{item.seller?.username || 'user'}
                    </Text>

                    {/* Type */}
                    <Text className="w-28 font-display text-brand-text text-xs capitalize font-semibold">
                      {item.auction_type}
                    </Text>

                    {/* Status */}
                    <View className="w-28">
                      <View className={`self-start px-2 py-0.5 rounded-full ${getStatusBadgeStyle(item.status)}`}>
                        <Text className="text-[8px] font-display font-bold uppercase text-inherit">
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    {/* Price */}
                    <Text className="w-32 font-display text-brand-text text-xs font-semibold">
                      ₹{Number(item.current_price).toLocaleString('en-IN')}
                    </Text>

                    {/* Winner */}
                    <Text className="w-40 font-display text-brand-muted text-xs">
                      {item.winner?.username ? `@${item.winner.username}` : 'No winner'}
                    </Text>

                    {/* Ends At */}
                    <Text className="w-40 font-display text-brand-muted text-xs">
                      {new Date(item.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))}
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
