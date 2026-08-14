import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Search, ShoppingBag, Trash2, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { getAdminListings, updateListingStatus } from '@/services/adminService';
import { Button } from '@/components/ui/Button';

export default function AdminListingsScreen() {
  const params = useLocalSearchParams<{ search?: string }>();

  const [search, setSearch] = useState(params.search || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'removed'>('all');
  const [listings, setListings] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modal states for listing removal
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState('');

  const pageSize = 20;

  const loadListings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, count: total } = await getAdminListings(search, statusFilter, pageSize, page * pageSize);
      setListings(data);
      setCount(total);
    } catch (err) {
      console.error('Error loading admin listings list:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    setPage(0);
  };

  const handleStatusFilterChange = (val: 'all' | 'active' | 'removed') => {
    setStatusFilter(val);
    setPage(0);
  };

  const openRemoveDialog = (productId: string) => {
    setSelectedProductId(productId);
    setShowRemoveModal(true);
  };

  const handleRemoveListing = async () => {
    if (!selectedProductId || !removeReason.trim()) {
      Alert.alert('Reason Required', 'Please enter a justification for removing this listing.');
      return;
    }
    try {
      setUpdating(true);
      await updateListingStatus(selectedProductId, 'removed', removeReason.trim());
      setListings((prev) =>
        prev.map((item) =>
          item.id === selectedProductId ? { ...item, moderation_status: 'removed' } : item
        )
      );
      setShowRemoveModal(false);
      setRemoveReason('');
      Alert.alert('Success', 'Listing removed successfully.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to remove listing.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRestoreListing = async (productId: string) => {
    Alert.alert(
      'Restore Listing',
      'Are you sure you want to restore this listing to the marketplace?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Listing',
          onPress: async () => {
            try {
              setUpdating(true);
              await updateListingStatus(productId, 'active', 'Restored by administrator');
              setListings((prev) =>
                prev.map((item) =>
                  item.id === productId ? { ...item, moderation_status: 'active' } : item
                )
              );
              Alert.alert('Success', 'Listing restored successfully.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Unable to restore listing.');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  const totalPages = Math.ceil(count / pageSize) || 1;

  return (
    <View className="flex-1 bg-stone-50 p-6">
      {/* Title */}
      <View className="mb-6">
        <Text className="text-2xl font-display font-extrabold text-brand-text">
          Marketplace Listings
        </Text>
        <Text className="text-xs font-display text-brand-muted mt-0.5">
          Moderate active product listings and verify compliance
        </Text>
      </View>

      {/* Filter panel */}
      <View className="bg-white border border-stone-200 p-4 rounded-3xl shadow-sm mb-6 flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search bar */}
        <View className="flex-1 w-full bg-stone-50 border border-stone-200 px-4 h-11 rounded-xl flex-row items-center gap-2">
          <Search size={16} color="#7F8C8D" />
          <TextInput
            placeholder="Search by product title..."
            value={search}
            onChangeText={handleSearchChange}
            className="flex-1 h-full text-xs font-display text-brand-text p-0 m-0 bg-transparent"
          />
        </View>

        {/* Status filters */}
        <View className="flex-row bg-stone-100 rounded-xl p-1 w-full md:w-auto self-stretch md:self-auto">
          {(['all', 'active', 'removed'] as const).map((tab) => {
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
        ) : listings.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20 px-6">
            <ShoppingBag size={48} color="#BDC3C7" className="mb-3" />
            <Text className="text-base font-display font-bold text-brand-text">No Listings Found</Text>
            <Text className="text-xs font-display text-brand-muted text-center mt-1 leading-relaxed">
              No product listings matched your search criteria.
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="min-w-full">
              {/* Header */}
              <View className="flex-row border-b border-stone-200 bg-stone-50/50 px-5 py-3">
                <Text className="w-56 font-display font-bold text-[10px] text-brand-muted uppercase">Listing Title</Text>
                <Text className="w-48 font-display font-bold text-[10px] text-brand-muted uppercase">Seller</Text>
                <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Starting Price</Text>
                <Text className="w-32 font-display font-bold text-[10px] text-brand-muted uppercase">Moderation</Text>
                <Text className="w-36 font-display font-bold text-[10px] text-brand-muted uppercase">Created Date</Text>
                <Text className="w-48 font-display font-bold text-[10px] text-brand-muted uppercase text-right">Actions</Text>
              </View>

              {/* Rows */}
              <ScrollView className="flex-1">
                {listings.map((item) => (
                  <View key={item.id} className="flex-row items-center border-b border-stone-100 px-5 py-3.5">
                    {/* Title */}
                    <Text className="w-56 font-display font-bold text-brand-text text-xs" numberOfLines={1}>
                      {item.title}
                    </Text>

                    {/* Seller */}
                    <Text className="w-48 font-display text-brand-text text-xs">
                      @{item.seller?.username || 'user'}
                    </Text>

                    {/* Price */}
                    <Text className="w-32 font-display text-brand-text text-xs font-semibold">
                      ₹{Number(item.starting_price).toLocaleString('en-IN')}
                    </Text>

                    {/* Moderation */}
                    <View className="w-32">
                      <View className={`self-start px-2.5 py-1 rounded-full ${item.moderation_status === 'removed' ? 'bg-red-50 border border-red-150' : 'bg-green-50 border border-green-150'}`}>
                        <Text className={`text-[9px] font-display font-bold uppercase ${item.moderation_status === 'removed' ? 'text-red-600' : 'text-green-600'}`}>
                          {item.moderation_status}
                        </Text>
                      </View>
                    </View>

                    {/* Created Date */}
                    <Text className="w-36 font-display text-brand-muted text-xs">
                      {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>

                    {/* Actions */}
                    <View className="w-48 flex-row items-center justify-end gap-2">
                      {item.moderation_status === 'removed' ? (
                        <Pressable
                          onPress={() => handleRestoreListing(item.id)}
                          disabled={updating}
                          className="flex-row items-center gap-1 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg active:bg-emerald-100"
                        >
                          <ShieldCheck size={11} color="#059669" />
                          <Text className="text-[10px] font-display font-bold text-emerald-700">Restore</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => openRemoveDialog(item.id)}
                          disabled={updating}
                          className="flex-row items-center gap-1 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg active:bg-red-100"
                        >
                          <Trash2 size={11} color="#E71D36" />
                          <Text className="text-[10px] font-display font-bold text-brand-error">Remove</Text>
                        </Pressable>
                      )}
                    </View>
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

      {/* Remove Confirmation Modal */}
      <Modal
        visible={showRemoveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRemoveModal(false)}
      >
        <Pressable 
          onPress={() => setShowRemoveModal(false)} 
          className="flex-1 bg-black/40 justify-center items-center px-6"
        >
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm gap-4">
            <View className="flex-row items-center gap-2">
              <AlertCircle size={18} color="#FF6B35" />
              <Text className="font-display font-extrabold text-brand-text text-sm">
                Remove Listing
              </Text>
            </View>

            <Text className="text-xs font-display text-brand-muted leading-relaxed">
              Please enter the reason for removing this listing. It will no longer be visible to consumer marketplace buyers.
            </Text>

            <TextInput
              placeholder="e.g. Prohibited item, spam listing, wrong category..."
              value={removeReason}
              onChangeText={setRemoveReason}
              maxLength={200}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 h-12 text-xs font-display text-brand-text"
            />

            <View className="flex-row gap-3 mt-1">
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setShowRemoveModal(false)}
                className="flex-1"
              />
              <Button
                label="Remove"
                onPress={handleRemoveListing}
                className="flex-1 bg-brand-error"
                disabled={updating}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
