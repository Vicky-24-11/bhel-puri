import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, AlertOctagon, ArrowUpRight } from 'lucide-react-native';
import { getAdminReports } from '@/services/adminService';

export default function AdminReportsScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reviewing' | 'resolved' | 'dismissed'>('all');
  const [reports, setReports] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const pageSize = 20;

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count: total } = await getAdminReports(statusFilter, pageSize, page * pageSize);
      setReports(data);
      setCount(total);
    } catch (err) {
      console.error('Error loading reports list:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleStatusFilterChange = (val: 'all' | 'pending' | 'reviewing' | 'resolved' | 'dismissed') => {
    setStatusFilter(val);
    setPage(0);
  };

  const totalPages = Math.ceil(count / pageSize) || 1;

  const getStatusBadgeStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'pending') return 'bg-red-50 border border-red-150 text-red-700';
    if (s === 'reviewing') return 'bg-amber-50 border border-amber-150 text-amber-700';
    if (s === 'resolved') return 'bg-emerald-50 border border-emerald-150 text-emerald-700';
    return 'bg-stone-100 border border-stone-200 text-stone-600';
  };

  return (
    <View className="flex-1 bg-stone-50 p-6">
      {/* Title */}
      <View className="mb-6">
        <Text className="text-2xl font-display font-extrabold text-brand-text">
          Safety Reports
        </Text>
        <Text className="text-xs font-display text-brand-muted mt-0.5">
          Process user reports and compliance reviews
        </Text>
      </View>

      {/* Filter panel */}
      <View className="bg-white border border-stone-200 p-4 rounded-3xl shadow-sm mb-6 flex-row gap-4 items-center justify-between">
        <Text className="text-xs font-display font-bold text-brand-text">Filter Status:</Text>
        <View className="flex-row bg-stone-100 rounded-xl p-1 flex-wrap">
          {(['all', 'pending', 'reviewing', 'resolved', 'dismissed'] as const).map((tab) => {
            const isActive = statusFilter === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => handleStatusFilterChange(tab)}
                className={`px-4 py-1.5 rounded-lg items-center ${isActive ? 'bg-white shadow-sm' : 'bg-transparent'}`}
              >
                <Text className={`text-[10px] font-display font-bold capitalize ${isActive ? 'text-brand-text' : 'text-brand-muted'}`}>
                  {tab === 'pending' ? 'Open' : tab}
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
        ) : reports.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-6">
            <AlertOctagon size={48} color="#BDC3C7" className="mb-3" />
            <Text className="text-base font-display font-bold text-brand-text">No Reports Found</Text>
            <Text className="text-xs font-display text-brand-muted text-center mt-1 leading-relaxed">
              No moderation reports found with the selected status.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="min-w-full">
              {/* Header */}
              <View className="flex-row border-b border-stone-200 bg-stone-50/50 px-5 py-3">
                <Text className="w-36 font-display font-bold text-[10px] text-brand-muted uppercase">Reason</Text>
                <Text className="w-48 font-display font-bold text-[10px] text-brand-muted uppercase">Reported User</Text>
                <Text className="w-48 font-display font-bold text-[10px] text-brand-muted uppercase">Listing Title</Text>
                <Text className="w-28 font-display font-bold text-[10px] text-brand-muted uppercase">Reporter</Text>
                <Text className="w-28 font-display font-bold text-[10px] text-brand-muted uppercase">Status</Text>
                <Text className="w-36 font-display font-bold text-[10px] text-brand-muted uppercase">Created Date</Text>
                <Text className="w-24 font-display font-bold text-[10px] text-brand-muted uppercase text-right">Actions</Text>
              </View>

              {/* Rows */}
              <ScrollView className="flex-1">
                {reports.map((item) => (
                  <View key={item.id} className="flex-row items-center border-b border-stone-100 px-5 py-3.5">
                    {/* Reason */}
                    <Text className="w-36 font-display font-bold text-brand-text text-xs capitalize" numberOfLines={1}>
                      {item.reason.replace('_', ' ')}
                    </Text>

                    {/* Reported User */}
                    <Text className="w-48 font-display text-brand-text text-xs" numberOfLines={1}>
                      {item.reported_user?.username ? `@${item.reported_user.username}` : '-'}
                    </Text>

                    {/* Listing Title */}
                    <Text className="w-48 font-display text-brand-text text-xs" numberOfLines={1}>
                      {item.auction?.title || '-'}
                    </Text>

                    {/* Reporter */}
                    <Text className="w-28 font-display text-brand-muted text-xs">
                      @{item.reporter?.username || 'reporter'}
                    </Text>

                    {/* Status */}
                    <View className="w-28">
                      <View className={`self-start px-2.5 py-0.5 rounded-full ${getStatusBadgeStyle(item.status)}`}>
                        <Text className="text-[8px] font-display font-bold uppercase text-inherit">
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    {/* Created Date */}
                    <Text className="w-36 font-display text-brand-muted text-xs">
                      {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>

                    {/* Actions */}
                    <Pressable
                      onPress={() => router.push(`/admin/reports/${item.id}` as any)}
                      className="w-24 flex-row items-center justify-end gap-1.5 active:opacity-75"
                    >
                      <Text className="text-brand-primary font-display font-bold text-xs">Review</Text>
                      <ArrowUpRight size={12} color="#FF6B35" />
                    </Pressable>
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
