import React, { useState, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Heart, MapPin } from 'lucide-react-native';
import { router } from 'expo-router';

import { Card } from './Card';
import { PriceDisplay } from './PriceDisplay';
import { CountdownTimer } from './CountdownTimer';
import { Badge } from './Badge';

export interface AuctionCardProps {
  id: string;
  title: string;
  currentHighestBid: number;
  bidCount: number;
  endTime: string;
  image: any;
  location: string;
  category: string;
  seller: {
    name: string;
    rating: number;
  };
}

export const AuctionCard: React.FC<AuctionCardProps> = ({
  id,
  title,
  currentHighestBid,
  bidCount,
  endTime,
  image,
  location,
  category,
}) => {
  const [isWatched, setIsWatched] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;

  const handleWatchPress = (e: any) => {
    e.stopPropagation(); // Avoid triggering card navigation
    setIsWatched(!isWatched);
    
    // Spring scaling effect
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true })
    ]).start();
  };

  const handleCardPress = () => {
    router.push(`/auction/${id}`);
  };

  // Determine if auction is ending soon (e.g. less than 15 mins)
  const difference = +new Date(endTime) - +new Date();
  const isEndingSoon = difference > 0 && difference < 15 * 60 * 1000;

  return (
    <Card onPress={handleCardPress} className="w-full mb-4">
      {/* Product Image and Badges */}
      <View className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-3 bg-stone-100">
        <Image
          source={image}
          contentFit="cover"
          transition={200}
          className="w-full h-full"
        />

        {/* Floating Heart Watchlist Button */}
        <Pressable
          onPress={handleWatchPress}
          className="absolute top-3 right-3 w-9 h-9 items-center justify-center rounded-full bg-white/90 active:bg-white shadow-sm border border-stone-100"
        >
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Heart
              size={18}
              fill={isWatched ? '#E71D36' : 'transparent'}
              color={isWatched ? '#E71D36' : '#1A1A1A'}
            />
          </Animated.View>
        </Pressable>

        {/* Floating Badges */}
        <View className="absolute bottom-3 left-3 flex-row gap-1.5">
          <Badge
            label={isEndingSoon ? 'Ending Soon' : 'Live'}
            type={isEndingSoon ? 'error' : 'success'}
            size="sm"
          />
          <Badge
            label={category}
            type="neutral"
            size="sm"
            className="bg-black/40 text-white border-transparent"
          />
        </View>
      </View>

      {/* Content Details */}
      <View className="px-0.5">
        <Text
          numberOfLines={1}
          className="text-base font-display font-semibold text-brand-text mb-1"
        >
          {title}
        </Text>

        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-[11px] font-display text-brand-muted uppercase tracking-wider mb-0.5">
              Current Bid
            </Text>
            <PriceDisplay amount={currentHighestBid} size="md" className="text-brand-text" />
          </View>

          <View className="items-end">
            <Text className="text-[11px] font-display text-brand-muted uppercase tracking-wider mb-0.5">
              Time Left
            </Text>
            <CountdownTimer endTime={endTime} />
          </View>
        </View>

        {/* Footer info: Bids Count & Location */}
        <View className="flex-row items-center justify-between pt-2.5 border-t border-stone-100">
          <Text className="text-xs font-display font-semibold text-brand-primary">
            ⚡ {bidCount} {bidCount === 1 ? 'bid' : 'bids'}
          </Text>

          <View className="flex-row items-center">
            <MapPin size={12} color="#7F8C8D" className="mr-0.5" />
            <Text className="text-xs font-display text-brand-muted" numberOfLines={1}>
              {location}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
};
