import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, MessageSquare, CheckCircle2, XCircle, Clock, ShieldCheck, User, ShieldAlert, FileText } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { getTransactionById, updateTransactionStatus, TransactionWithDetails } from '@/services/transactionService';
import { createAuctionConversation } from '@/services/chatService';
import { TransactionStatus, Dispute } from '@/types/database.types';
import { getDisputeByTransactionId, getDisputeEvidence, getSignedEvidenceUrl, getTransactionEvents, getDisputeEvents } from '@/services/disputeService';
import { getRatingByReviewer } from '@/services/ratingService';
import { LeaveReviewModal } from '@/components/ui/LeaveReviewModal';

export default function TransactionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [transaction, setTransaction] = useState<TransactionWithDetails | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dispute & Timeline State
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);

  // Rating & Review State
  const [hasRated, setHasRated] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);

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

      // Check if user has already rated this transaction
      const ratingExists = await getRatingByReviewer(tx.auction_id, user.id);
      setHasRated(!!ratingExists);

      // Fetch Dispute Info if any
      const disp = await getDisputeByTransactionId(tx.id);
      setDispute(disp);

      if (disp) {
        // Resolve Signed URLs for private evidence
        const evidence = await getDisputeEvidence(disp.id);
        const urls = await Promise.all(
          evidence.map((ev) => getSignedEvidenceUrl(ev.storage_path))
        );
        setEvidenceUrls(urls.filter((url): url is string => url !== null));
      }

      // Fetch Audit Trails
      const txEvts = await getTransactionEvents(tx.id);
      const dispEvts = disp ? await getDisputeEvents(disp.id) : [];

      // Combine and sort events by timestamp
      const combined = [
        ...txEvts.map((e) => ({ ...e, type: 'transaction' })),
        ...dispEvts.map((e) => ({ ...e, type: 'dispute' })),
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setTimelineEvents(combined);
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
        loadDetails(); // Reload timeline
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

  const formatEventText = (evt: any) => {
    if (evt.type === 'transaction') {
      if (evt.event_type === 'transaction_created') {
        return `Transaction record generated in pending state`;
      }
      return `Transaction status changed from "${evt.from_status}" to "${evt.to_status}"`;
    } else {
      if (evt.event_type === 'dispute_created') {
        return `Dispute opened for reason: "${evt.metadata?.reason}"`;
      }
      return `Support updated dispute status to "${evt.metadata?.to_status}"`;
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

          {/* Card 3: Active Dispute Details Panel */}
          {dispute ? (
            <View className="bg-white rounded-3xl border border-red-200 p-5 shadow-sm gap-4">
              <View className="flex-row items-center gap-2">
                <ShieldAlert size={18} color="#E74C3C" />
                <Text className="text-sm font-display font-bold text-brand-text">
                  Dispute Case File
                </Text>
              </View>
              <View className="gap-2 bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <View className="flex-row justify-between">
                  <Text className="text-xs font-display text-brand-muted">Reason:</Text>
                  <Text className="text-xs font-display font-bold text-brand-text">{dispute.reason}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs font-display text-brand-muted">Status:</Text>
                  <Text className="text-xs font-display font-bold text-brand-text capitalize">{dispute.status.replace('_', ' ')}</Text>
                </View>
                <View className="mt-2 border-t border-stone-200 pt-2">
                  <Text className="text-xs font-display text-brand-muted">Explanation:</Text>
                  <Text className="text-xs font-display text-brand-text mt-1 leading-relaxed">{dispute.description}</Text>
                </View>
                {dispute.resolution && (
                  <View className="mt-2 border-t border-red-200 pt-2">
                    <Text className="text-xs font-display text-red-600 font-bold">Resolution Decision:</Text>
                    <Text className="text-xs font-display text-brand-text mt-1 leading-relaxed">{dispute.resolution}</Text>
                    {dispute.resolution_note && (
                      <Text className="text-xs font-display text-brand-muted mt-1 leading-relaxed">Note: {dispute.resolution_note}</Text>
                    )}
                  </View>
                )}
              </View>
              {evidenceUrls.length > 0 && (
                <View className="gap-2">
                  <Text className="text-xs font-display font-bold text-brand-text">Evidence Photos:</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {evidenceUrls.map((url, index) => (
                      <Image
                        key={index}
                        source={{ uri: url }}
                        className="w-16 h-16 rounded-xl bg-stone-100"
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* Open Dispute Button */
            !isCompleted && !isCancelled && (
              <View className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm gap-3">
                <Text className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
                  Transaction Protection
                </Text>
                <Text className="text-xs font-display text-brand-muted leading-relaxed">
                  Experiencing issues with the exchange? File a dispute with support to register proof.
                </Text>
                <Pressable
                  onPress={() => router.push(`/transaction/dispute?txId=${transaction.id}` as any)}
                  className="w-full h-11 border border-red-200 bg-red-50/50 rounded-xl items-center justify-center active:bg-red-50"
                >
                  <Text className="text-red-600 font-display font-bold text-sm">
                    Report an Issue / File Dispute
                  </Text>
                </Pressable>
              </View>
            )
          )}

          {/* Card 4: Audit Event Logs Timeline */}
          {timelineEvents.length > 0 && (
            <View className="bg-white rounded-3xl border border-stone-200 p-5 shadow-sm gap-4">
              <Text className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
                Transaction Audit Log
              </Text>
              <View className="gap-4">
                {timelineEvents.map((evt, idx) => (
                  <View key={evt.id} className="flex-row gap-3">
                    <View className="items-center">
                      <View className="w-6 h-6 rounded-full bg-brand-primary/10 items-center justify-center">
                        <FileText size={12} color="#FF6B35" />
                      </View>
                      {idx !== timelineEvents.length - 1 && (
                        <View className="w-0.5 bg-stone-200 flex-1 my-1" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-display font-bold text-brand-text">
                        {formatEventText(evt)}
                      </Text>
                      <Text className="text-[10px] font-display text-brand-muted mt-0.5">
                        {new Date(evt.created_at).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Card 5: Status Transitions */}
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

          {/* Card 6: Safe Exchange Guidelines */}
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

          {/* Card 7: Transaction Review Card */}
          {isCompleted && (
            <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-3">
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={18} color="#FF6B35" />
                <Text className="text-sm font-display font-bold text-brand-text">
                  Transaction Review
                </Text>
              </View>
              {hasRated ? (
                <Text className="text-xs font-display text-emerald-600 font-bold leading-relaxed">
                  ✓ You have submitted feedback for this transaction. Thank you for building marketplace trust!
                </Text>
              ) : (
                <View className="gap-3">
                  <Text className="text-xs font-display text-brand-muted leading-relaxed">
                    Share your feedback to help other buyers and sellers make safe trades.
                  </Text>
                  <Pressable
                    onPress={() => setShowReviewModal(true)}
                    className="w-full h-11 bg-brand-primary rounded-xl items-center justify-center active:opacity-95"
                  >
                    <Text className="text-white font-display font-bold text-sm">
                      Leave Rating & Review
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

        </View>
      </ScrollView>

      {transaction && currentUser && (
        <LeaveReviewModal
          visible={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSubmitSuccess={() => {
            setHasRated(true);
            loadDetails(); // Reload details and timeline
          }}
          transactionId={transaction.id}
          auctionId={transaction.auction_id}
          reviewerId={currentUser.id}
          revieweeId={isSeller ? transaction.buyer_id : transaction.seller_id}
          targetName={partnerProfile?.username || 'user'}
        />
      )}
    </SafeAreaView>
  );
}
