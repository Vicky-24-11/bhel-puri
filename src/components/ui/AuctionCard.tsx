import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Heart, MapPin } from 'lucide-react-native';
import { router } from 'expo-router';

import { Card } from './Card';
import { PriceDisplay } from './PriceDisplay';
import { CountdownTimer } from './CountdownTimer';
import { Badge } from './Badge';
import { useAuth } from '@/lib/AuthContext';
import { addToWatchlist, removeFromWatchlist, getWatchlist } from '@/services/auctionService';

export interface AuctionCardProps {
  id: string;
  title: string;
  currentHighestBid?: number;
  current_price?: number;
  bidCount?: number;
  bid_count?: number;
  endTime?: string;
  ends_at?: string;
  image?: any;
  primary_image_url?: string;
  location?: string;
  city?: string;
  category?: string;
  category_name?: string;
  status?: string;
  starts_at?: string;
  auction_type?: 'forward' | 'reverse';
}

export const AuctionCard: React.FC<AuctionCardProps> = ({
  id,
  title,
  currentHighestBid,
  current_price,
  bidCount,
  bid_count,
  endTime,
  ends_at,
  image,
  primary_image_url,
  location,
  city,
  category,
  category_name,
  status = 'live',
  starts_at,
  auction_type = 'forward',
}) => {
  const { user } = useAuth();
  const [isWatched, setIsWatched] = useState(false);
  const heartScale = useRef(new Animated.Value(1)).current;

  // Resolve values supporting both legacy mock schemas and new production DB structures
  const price = current_price ?? currentHighestBid ?? 0;
  const timerEnd = ends_at ?? endTime ?? new Date().toISOString();
  const displayLocation = city ?? location ?? 'India';
  const displayCategory = category_name ?? category ?? 'Other';
  const activeBids = bid_count ?? bidCount ?? 0;
  const currentStatus = status.toLowerCase();

  // Resolve image source safely
  const imageSource = primary_image_url 
    ? { uri: primary_image_url } 
    : (typeof image === 'string' ? { uri: image } : image);

  // Load watchlist state on mount
  useEffect(() => {
    if (!user) return;
    let active = true;
    getWatchlist(user.id)
      .then((items) => {
        if (active) {
          const watched = items.some((item) => item.id === id);
          setIsWatched(watched);
        }
      })
      .catch((err) => console.log('Watchlist check fail:', err.message));

    return () => {
      active = false;
    };
  }, [id, user]);

  const handleWatchPress = async (e: any) => {
    e.stopPropagation(); // Avoid triggering card routing
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to add auctions to your watchlist.');
      return;
    }

    const nextState = !isWatched;
    setIsWatched(nextState);

    // Bounce spring animation
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true })
    ]).start();

    try {
      if (nextState) {
        await addToWatchlist(user.id, id);
      } else {
        await removeFromWatchlist(user.id, id);
      }
    } catch (err: any) {
      // Revert status on failure
      setIsWatched(!nextState);
      console.error('Watchlist mutation failed:', err.message);
    }
  };

  const handleCardPress = () => {
    router.push(`/auction/${id}` as any);
  };

  // Determine timing remaining status
  const difference = +new Date(timerEnd) - +new Date();
  const isEndingSoon = difference > 0 && difference < 15 * 60 * 1000;

  // Resolve dynamic badges and text titles based on current listing status
  let badgeLabel = 'Live';
  let badgeType: 'success' | 'warning' | 'error' | 'neutral' = 'success';
  
  if (currentStatus === 'scheduled') {
    badgeLabel = 'Upcoming';
    badgeType = 'warning';
  } else if (currentStatus === 'ended') {
    badgeLabel = 'Ended';
    badgeType = 'neutral';
  } else if (currentStatus === 'cancelled') {
    badgeLabel = 'Cancelled';
    badgeType = 'error';
  } else if (isEndingSoon) {
    badgeLabel = 'Ending Soon';
    badgeType = 'error';
  }

  return (
    <Card onPress={handleCardPress} className="w-full mb-4">
      {/* Product Image and Badges */}
      <View className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-3 bg-stone-100">
        {imageSource ? (
          <Image
            source={imageSource}
            contentFit="cover"
            transition={200}
            className="w-full h-full"
          />
        ) : (
          <View className="w-full h-full items-center justify-center bg-stone-200">
            <Text className="text-xs font-display text-brand-muted">No Image</Text>
          </View>
        )}

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
            label={auction_type === 'reverse' ? '🔄 Buy Request' : '🔨 Auction'}
            type={auction_type === 'reverse' ? 'warning' : 'success'}
            size="sm"
          />
          <Badge
            label={badgeLabel}
            type={badgeType}
            size="sm"
          />
          <Badge
            label={displayCategory}
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
              {currentStatus === 'scheduled' ? (auction_type === 'reverse' ? 'Max Budget' : 'Starting Price') : (auction_type === 'reverse' ? 'Best Offer' : 'Current Price')}
            </Text>
            <PriceDisplay amount={price} size="md" className="text-brand-text" />
          </View>

          <View className="items-end">
            <Text className="text-[11px] font-display text-brand-muted uppercase tracking-wider mb-0.5">
              {currentStatus === 'scheduled' ? 'Starts In' : currentStatus === 'ended' ? 'Finished' : 'Time Left'}
            </Text>
            {currentStatus === 'ended' ? (
              <Text className="text-xs font-display font-bold text-brand-muted">Ended</Text>
            ) : currentStatus === 'cancelled' ? (
              <Text className="text-xs font-display font-bold text-brand-error">Cancelled</Text>
            ) : (
              <CountdownTimer endTime={currentStatus === 'scheduled' && starts_at ? starts_at : timerEnd} />
            )}
          </View>
        </View>

        {/* Footer info: Bids Count & Location */}
        <View className="flex-row items-center justify-between pt-2.5 border-t border-stone-100">
          <Text className="text-xs font-display font-semibold text-brand-primary">
            ⚡ {activeBids} {activeBids === 1 ? (auction_type === 'reverse' ? 'offer' : 'bid') : (auction_type === 'reverse' ? 'offers' : 'bids')}
          </Text>

          <View className="flex-row items-center">
            <MapPin size={12} color="#7F8C8D" className="mr-0.5" />
            <Text className="text-xs font-display text-brand-muted" numberOfLines={1}>
              {displayLocation}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
};
