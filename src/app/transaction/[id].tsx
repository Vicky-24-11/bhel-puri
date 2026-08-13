import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, MessageSquare, CheckCircle2, XCircle, Clock, ShieldCheck, User } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { getTransactionById, updateTransactionStatus, TransactionWithDetails } from '@/services/transactionService';
import { createAuctionConversation } from '@/services/chatService';
import { TransactionStatus } from '@/types/database.types';

export default function TransactionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [transaction, setTransaction] = useState<TransactionWithDetails | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load transaction and user details
  const loadDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch user profile
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (!user) {
        setError('Please sign in to view this transaction.');
        return;
      }

      // Fetch transaction details
      const tx = await getTransactionById(id);
      if (!tx) {
        setError('Transaction not found or you do not have permission to view it.');
        return;
      }

      // Assert access rights
      if (tx.seller_id !== user.id && tx.buyer_id !== user.id) {
        setError('Access denied. You are not a participant in this transaction.');
        return;
      }

      setTransaction(tx);
    } catch (err: any) {
      console.error('Error loading transaction screen details:', err);
      setError(err.message || 'Failed to load transaction.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Handle messaging redirect
  const handleContact = async () => {
    if (!transaction) return;
    try {
      setUpdating(true);
      const convId = await createAuctionConversation(transaction.auction_id);
      router.push(`/chat/${convId}`);
    } catch (err: any) {
      console.error('Error establishing chat conversation:', err);
      Alert.alert('Error', err.message || 'Unable to open conversation.');
    } finally {
      setUpdating(false);
    }
  };

  // Handle status update transitions
  const handleUpdateStatus = async (newStatus: TransactionStatus) => {
    if (!transaction) return;
    try {
      setUpdating(true);
      const updatedTx = await updateTransactionStatus(transaction.id, newStatus);
      if (updatedTx) {
        setTransaction((prev) => prev ? { ...prev, status: updatedTx.status } : null);
        Alert.alert('Success', `Transaction status updated to ${newStatus}.`);
      }
    } catch (err: any) {
      console.error('Error transitioning status:', err);
      Alert.alert('Transition Refused', err.message || 'Unable to update status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-brand-background justify-center items-center">
        <ActivityIndicator size="large" color="#FF6B35" />
      </SafeAreaView>
    );
  }

  if (error || !transaction) {
    return (
      <SafeAreaView className="flex-1 bg-brand-background px-5 justify-center items-center">
        <XCircle size={48} color="#E74C3C" className="mb-4" />
        <Text className="text-lg font-display font-bold text-brand-text text-center mb-2">
          {error || 'An error occurred'}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="px-6 py-3 bg-brand-text rounded-2xl active:opacity-90 mt-2"
        >
          <Text className="text-white font-display font-bold">Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isSeller = transaction.seller_id === currentUser?.id;
  const partnerProfile = isSeller ? transaction.buyer : transaction.seller;
  const isPending = transaction.status === 'pending';
  const isContacted = transaction.status === 'contacted';
  const isCompleted = transaction.status === 'completed';
  const isCancelled = transaction.status === 'cancelled';

  // Get primary listing image or fallback
  const getProductImage = () => {
    if (transaction.auction?.images && transaction.auction.images.length > 0) {
      const path = transaction.auction.images[0].storage_path;
      return { uri: `${supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl}` };
    }
    return require('@/assets/images/icon.png');
  };

  const getStatusBadge = () => {
    switch (transaction.status) {
      case 'pending':
        return (
          <View className="flex-row items-center bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full gap-1">
            <Clock size={14} color="#D97706" />
            <Text className="text-xs font-display font-bold text-amber-700 capitalize">Awaiting Contact</Text>
          </View>
        );
      case 'contacted':
        return (
          <View className="flex-row items-center bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full gap-1">
            <MessageSquare size={14} color="#2563EB" />
            <Text className="text-xs font-display font-bold text-blue-700 capitalize">In Communication</Text>
          </View>
        );
      case 'completed':
        return (
          <View className="flex-row items-center bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full gap-1">
            <CheckCircle2 size={14} color="#059669" />
            <Text className="text-xs font-display font-bold text-emerald-700 capitalize">Completed</Text>
          </View>
        );
      case 'cancelled':
        return (
          <View className="flex-row items-center bg-stone-100 border border-stone-200 px-3 py-1.5 rounded-full gap-1">
            <XCircle size={14} color="#6B7280" />
            <Text className="text-xs font-display font-bold text-stone-600 capitalize">Cancelled</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header */}
      <View className="px-5 pt-3 pb-3 flex-row items-center border-b border-stone-200 bg-white">
        <Pressable onPress={() => router.back()} className="mr-4 active:opacity-75">
          <ChevronLeft size={24} color="#1A1A1A" />
        </Pressable>
        <Text className="text-lg font-display font-extrabold text-brand-text flex-1">
          Transaction Details
        </Text>
        {getStatusBadge()}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="flex-1">
        <View className="w-full max-w-lg mx-auto p-5 gap-6">
          
          {/* Card 1: Listing Snippet */}
          <View className="bg-white rounded-3xl border border-stone-200 p-4 shadow-sm flex-row gap-4">
            <Image
              source={getProductImage()}
              className="w-20 h-20 rounded-2xl bg-stone-100"
              resizeMode="cover"
            />
            <View className="flex-1 justify-center">
              <Text className="text-base font-display font-bold text-brand-text mb-1" numberOfLines={2}>
                {transaction.auction?.title}
              </Text>
              <Text className="text-xs font-display text-brand-muted mb-2">
                Auction ID: {transaction.auction_id.slice(0, 8)}
              </Text>
              <View className="flex-row items-baseline gap-1">
                <Text className="text-xs font-display text-brand-muted">Winning Price:</Text>
                <Text className="text-lg font-display font-extrabold text-brand-primary">
                  ₹{Number(transaction.amount).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>

          {/* Card 2: Contact Info */}
          <View className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm gap-4">
            <Text className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
              {isSeller ? 'Buyer Details' : 'Seller Details'}
            </Text>
            
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 rounded-full bg-brand-primary/10 items-center justify-center">
                {partnerProfile?.avatar_url ? (
                  <Image source={{ uri: partnerProfile.avatar_url }} className="w-12 h-12 rounded-full" />
                ) : (
                  <User size={20} color="#FF6B35" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-base font-display font-bold text-brand-text">
                  {partnerProfile?.full_name || 'Bhel Puri User'}
                </Text>
                <Text className="text-xs font-display text-brand-muted">
                  @{partnerProfile?.username || 'user'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleContact}
              disabled={updating}
              className="w-full h-12 bg-brand-primary rounded-2xl flex-row items-center justify-center gap-2 active:opacity-90"
            >
              <MessageSquare size={18} color="#FFFFFF" />
              <Text className="text-white font-display font-bold text-sm">
                {isSeller ? 'Message Buyer' : 'Message Seller'}
              </Text>
            </Pressable>
          </View>

          {/* Card 3: Status Transitions */}
          {!isCompleted && !isCancelled && (
            <View className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm gap-4">
              <Text className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
                Update Status
              </Text>
              
              <Text className="text-xs font-display text-brand-muted leading-relaxed">
                Confirm steps taken to complete this exchange. Once marked completed, the transaction is locked.
              </Text>

              <View className="gap-2">
                {isPending && (
                  <Pressable
                    onPress={() => handleUpdateStatus('contacted')}
                    disabled={updating}
                    className="w-full h-11 border border-blue-200 bg-blue-50/50 rounded-xl items-center justify-center active:bg-blue-50"
                  >
                    <Text className="text-blue-700 font-display font-bold text-sm">
                      Mark as Contacted
                    </Text>
                  </Pressable>
                )}

                {isContacted && (
                  <Pressable
                    onPress={() => handleUpdateStatus('completed')}
                    disabled={updating}
                    className="w-full h-11 border border-emerald-200 bg-emerald-50/50 rounded-xl items-center justify-center active:bg-emerald-50"
                  >
                    <Text className="text-emerald-700 font-display font-bold text-sm">
                      Mark as Completed (Sale Done)
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => {
                    Alert.alert(
                      'Cancel Transaction',
                      'Are you sure you want to cancel this transaction?',
                      [
                        { text: 'No', style: 'cancel' },
                        { text: 'Yes, Cancel', style: 'destructive', onPress: () => handleUpdateStatus('cancelled') }
                      ]
                    );
                  }}
                  disabled={updating}
                  className="w-full h-11 border border-stone-200 bg-stone-50 rounded-xl items-center justify-center active:bg-stone-100"
                >
                  <Text className="text-stone-600 font-display font-bold text-sm">
                    Cancel Transaction
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Card 4: Safe Exchange Guidelines */}
          <View className="bg-stone-50 border border-stone-200 rounded-3xl p-5 gap-3">
            <View className="flex-row items-center gap-2">
              <ShieldCheck size={18} color="#FF6B35" />
              <Text className="text-sm font-display font-bold text-brand-text">
                Safe Trading Guidelines
              </Text>
            </View>
            <Text className="text-xs font-display text-brand-muted leading-relaxed">
              {"• Arrange transactions in well-lit, public spaces.\n• Confirm receipt and inspect items before releasing any cash/offline payment.\n• Update the status in-app to build your profile rating and trust history."}
            </Text>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
