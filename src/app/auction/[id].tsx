import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Platform, Modal } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, ShieldCheck, Heart, Share2, Gavel, Settings, X } from 'lucide-react-native';
import { Image } from 'expo-image';

import { useAuth } from '@/lib/AuthContext';
import { getAuctionById, updateAuction, cancelAuction, getAuctionImageUrl, addToWatchlist, removeFromWatchlist, getWatchlist } from '@/services/auctionService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { Badge } from '@/components/ui/Badge';

export default function AuctionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  
  const [auction, setAuction] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isWatched, setIsWatched] = useState(false);

  // Management modal states
  const [showManageModal, setShowManageModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartingPrice, setEditStartingPrice] = useState('');
  const [editMinIncrement, setEditMinIncrement] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Selected image gallery state
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getAuctionById(id);
      if (data) {
        setAuction(data);
        setEditTitle(data.title);
        setEditDescription(data.description || '');
        setEditStartingPrice((data.starting_price || 0).toString());
        setEditMinIncrement((data.minimum_bid_increment || 0).toString());
      } else {
        setErrorMsg('Listing could not be found.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [id, fetchDetails]);

  // Sync watchlist status
  useEffect(() => {
    if (!user || !id) return;
    let active = true;
    getWatchlist(user.id)
      .then((items) => {
        if (active) {
          setIsWatched(items.some((item) => item.id === id));
        }
      })
      .catch((err) => console.log('Watchlist error:', err.message));

    return () => {
      active = false;
    };
  }, [id, user]);

  const handleWatchToggle = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to watchlist this auction.');
      return;
    }
    const nextState = !isWatched;
    setIsWatched(nextState);
    try {
      if (nextState) {
        await addToWatchlist(user.id, auction.id);
      } else {
        await removeFromWatchlist(user.id, auction.id);
      }
    } catch (err: any) {
      setIsWatched(!nextState);
      Alert.alert('Error', err.message);
    }
  };

  const handleJoinPress = () => {
    Alert.alert('Joining Auction', 'Bhel Puri Live bidding is coming soon in Phase 4! You will be notified when real-time bidding is enabled for this auction.');
  };

  const handleSaveChanges = async () => {
    if (!editTitle.trim() || !editDescription.trim()) {
      Alert.alert('Validation Error', 'Title and Description are required.');
      return;
    }
    setSavingEdit(true);
    try {
      const updates: any = {
        title: editTitle.trim(),
        description: editDescription.trim(),
      };

      // Only allow price updates if the listing is not yet live
      if (auction.status === 'draft' || auction.status === 'scheduled') {
        const startPrice = parseFloat(editStartingPrice);
        const minInc = parseFloat(editMinIncrement);
        
        if (isNaN(startPrice) || startPrice < 0) {
          Alert.alert('Error', 'Starting price must be a positive number.');
          setSavingEdit(false);
          return;
        }
        if (isNaN(minInc) || minInc <= 0) {
          Alert.alert('Error', 'Minimum bid increment must be greater than zero.');
          setSavingEdit(false);
          return;
        }
        updates.starting_price = startPrice;
        updates.minimum_bid_increment = minInc;
        updates.current_price = startPrice; // reset current price to start price
      }

      await updateAuction(auction.id, updates);
      Alert.alert('Success', 'Listing updated successfully.');
      setShowManageModal(false);
      fetchDetails();
    } catch (err: any) {
      Alert.alert('Failed to Edit', err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelPress = () => {
    Alert.alert(
      'Cancel Auction',
      'Are you sure you want to cancel this listing? This action is permanent and cannot be reversed.',
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Cancel Auction',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelAuction(auction.id);
              Alert.alert('Cancelled', 'This auction has been cancelled.');
              setShowManageModal(false);
              fetchDetails();
            } catch (err: any) {
              Alert.alert('Failed to Cancel', err.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-brand-background items-center justify-center">
        <ActivityIndicator size="large" color="#FF6B35" />
      </SafeAreaView>
    );
  }

  if (errorMsg || !auction) {
    return (
      <SafeAreaView className="flex-1 bg-brand-background items-center justify-center p-5">
        <Text className="text-lg font-display font-bold text-brand-text mb-2">
          Auction Not Found
        </Text>
        <Text className="text-sm font-display text-brand-muted text-center mb-6">
          {errorMsg || 'The requested listing could not be resolved.'}
        </Text>
        <Button label="Go back to Home" onPress={() => router.replace('/(tabs)')} />
      </SafeAreaView>
    );
  }

  const isSeller = user?.id === auction.seller_id;
  const currentStatus = auction.status.toLowerCase();

  // Resolve auction status labels and colors
  let statusText = 'Live';
  let badgeType: 'success' | 'warning' | 'error' | 'neutral' = 'success';
  let ctaLabel = 'Join Auction';
  let ctaDisabled = false;

  if (currentStatus === 'scheduled') {
    statusText = 'Upcoming';
    badgeType = 'warning';
    ctaLabel = 'Coming Soon';
  } else if (currentStatus === 'ended') {
    statusText = 'Ended';
    badgeType = 'neutral';
    ctaLabel = 'Auction Ended';
    ctaDisabled = true;
  } else if (currentStatus === 'cancelled') {
    statusText = 'Cancelled';
    badgeType = 'error';
    ctaLabel = 'Auction Cancelled';
    ctaDisabled = true;
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Navigation Header */}
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-stone-200 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft size={20} color="#1A1A1A" />
        </Pressable>
        
        <Text className="font-display font-extrabold text-brand-text text-base">
          Auction Details
        </Text>

        <Pressable className="p-2 -mr-2">
          <Share2 size={20} color="#1A1A1A" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Horizontal Photo Gallery Carousels */}
        <View className="w-full aspect-[4/3] bg-stone-100 relative">
          {auction.images && auction.images.length > 0 ? (
            <View className="w-full h-full">
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  const slideSize = e.nativeEvent.layoutMeasurement.width;
                  const offset = e.nativeEvent.contentOffset.x;
                  setActiveImageIndex(Math.floor(offset / slideSize));
                }}
                scrollEventThrottle={16}
                className="w-full h-full"
              >
                {auction.images.map((img: any, index: number) => (
                  <View key={img.id} style={{ width: Platform.OS === 'web' ? '100%' : 400 }} className="aspect-[4/3]">
                    <Image
                      source={{ uri: getAuctionImageUrl(img.storage_path) }}
                      contentFit="cover"
                      className="w-full h-full"
                    />
                  </View>
                ))}
              </ScrollView>
              
              {/* Slides indicator dots */}
              {auction.images.length > 1 && (
                <View className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-1.5">
                  {auction.images.map((_: any, index: number) => (
                    <View
                      key={index}
                      style={{
                        backgroundColor: activeImageIndex === index ? '#FF6B35' : 'rgba(255, 255, 255, 0.6)',
                        width: activeImageIndex === index ? 16 : 6,
                      }}
                      className="h-1.5 rounded-full"
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View className="w-full h-full items-center justify-center bg-stone-200">
              <Text className="text-sm font-display text-brand-muted">No listing photos available</Text>
            </View>
          )}

          {/* Floating Watchlist Button */}
          <Pressable
            onPress={handleWatchToggle}
            className="absolute top-3 right-3 w-10 h-10 items-center justify-center rounded-full bg-white/95 active:bg-white shadow-md border border-stone-200"
          >
            <Heart
              size={20}
              fill={isWatched ? '#E71D36' : 'transparent'}
              color={isWatched ? '#E71D36' : '#1A1A1A'}
            />
          </Pressable>

          <View className="absolute bottom-4 left-5">
            <Badge label={statusText} type={badgeType} size="md" />
          </View>
        </View>

        {/* Content Body Details */}
        <View className="w-full max-w-2xl mx-auto px-5 pt-5 pb-16">
          <Text className="text-2xl font-display font-extrabold text-brand-text mb-2">
            {auction.title}
          </Text>

          {/* Price details and countdown timer */}
          <View className="w-full flex-row border border-stone-200 bg-white rounded-3xl p-5 mb-6 mt-2 shadow-sm">
            <View className="flex-1">
              <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold tracking-wider mb-1">
                {currentStatus === 'scheduled' ? 'Starting Price' : 'Current Price'}
              </Text>
              <PriceDisplay amount={auction.current_price} size="xl" className="text-brand-text" />
              <Text className="text-xs font-display text-brand-muted mt-1">
                Min. Increment: ₹{(auction.minimum_bid_increment || 0).toLocaleString('en-IN')}
              </Text>
            </View>

            <View className="w-[1px] bg-stone-200 my-1 mx-4" />

            <View className="flex-1 items-end justify-center">
              <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold tracking-wider mb-1">
                {currentStatus === 'scheduled' ? 'Bidding Starts In' : currentStatus === 'ended' ? 'Finished' : 'Time Left'}
              </Text>
              {currentStatus === 'ended' ? (
                <Text className="text-lg font-display font-bold text-brand-muted">Ended</Text>
              ) : currentStatus === 'cancelled' ? (
                <Text className="text-lg font-display font-bold text-brand-error">Cancelled</Text>
              ) : (
                <CountdownTimer
                  endTime={currentStatus === 'scheduled' ? auction.starts_at : auction.ends_at}
                  className="text-lg"
                />
              )}
            </View>
          </View>

          {/* Primary CTA Action Button */}
          <View className="mb-6">
            {isSeller ? (
              <Button
                label="Manage Listing"
                onPress={() => setShowManageModal(true)}
                icon={<Settings size={18} color="#FFFFFF" />}
                className="h-12 w-full"
              />
            ) : (
              <Button
                label={ctaLabel}
                disabled={ctaDisabled}
                onPress={handleJoinPress}
                icon={currentStatus === 'live' ? <Gavel size={18} color="#FFFFFF" /> : undefined}
                className="h-12 w-full"
              />
            )}
          </View>

          {/* Listing Description */}
          <View className="mb-6 bg-white border border-stone-200 p-5 rounded-3xl shadow-sm">
            <Text className="text-base font-display font-bold text-brand-text mb-2">
              Item Details
            </Text>
            <Text className="text-sm font-display text-brand-muted leading-relaxed">
              {auction.description}
            </Text>
          </View>

          {/* Seller profile card */}
          {auction.seller && (
            <View className="w-full bg-stone-50 border border-stone-100 rounded-3xl p-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                {auction.seller.avatar_url ? (
                  <Image
                    source={{ uri: auction.seller.avatar_url }}
                    className="w-10 h-10 rounded-full mr-3 border border-stone-200"
                  />
                ) : (
                  <View className="w-10 h-10 bg-brand-primary/10 border border-brand-primary/20 rounded-full items-center justify-center mr-3">
                    <Text className="font-display font-bold text-brand-primary">
                      {auction.seller.full_name?.charAt(0) || 'B'}
                    </Text>
                  </View>
                )}
                <View>
                  <View className="flex-row items-center gap-1">
                    <Text className="font-display font-bold text-brand-text text-sm">
                      {auction.seller.full_name || 'Bhel Puri Seller'}
                    </Text>
                    {auction.seller.is_verified && <ShieldCheck size={14} color="#2EC4B6" />}
                  </View>
                  {auction.seller.city ? (
                    <View className="flex-row items-center mt-0.5">
                      <MapPin size={10} color="#7F8C8D" className="mr-0.5" />
                      <Text className="text-[10px] font-display text-brand-muted">
                        {auction.seller.city}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-[10px] font-display text-brand-muted">Verified Seller</Text>
                  )}
                </View>
              </View>

              {auction.seller.total_ratings && auction.seller.total_ratings > 0 ? (
                <View className="flex-row items-center">
                  <Heart size={14} color="#FFB627" fill="#FFB627" className="mr-1" />
                  <Text className="text-xs font-display font-bold text-brand-text">
                    {auction.seller.rating} Rating
                  </Text>
                </View>
              ) : (
                <Text className="text-[10px] font-display font-semibold text-brand-muted">New Seller</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Seller Management Drawer Modal */}
      <Modal
        visible={showManageModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowManageModal(false)}
      >
        <SafeAreaView className="flex-1 bg-brand-background">
          <View className="px-5 py-3 flex-row items-center justify-between border-b border-stone-200 bg-white">
            <View className="flex-row items-center gap-2">
              <Settings size={20} color="#FF6B35" />
              <Text className="font-display font-extrabold text-brand-text text-lg">
                Manage Listing
              </Text>
            </View>
            <Pressable onPress={() => setShowManageModal(false)} className="p-2 -mr-2">
              <X size={20} color="#1A1A1A" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-6 py-4">
            <View className="gap-4 pb-12">
              <Input
                label="Auction Title"
                placeholder="e.g. iPhone 15 Pro"
                value={editTitle}
                onChangeText={setEditTitle}
              />

              <Input
                label="Item Description"
                placeholder="Describe your auction item..."
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
                numberOfLines={4}
                className="h-24 pt-2 align-top"
              />

              {currentStatus === 'live' ? (
                <View className="bg-brand-primary/5 border border-brand-primary/20 rounded-2xl p-4 mt-2">
                  <Text className="text-xs font-display font-bold text-brand-primary mb-1">
                    🔒 Price & Schedules Locked
                  </Text>
                  <Text className="text-[11px] font-display text-brand-muted leading-relaxed">
                    Schedules, starting price, and increments cannot be modified once the listing is live to ensure transparency for active participants.
                  </Text>
                </View>
              ) : (
                <View className="gap-4">
                  <Input
                    label="Starting Price (₹)"
                    placeholder="e.g. 25000"
                    keyboardType="numeric"
                    value={editStartingPrice}
                    onChangeText={setEditStartingPrice}
                  />

                  <Input
                    label="Minimum Bid Increment (₹)"
                    placeholder="e.g. 500"
                    keyboardType="numeric"
                    value={editMinIncrement}
                    onChangeText={setEditMinIncrement}
                  />
                </View>
              )}

              {/* Action Buttons */}
              <View className="gap-2.5 mt-6">
                <Button
                  label="Save Modifications"
                  onPress={handleSaveChanges}
                  loading={savingEdit}
                />
                
                {currentStatus !== 'cancelled' && currentStatus !== 'ended' && (
                  <Button
                    label="Cancel Auction Listing"
                    variant="outline"
                    onPress={handleCancelPress}
                    className="border-brand-error/20 active:bg-red-50 text-brand-error"
                  />
                )}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
