import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Award, FileText, CheckCircle, Scale, XCircle } from 'lucide-react-native';
import { Image } from 'expo-image';

import { getDisputeById, getDisputeEvidence, getSignedEvidenceUrl, getDisputeEvents, getTransactionEvents, resolveDispute } from '@/services/disputeService';
import { Dispute, DisputeEvent, TransactionEvent } from '@/types/database.types';

export default function AdminDisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [disputeEvents, setDisputeEvents] = useState<DisputeEvent[]>([]);
  const [transactionEvents, setTransactionEvents] = useState<TransactionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Form State
  const [resolutionText, setResolutionText] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  const loadDisputeData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getDisputeById(id);
      if (!data) {
        Alert.alert('Error', 'Dispute not found.');
        router.back();
        return;
      }
      setDispute(data);

      // Load evidence registry and URLs
      const evRegistry = await getDisputeEvidence(data.id);
      const urls = await Promise.all(
        evRegistry.map((item) => getSignedEvidenceUrl(item.storage_path))
      );
      setEvidenceUrls(urls.filter((url): url is string => url !== null));

      // Load events audit trails
      const dispEv = await getDisputeEvents(data.id);
      setDisputeEvents(dispEv);
      const txEv = await getTransactionEvents(data.transaction_id);
      setTransactionEvents(txEv);

      // Prefill fields
      setResolutionText(data.resolution || '');
      setResolutionNote(data.resolution_note || '');
    } catch (err) {
      console.error('Error fetching admin dispute details:', err);
      Alert.alert('Error', 'Failed to load case file details.');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadDisputeData();
  }, [loadDisputeData]);

  const handleAction = async (newStatus: Dispute['status']) => {
    if (!dispute) return;
    
    // Notes check for resolutions
    const cleanResolutionText = resolutionText.trim();
    const cleanNote = resolutionNote.trim();

    if (newStatus.startsWith('resolved') && !cleanResolutionText) {
      Alert.alert('Validation Error', 'Please supply a formal resolution text detailing your decision.');
      return;
    }

    try {
      setUpdating(true);
      const updated = await resolveDispute(dispute.id, newStatus, cleanNote, cleanResolutionText);
      if (updated) {
        Alert.alert('Success', `Dispute status updated to ${newStatus.replace('_', ' ')}.`);
        loadDisputeData(); // Reload details and events
      }
    } catch (err: any) {
      console.error('Error resolving dispute:', err);
      Alert.alert('Error', err.message || 'Failed to update dispute status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-stone-50">
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!dispute) return null;

  const isClosed = dispute.status.startsWith('resolved') || dispute.status === 'cancelled';

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
            Manage Dispute Case
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            ID: {dispute.id}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-6 items-start">
        {/* Left Column: Details & Evidence */}
        <View className="flex-1 min-w-[320px] gap-6">
          {/* Dispute Claim Snippet */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-4">
            <Text className="text-sm font-display font-bold text-brand-text">
              Dispute Statement
            </Text>
            <View className="gap-2 bg-stone-50 p-4 border border-stone-200 rounded-2xl">
              <View className="flex-row justify-between">
                <Text className="text-xs font-display text-brand-muted">Filer ID:</Text>
                <Text className="text-xs font-display font-bold text-brand-text">@{dispute.creator?.username || 'user'}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs font-display text-brand-muted">Reason Category:</Text>
                <Text className="text-xs font-display font-bold text-brand-text">{dispute.reason}</Text>
              </View>
              <View className="mt-2 border-t border-stone-200 pt-2">
                <Text className="text-xs font-display text-brand-muted font-bold">Filer Statement:</Text>
                <Text className="text-xs font-display text-brand-text mt-1 leading-relaxed">{dispute.description}</Text>
              </View>
            </View>
          </View>

          {/* Evidence Attachments */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-3">
            <Text className="text-sm font-display font-bold text-brand-text">
              Uploaded Evidence File Registry
            </Text>
            {evidenceUrls.length > 0 ? (
              <View className="flex-row flex-wrap gap-3">
                {evidenceUrls.map((url, idx) => (
                  <View key={idx} className="bg-stone-50 border border-stone-200 rounded-2xl overflow-hidden p-1.5">
                    <Image source={{ uri: url }} className="w-24 h-24 rounded-xl" contentFit="cover" />
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-xs font-display text-brand-muted italic">
                No visual evidence uploads were registered with this dispute.
              </Text>
            )}
          </View>

          {/* Transaction / Auction Reference */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-3">
            <Text className="text-sm font-display font-bold text-brand-text">
              Transaction Details & Amount
            </Text>
            <View className="bg-stone-50 p-4 border border-stone-200 rounded-2xl gap-2">
              <View className="flex-row justify-between">
                <Text className="text-xs font-display text-brand-muted">Amount Snapshot:</Text>
                <Text className="text-sm font-display font-extrabold text-brand-primary">₹{Number(dispute.transaction?.amount).toLocaleString('en-IN')}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs font-display text-brand-muted">Transaction ID:</Text>
                <Text className="text-xs font-display font-mono text-brand-text">{dispute.transaction_id}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs font-display text-brand-muted">Current status:</Text>
                <Text className="text-xs font-display font-bold text-brand-text capitalize">{dispute.transaction?.status}</Text>
              </View>
            </View>
          </View>

          {/* Audit Timeline logs */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-4">
            <Text className="text-sm font-display font-bold text-brand-text">
              Server Logs & Audit Trail
            </Text>
            
            {/* Transaction Events */}
            <View className="gap-2">
              <Text className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">Transaction Status Changes:</Text>
              {transactionEvents.map((evt) => (
                <View key={evt.id} className="flex-row items-start gap-2 bg-stone-50 p-3 rounded-xl border border-stone-150">
                  <FileText size={14} color="#7F8C8D" className="mt-0.5" />
                  <View className="flex-1">
                    <Text className="text-xs font-display font-semibold text-brand-text">
                      {evt.event_type === 'transaction_created' ? 'Transaction created' : `Status changed from "${evt.from_status}" to "${evt.to_status}"`}
                    </Text>
                    <Text className="text-[9px] font-display text-brand-muted mt-0.5">{new Date(evt.created_at).toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Dispute Events */}
            <View className="gap-2 mt-2">
              <Text className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">Dispute Audits:</Text>
              {disputeEvents.map((evt) => (
                <View key={evt.id} className="flex-row items-start gap-2 bg-stone-50 p-3 rounded-xl border border-stone-150">
                  <Scale size={14} color="#FF6B35" className="mt-0.5" />
                  <View className="flex-1">
                    <Text className="text-xs font-display font-semibold text-brand-text">
                      {evt.event_type === 'dispute_created' ? `Dispute opened: ${evt.metadata?.reason}` : `Dispute status transitioned to ${evt.metadata?.to_status}`}
                    </Text>
                    <Text className="text-[9px] font-display text-brand-muted mt-0.5">{new Date(evt.created_at).toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Right Column: Dispute Resolution controls */}
        <View className="w-80 gap-6">
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-4">
            <Text className="text-sm font-display font-bold text-brand-text">
              Dispute Operations
            </Text>

            <View className="gap-1.5">
              <Text className="text-xs font-display font-bold text-brand-text">Formal Decision (Required for Resolution):</Text>
              <TextInput
                value={resolutionText}
                onChangeText={setResolutionText}
                editable={!isClosed && !updating}
                placeholder="Declare the formal resolution ruling..."
                placeholderTextColor="#94A3B8"
                className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-xs font-display text-brand-text h-20"
                style={{ textAlignVertical: 'top' }}
                multiline
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-display font-bold text-brand-text">Internal Support Note:</Text>
              <TextInput
                value={resolutionNote}
                onChangeText={setResolutionNote}
                editable={!isClosed && !updating}
                placeholder="Internal reasoning notes..."
                placeholderTextColor="#94A3B8"
                className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-xs font-display text-brand-text h-20"
                style={{ textAlignVertical: 'top' }}
                multiline
              />
            </View>

            {!isClosed ? (
              <View className="gap-2.5 mt-2">
                {dispute.status === 'open' && (
                  <Pressable
                    onPress={() => handleAction('under_review')}
                    disabled={updating}
                    className="w-full py-3 border border-amber-200 bg-amber-50/50 rounded-xl items-center justify-center active:bg-amber-50"
                  >
                    <Text className="text-amber-700 font-display font-bold text-xs uppercase">
                      Mark Under Review
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => handleAction('resolved_buyer')}
                  disabled={updating}
                  className="w-full py-3 bg-emerald-500 rounded-xl items-center justify-center active:opacity-90 flex-row gap-1.5"
                >
                  <Award size={14} color="#FFFFFF" />
                  <Text className="text-white font-display font-bold text-xs uppercase">
                    Resolve for Buyer
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleAction('resolved_seller')}
                  disabled={updating}
                  className="w-full py-3 bg-blue-500 rounded-xl items-center justify-center active:opacity-90 flex-row gap-1.5"
                >
                  <Scale size={14} color="#FFFFFF" />
                  <Text className="text-white font-display font-bold text-xs uppercase">
                    Resolve for Seller
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Alert.alert(
                      'Cancel Dispute Case',
                      'Dismiss and cancel this dispute case file?',
                      [
                        { text: 'No', style: 'cancel' },
                        { text: 'Yes, Cancel', style: 'destructive', onPress: () => handleAction('cancelled') }
                      ]
                    );
                  }}
                  disabled={updating}
                  className="w-full py-3 border border-stone-250 bg-stone-100 rounded-xl items-center justify-center active:bg-stone-200"
                >
                  <Text className="text-stone-600 font-display font-bold text-xs uppercase">
                    Dismiss / Cancel Dispute
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="bg-stone-50 border border-stone-200 rounded-2xl p-4 items-center gap-2">
                {dispute.status.startsWith('resolved') ? (
                  <CheckCircle size={24} color="#10B981" />
                ) : (
                  <XCircle size={24} color="#6B7280" />
                )}
                <Text className="text-xs font-display font-bold text-brand-text uppercase">
                  This Dispute is Closed
                </Text>
                <Text className="text-[10px] font-display text-brand-muted">
                  Ruling locked on {new Date(dispute.updated_at).toLocaleString('en-IN')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
