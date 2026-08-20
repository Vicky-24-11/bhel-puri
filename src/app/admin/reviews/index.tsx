import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Star, Search, ArrowUpRight } from 'lucide-react-native';
import { getAdminReviews } from '@/services/adminService';

export default function AdminReviewsScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const pageSize = 15;

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAdminReviews(statusFilter);
      setReviews(data);
    } catch (err) {
      console.error('Error loading admin reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const filteredReviews = reviews.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const reviewerName = item.reviewer?.username?.toLowerCase() || '';
    const revieweeName = item.reviewee?.username?.toLowerCase() || '';
    const auctionTitle = item.auction?.title?.toLowerCase() || '';
    const commentText = item.comment?.toLowerCase() || '';
    return (
      reviewerName.includes(q) ||
      revieweeName.includes(q) ||
      auctionTitle.includes(q) ||
      commentText.includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  });

  const paginatedReviews = filteredReviews.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredReviews.length / pageSize) || 1;

  const getStatusBadgeStyle = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'published') return 'bg-emerald-50 border border-emerald-200 text-emerald-700';
    if (s === 'hidden') return 'bg-amber-50 border border-amber-200 text-amber-700';
    if (s === 'removed') return 'bg-red-50 border border-red-200 text-red-700';
    return 'bg-stone-100 border border-stone-200 text-stone-600';
  };

  return (
    <View className="flex-1 bg-stone-50 p-6">
      {/* Title */}
      <View className="mb-6">
        <Text className="text-2xl font-display font-extrabold text-brand-text">
          Transaction Reviews Moderation
        </Text>
        <Text className="text-xs font-display text-brand-muted mt-0.5">
          Monitor user ratings, examine written reviews, and handle guidelines enforcement
        </Text>
      </View>

      {/* Filters panel */}
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
            placeholder="Search by reviewer, reviewee, listing title or review text..."
            placeholderTextColor="#94A3B8"
            className="flex-1 h-full text-xs font-display text-brand-text"
          />
        </View>

        {/* Filters */}
        <View className="flex-row items-center justify-between flex-wrap gap-2">
          <Text className="text-xs font-display font-bold text-brand-text">Filter Status:</Text>
          <View className="flex-row bg-stone-100 rounded-xl p-1 flex-wrap">
            {([
              { label: 'All', value: 'all' },
              { label: 'Published', value: 'published' },
              { label: 'Hidden', value: 'hidden' },
              { label: 'Removed', value: 'removed' },
            ] as const).map((tab) => {
              const isActive = statusFilter === tab.value;
              return (
                <Pressable
                  key={tab.value}
                  onPress={() => {
                    setStatusFilter(tab.value);
                    setPage(0);
                  }}
                  className={`px-4 py-1.5 rounded-lg items-center ${isActive ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                >
                  <Text className={`text-[10px] font-display font-bold ${isActive ? 'text-brand-text' : 'text-brand-muted'}`}>
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
        ) : paginatedReviews.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-6">
            <Star size={48} color="#BDC3C7" className="mb-3" />
            <Text className="text-base font-display font-bold text-brand-text">No Reviews Found</Text>
            <Text className="text-xs font-display text-brand-muted text-center mt-1 leading-relaxed">
              No reviews registered matching the chosen filter.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="min-w-full">
              {/* Header */}
              <View className="flex-row border-b border-stone-200 bg-stone-50/50 px-5 py-3">
                <Text className="w-48 font-display font-bold text-[10px] text-brand-muted uppercase">Listing Title</Text>
                <Text className="w-24 font-display font-bold text-[10px] text-brand-muted uppercase">Rating</Text>
                <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Reviewer</Text>
                <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Reviewee</Text>
                <Text className="w-64 font-display font-bold text-[10px] text-brand-muted uppercase">Comment</Text>
                <Text className="w-28 font-display font-bold text-[10px] text-brand-muted uppercase">Status</Text>
                <Text className="w-28 font-display font-bold text-[10px] text-brand-muted uppercase text-right">Actions</Text>
              </View>

              {/* Rows */}
              <ScrollView className="flex-1">
                {paginatedReviews.map((item) => (
                  <View key={item.id} className="flex-row items-center border-b border-stone-100 px-5 py-3.5">
                    {/* Listing Title */}
                    <Text className="w-48 font-display font-bold text-brand-text text-xs" numberOfLines={1}>
                      {item.auction?.title || 'Unknown Listing'}
                    </Text>

                    {/* Rating */}
                    <View className="w-24 flex-row items-center gap-1">
                      <Star size={12} color="#F59E0B" fill="#F59E0B" />
                      <Text className="font-display font-bold text-xs text-brand-text">
                        {item.rating_value}.0
                      </Text>
                    </View>

                    {/* Reviewer */}
                    <Text className="w-32 font-display text-brand-text text-xs">
                      @{item.reviewer?.username || 'user'}
                    </Text>

                    {/* Reviewee */}
                    <Text className="w-32 font-display text-brand-text text-xs">
                      @{item.reviewee?.username || 'user'}
                    </Text>

                    {/* Comment */}
                    <Text className="w-64 font-display text-brand-muted text-xs" numberOfLines={1}>
                      {item.comment || '(No written review)'}
                    </Text>

                    {/* Status */}
                    <View className="w-28">
                      <View className={`self-start px-2.5 py-0.5 rounded-full ${getStatusBadgeStyle(item.status)}`}>
                        <Text className="text-[8px] font-display font-bold uppercase text-inherit">
                          {item.status}
                        </Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <Pressable
                      onPress={() => router.push(`/admin/reviews/${item.id}` as any)}
                      className="w-28 flex-row items-center justify-end gap-1.5 active:opacity-75"
                    >
                      <Text className="text-brand-primary font-display font-bold text-xs">Moderate</Text>
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
