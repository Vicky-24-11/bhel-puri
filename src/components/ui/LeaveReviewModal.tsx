import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Star, X } from 'lucide-react-native';
import { submitRating } from '@/services/ratingService';

interface LeaveReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitSuccess: () => void;
  transactionId: string;
  auctionId: string;
  reviewerId: string;
  revieweeId: string;
  targetName: string;
}

export function LeaveReviewModal({
  visible,
  onClose,
  onSubmitSuccess,
  auctionId,
  reviewerId,
  revieweeId,
  targetName,
}: LeaveReviewModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      Alert.alert('Validation Error', 'Please choose a rating between 1 and 5 stars.');
      return;
    }

    try {
      setSubmitting(true);
      await submitRating({
        auction_id: auctionId,
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        rating_value: rating,
        comment: comment || null,
      });

      Alert.alert('Success', 'Your rating and review has been submitted.');
      onSubmitSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting rating modal:', err);
      Alert.alert('Submission Failed', err.message || 'Unable to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl gap-5 relative">
            {/* Close Button */}
            <Pressable
              onPress={onClose}
              disabled={submitting}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-100 items-center justify-center active:opacity-75"
            >
              <X size={16} color="#1A1A1A" />
            </Pressable>

            <View className="items-center gap-1.5 mt-2">
              <Text className="text-lg font-display font-extrabold text-brand-text text-center">
                Rate Your Experience
              </Text>
              <Text className="text-xs font-display text-brand-muted text-center">
                Leave feedback for @{targetName}
              </Text>
            </View>

            {/* Stars Selector */}
            <View className="flex-row justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isSelected = star <= rating;
                return (
                  <Pressable
                    key={star}
                    onPress={() => setRating(star)}
                    disabled={submitting}
                    className="p-1 active:scale-110"
                  >
                    <Star
                      size={32}
                      fill={isSelected ? '#F59E0B' : 'transparent'}
                      color={isSelected ? '#F59E0B' : '#BDC3C7'}
                    />
                  </Pressable>
                );
              })}
            </View>

            {/* Comment Area */}
            <View className="gap-2">
              <Text className="text-xs font-display font-bold text-brand-text">
                Write a Review (Optional)
              </Text>
              <TextInput
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={setComment}
                placeholder="Share details about this exchange..."
                placeholderTextColor="#9CA3AF"
                className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-xs font-display text-brand-text text-start h-24"
                style={{ textAlignVertical: 'top' }}
                maxLength={500}
                editable={!submitting}
              />
              <Text className="text-[9px] font-display text-brand-muted text-right">
                {comment.length}/500 characters
              </Text>
            </View>

            {/* Submit Action */}
            <Pressable
              onPress={handleSubmit}
              disabled={submitting || rating === 0}
              className="w-full h-12 bg-brand-primary rounded-2xl items-center justify-center shadow-sm active:opacity-90 disabled:opacity-50"
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-display font-bold text-sm">
                  Submit Review
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
