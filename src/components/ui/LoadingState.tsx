import React from 'react';
import { ActivityIndicator, View } from 'react-native';

export interface LoadingStateProps {
  variant?: 'spinner' | 'card' | 'list';
  count?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'spinner',
  count = 3,
  className = '',
}) => {
  if (variant === 'spinner') {
    return (
      <View className={`flex-1 justify-center items-center py-12 ${className}`}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  const items = Array.from({ length: count });

  if (variant === 'card') {
    return (
      <View className={`w-full flex-row flex-wrap justify-between p-2 ${className}`}>
        {items.map((_, index) => (
          <View
            key={index}
            className="w-[48%] bg-brand-surface border border-brand-border rounded-2xl p-3 mb-4 shadow-sm animate-pulse"
          >
            {/* Image Placeholder */}
            <View className="w-full aspect-[4/3] bg-stone-200 rounded-xl mb-3" />
            {/* Title Placeholder */}
            <View className="h-4 bg-stone-200 rounded w-3/4 mb-2" />
            {/* Price Placeholder */}
            <View className="h-5 bg-stone-200 rounded w-1/2 mb-3" />
            {/* Badge Placeholder */}
            <View className="h-4 bg-stone-200 rounded-full w-1/3" />
          </View>
        ))}
      </View>
    );
  }

  // list loader
  return (
    <View className={`w-full p-4 ${className}`}>
      {items.map((_, index) => (
        <View
          key={index}
          className="w-full flex-row items-center bg-brand-surface border border-brand-border rounded-xl p-3 mb-3 shadow-sm animate-pulse"
        >
          {/* Thumb Placeholder */}
          <View className="w-12 h-12 bg-stone-200 rounded-lg mr-3" />
          {/* Details Placeholder */}
          <View className="flex-1">
            <View className="h-4 bg-stone-200 rounded w-2/3 mb-2" />
            <View className="h-3 bg-stone-200 rounded w-1/3" />
          </View>
        </View>
      ))}
    </View>
  );
};
