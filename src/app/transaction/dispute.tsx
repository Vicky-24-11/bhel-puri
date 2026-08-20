import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ShieldAlert, Image as ImageIcon, XCircle, CheckCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';

import { supabase } from '@/lib/supabase';
import { getTransactionById, TransactionWithDetails } from '@/services/transactionService';
import { createDispute, uploadDisputeEvidence } from '@/services/disputeService';

export default function DisputeScreen() {
  const { txId } = useLocalSearchParams<{ txId: string }>();
  const router = useRouter();

  const [transaction, setTransaction] = useState<TransactionWithDetails | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [imageUris, setImageUris] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!txId) return;
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);

        if (!user) {
          Alert.alert('Authentication Required', 'Please log in to register a dispute.');
          router.back();
          return;
        }

        const tx = await getTransactionById(txId);
        if (!tx) {
          Alert.alert('Error', 'Transaction not found.');
          router.back();
          return;
        }

        // Verify transaction participant
        if (tx.seller_id !== user.id && tx.buyer_id !== user.id) {
          Alert.alert('Access Denied', 'You are not a participant in this transaction.');
          router.back();
          return;
        }

        setTransaction(tx);
      } catch (err: any) {
        console.error('Error loading dispute data:', err);
        Alert.alert('Error', 'Failed to load transaction data.');
        router.back();
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [txId, router]);

  if (loading || !transaction || !currentUser) {
    return (
      <SafeAreaView className="flex-1 bg-brand-background justify-center items-center">
        <ActivityIndicator size="large" color="#FF6B35" />
      </SafeAreaView>
    );
  }

  const isSeller = transaction.seller_id === currentUser.id;

  const buyerReasons = [
    'Item not received',
    'Item significantly different',
    'Item damaged',
    'Seller failed to fulfill',
    'Suspected fraud',
    'Other',
  ];

  const sellerReasons = [
    'Buyer failed to complete transaction',
    'False buyer claim',
    'Buyer refused valid delivery/pickup',
    'Item returned damaged',
    'Suspected buyer abuse',
    'Other',
  ];

  const reasons = isSeller ? sellerReasons : buyerReasons;

  const handlePickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      const msg = 'Bhel Puri needs media library permissions to upload evidence.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Permission Denied', msg);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - imageUris.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedUris = result.assets.map((asset) => asset.uri);
      setImageUris((prev) => [...prev, ...selectedUris].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validations
    if (!selectedReason) {
      Alert.alert('Validation Error', 'Please select a reason for the dispute.');
      return;
    }

    const cleanDescription = description.trim();
    if (cleanDescription.length < 15) {
      Alert.alert('Validation Error', 'Please provide a description of at least 15 characters.');
      return;
    }

    if (cleanDescription.length > 1000) {
      Alert.alert('Validation Error', 'Description must not exceed 1000 characters.');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Create the dispute row
      const dispute = await createDispute(transaction.id, selectedReason, cleanDescription);

      // 2. Upload any evidence files linked to this dispute
      if (imageUris.length > 0) {
        for (const uri of imageUris) {
          await uploadDisputeEvidence(dispute.id, uri, currentUser.id);
        }
      }

      Alert.alert('Dispute Registered', 'Your dispute has been filed and is under review.', [
        {
          text: 'OK',
          onPress: () => router.replace(`/transaction/${transaction.id}` as any),
        },
      ]);
    } catch (err: any) {
      console.error('Error submitting dispute:', err);
      Alert.alert('Submission Failed', err.message || 'Unable to register dispute. Please check for active disputes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header */}
      <View className="px-5 py-3 flex-row items-center border-b border-stone-200 bg-white">
        <Pressable onPress={() => router.back()} className="mr-4 active:opacity-75">
          <ArrowLeft size={24} color="#1A1A1A" />
        </Pressable>
        <Text className="text-lg font-display font-extrabold text-brand-text flex-1">
          File Transaction Dispute
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="flex-1">
        <View className="p-5 gap-6 max-w-lg mx-auto w-full">
          {/* Card 1: Listing details summary */}
          <View className="bg-amber-50/50 border border-amber-200 rounded-3xl p-4 flex-row gap-3">
            <ShieldAlert size={20} color="#D97706" />
            <View className="flex-1">
              <Text className="text-sm font-display font-bold text-amber-900 mb-0.5">
                Buyer & Seller Protection Logged
              </Text>
              <Text className="text-xs font-display text-amber-700 leading-relaxed">
                By filing a dispute, you are requesting support intervention. We will review your claims and submitted evidence records to resolve the exchange.
              </Text>
            </View>
          </View>

          {/* Card 2: Select Dispute Reason */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-3">
            <Text className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
              Dispute Reason
            </Text>
            <View className="gap-2">
              {reasons.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <Pressable
                    key={reason}
                    onPress={() => setSelectedReason(reason)}
                    className={`py-3.5 px-4 rounded-2xl border flex-row items-center justify-between ${
                      isSelected
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-stone-200 bg-stone-50'
                    }`}
                  >
                    <Text
                      className={`text-xs font-display font-semibold flex-1 ${
                        isSelected ? 'text-brand-primary font-bold' : 'text-brand-text'
                      }`}
                    >
                      {reason}
                    </Text>
                    {isSelected && <CheckCircle size={16} color="#FF6B35" />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Card 3: Narrative & Description */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-3">
            <Text className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
              Details & Explanation
            </Text>
            <Text className="text-[11px] font-display text-brand-muted">
              Explain clearly what occurred during the exchange. Max 1000 characters (min 15).
            </Text>
            <TextInput
              multiline
              numberOfLines={6}
              value={description}
              onChangeText={setDescription}
              placeholder="Provide context, dates, location, and agreements..."
              placeholderTextColor="#9CA3AF"
              className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-xs font-display text-brand-text text-start h-32"
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          {/* Card 4: Evidence Uploader */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-4">
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
                  Dispute Evidence
                </Text>
                <Text className="text-[10px] font-display text-brand-muted mt-0.5">
                  Upload screenshots, receipts, or photos (max 5)
                </Text>
              </View>
              <Pressable
                onPress={handlePickImages}
                disabled={imageUris.length >= 5 || submitting}
                className="flex-row items-center gap-1.5 bg-brand-primary px-3.5 py-2 rounded-xl active:opacity-95 disabled:opacity-50"
              >
                <ImageIcon size={14} color="#FFFFFF" />
                <Text className="text-white font-display font-bold text-[11px]">Add</Text>
              </Pressable>
            </View>

            {imageUris.length > 0 ? (
              <View className="flex-row flex-wrap gap-2.5">
                {imageUris.map((uri, idx) => (
                  <View key={idx} className="w-[72px] h-[72px] rounded-xl overflow-hidden bg-stone-100 relative">
                    <Image source={{ uri }} className="w-full h-full" contentFit="cover" />
                    <Pressable
                      onPress={() => removeImage(idx)}
                      disabled={submitting}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 items-center justify-center"
                    >
                      <XCircle size={12} color="#FFFFFF" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <View className="border border-dashed border-stone-300 rounded-2xl py-8 items-center justify-center bg-stone-50">
                <ImageIcon size={28} color="#9CA3AF" />
                <Text className="text-[11px] font-display text-brand-muted mt-2">
                  No evidence attached yet
                </Text>
              </View>
            )}
          </View>

          {/* Submit Action */}
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            className="w-full h-12 bg-brand-text rounded-2xl items-center justify-center shadow-sm active:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-white font-display font-bold text-sm">
                Submit Support Dispute
              </Text>
            )}
          </Pressable>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
