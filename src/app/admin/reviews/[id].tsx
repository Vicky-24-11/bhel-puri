import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Star, CheckCircle, Scale, XCircle } from 'lucide-react-native';
import { getAdminReviewById, moderateReview } from '@/services/adminService';

export default function AdminReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [moderationReason, setModerationReason] = useState('');

  const loadReviewDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getAdminReviewById(id);
      if (!data) {
        Alert.alert('Error', 'Review record not found.');
        router.back();
        return;
      }
      setReview(data);
    } catch (err) {
      console.error('Error fetching admin review details:', err);
      Alert.alert('Error', 'Failed to load review case file.');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadReviewDetails();
  }, [loadReviewDetails]);

  const handleAction = async (newStatus: 'published' | 'hidden' | 'removed') => {
    if (!review) return;
    const cleanReason = moderationReason.trim();

    if (newStatus !== 'published' && !cleanReason) {
      Alert.alert('Validation Error', 'Please supply a moderation rationale explaining your decision.');
      return;
    }

    try {
      setUpdating(true);
      const success = await moderateReview(review.id, newStatus, cleanReason);
      if (success) {
        Alert.alert('Success', `Review status changed to ${newStatus}.`);
        loadReviewDetails(); // Reload data
      }
    } catch (err: any) {
      console.error('Error updating review status:', err);
      Alert.alert('Error', err.message || 'Unable to moderate review.');
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

  if (!review) return null;

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
            Moderate Transaction Review
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            ID: {review.id}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-6 items-start">
        {/* Left Column: Details */}
        <View className="flex-1 min-w-[320px] gap-6">
          {/* Review Details Card */}
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-4">
            <Text className="text-sm font-display font-bold text-brand-text">
              Review Content
            </Text>

            <View className="bg-stone-50 p-4 border border-stone-200 rounded-2xl gap-3">
              <View className="flex-row justify-between">
                <Text className="text-xs font-display text-brand-muted">Reviewer:</Text>
                <Text className="text-xs font-display font-bold text-brand-text">@{review.reviewer?.username || 'reviewer'}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs font-display text-brand-muted">Reviewee:</Text>
                <Text className="text-xs font-display font-bold text-brand-text">@{review.reviewee?.username || 'reviewee'}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs font-display text-brand-muted">Listing Context:</Text>
                <Text className="text-xs font-display font-bold text-brand-text">{review.auction?.title || 'Unknown'}</Text>
              </View>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs font-display text-brand-muted">Rating Value:</Text>
                <View className="flex-row items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={14}
                      fill={star <= review.rating_value ? '#F59E0B' : 'transparent'}
                      color={star <= review.rating_value ? '#F59E0B' : '#BDC3C7'}
                      className="mr-0.5"
                    />
                  ))}
                </View>
              </View>
              <View className="mt-2 border-t border-stone-200 pt-2">
                <Text className="text-xs font-display text-brand-muted font-bold">Review Comment:</Text>
                <Text className="text-xs font-display text-brand-text mt-1 leading-relaxed">{review.comment || '(No comment written)'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Right Column: Actions */}
        <View className="w-80 gap-6">
          <View className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm gap-4">
            <Text className="text-sm font-display font-bold text-brand-text">
              Moderation Controls
            </Text>

            <View className="gap-1.5">
              <Text className="text-xs font-display font-bold text-brand-text">Moderation Reason (Required for Hide/Remove):</Text>
              <TextInput
                value={moderationReason}
                onChangeText={setModerationReason}
                editable={!updating}
                placeholder="Detail reason for guidelines moderation..."
                placeholderTextColor="#94A3B8"
                className="bg-stone-50 border border-stone-200 rounded-2xl p-3 text-xs font-display text-brand-text h-20"
                style={{ textAlignVertical: 'top' }}
                multiline
              />
            </View>

            <View className="gap-2.5 mt-2">
              <View className="flex-row justify-between items-center bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 mb-2">
                <Text className="text-xs font-display text-brand-muted">Current status:</Text>
                <Text className="text-xs font-display font-bold text-brand-primary uppercase">{review.status}</Text>
              </View>

              {review.status !== 'published' && (
                <Pressable
                  onPress={() => handleAction('published')}
                  disabled={updating}
                  className="w-full py-3 bg-emerald-500 rounded-xl items-center justify-center active:opacity-90 flex-row gap-1.5"
                >
                  <CheckCircle size={14} color="#FFFFFF" />
                  <Text className="text-white font-display font-bold text-xs uppercase">
                    Publish / Approve Review
                  </Text>
                </Pressable>
              )}

              {review.status !== 'hidden' && (
                <Pressable
                  onPress={() => handleAction('hidden')}
                  disabled={updating}
                  className="w-full py-3 bg-amber-500 rounded-xl items-center justify-center active:opacity-90 flex-row gap-1.5"
                >
                  <Scale size={14} color="#FFFFFF" />
                  <Text className="text-white font-display font-bold text-xs uppercase">
                    Hide Review (Guidelines)
                  </Text>
                </Pressable>
              )}

              {review.status !== 'removed' && (
                <Pressable
                  onPress={() => {
                    Alert.alert(
                      'Remove Review',
                      'Mark this review as permanently removed?',
                      [
                        { text: 'No', style: 'cancel' },
                        { text: 'Yes, Remove', style: 'destructive', onPress: () => handleAction('removed') }
                      ]
                    );
                  }}
                  disabled={updating}
                  className="w-full py-3 bg-red-500 rounded-xl items-center justify-center active:opacity-90 flex-row gap-1.5"
                >
                  <XCircle size={14} color="#FFFFFF" />
                  <Text className="text-white font-display font-bold text-xs uppercase">
                    Permanently Remove
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
