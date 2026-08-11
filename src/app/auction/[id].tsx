import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Platform, Modal } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, ShieldCheck, Heart, Share2, Gavel, Settings, X, Users, MessageSquare, AlertCircle } from 'lucide-react-native';
import { Image } from 'expo-image';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';

import { useAuth } from '@/lib/AuthContext';
import { updateAuction, cancelAuction, getAuctionImageUrl, addToWatchlist, removeFromWatchlist, getWatchlist } from '@/services/auctionService';
import { joinAuction, leaveAuction, getUserParticipation } from '@/services/auctionParticipantService';
import { placeBid } from '@/services/bidService';
import { finalizeAuction } from '@/services/auctionFinalizationService';
import { createAuctionConversation } from '@/services/chatService';
import { useAuctionRealtime } from '@/hooks/useAuctionRealtime';
import { useAuctionCountdown } from '@/hooks/useAuctionCountdown';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Badge } from '@/components/ui/Badge';
import { AuctionParticipant } from '@/types/database.types';

import * as Haptics from 'expo-haptics';

export default function AuctionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  // Network offline state monitoring
  const [isOnline, setIsOnline] = useState(true);

  // Load Realtime states (auction, bids history list, active participants count)
  const {
    auction,
    bids,
    participantCount,
    loading,
    error: errorMsg,
    isConnected,
    refresh,
  } = useAuctionRealtime(id || '');

  // Local user's participation status
  const [participant, setParticipant] = useState<AuctionParticipant | null>(null);
  const [joining, setJoining] = useState(false);
  const [initiatingChat, setInitiatingChat] = useState(false);

  // Watchlist check
  const [isWatched, setIsWatched] = useState(false);

  // Manual bid input value
  const [bidAmountStr, setBidAmountStr] = useState('');
  const [placingBid, setPlacingBid] = useState(false);

  // Seller management modal states
  const [showManageModal, setShowManageModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStartingPrice, setEditStartingPrice] = useState('');
  const [editMinIncrement, setEditMinIncrement] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Horizontal image slides indicator
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Monitor online status on Web/Native
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // Sync user participation
  const fetchParticipation = useCallback(async () => {
    if (!user || !id) {
      return;
    }
    try {
      const part = await getUserParticipation(id, user.id);
      setParticipant(part);
    } catch (err) {
      console.log('Error fetching participation details:', err);
    }
  }, [id, user]);

  useEffect(() => {
    fetchParticipation();
  }, [id, user, participantCount, fetchParticipation]);

  // Sync watchlist state
  useEffect(() => {
    if (!user || !id) return;
    let active = true;
    getWatchlist(user.id)
      .then((items) => {
        if (active) {
          setIsWatched(items.some((item) => item.id === id));
        }
      })
      .catch((err) => console.log('Watchlist fetch error:', err.message));

    return () => {
      active = false;
    };
  }, [id, user]);

  // Initialize seller edit inputs once auction data arrives
  useEffect(() => {
    if (auction) {
      setEditTitle(auction.title);
      setEditDescription(auction.description || '');
      setEditStartingPrice((auction.starting_price || 0).toString());
      setEditMinIncrement((auction.minimum_bid_increment || 0).toString());
    }
  }, [auction]);

  // Expiration finalizer trigger
  const handleExpiration = useCallback(async () => {
    if (!id || !auction || auction.status !== 'live') return;
    try {
      // Trigger database finalization RPC
      await finalizeAuction(id);
      refresh();
    } catch (err) {
      console.log('Post-expiration finalizer fail:', err);
    }
  }, [id, auction, refresh]);

  // Set up live countdown timer
  const currentStatus = auction?.status?.toLowerCase();
  const timerEnd = currentStatus === 'scheduled' ? auction?.starts_at : auction?.ends_at;
  const { timeLeft, isExpired } = useAuctionCountdown(timerEnd || new Date().toISOString(), handleExpiration);

  const triggerHaptic = (type: 'success' | 'error') => {
    if (Haptics && Haptics.notificationAsync) {
      const feedbackType =
        type === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error;
      Haptics.notificationAsync(feedbackType).catch(() => {});
    }
  };

  const handleWatchToggle = async () => {
    if (!user || !auction) {
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

  const handleJoinAuction = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to participate in live bidding.');
      return;
    }
    if (isSeller) {
      Alert.alert('Seller Blocked', 'You cannot join your own auction listings.');
      return;
    }

    setJoining(true);
    try {
      const res = await joinAuction(id!);
      if (res.success) {
        triggerHaptic('success');
        Alert.alert('Participating!', 'You have successfully joined the live auction engine.');
        fetchParticipation();
      } else {
        triggerHaptic('error');
        Alert.alert('Failed to Join', res.message);
      }
    } catch (err: any) {
      triggerHaptic('error');
      Alert.alert('Failed to Join', err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleContactPress = async () => {
    if (!id) return;
    setInitiatingChat(true);
    try {
      const convId = await createAuctionConversation(id);
      router.push(`/chat/${convId}`);
    } catch (err: any) {
      Alert.alert('Unable to Contact', err.message);
    } finally {
      setInitiatingChat(false);
    }
  };

  const handlePlaceBidAmount = async (amountVal?: number) => {
    if (!user || !auction) {
      Alert.alert('Sign In Required', 'Please sign in to place bids.');
      return;
    }
    if (isSeller) {
      Alert.alert('Seller Blocked', 'You cannot place bids on your own auctions.');
      return;
    }
    if (participant?.status !== 'active') {
      Alert.alert('Join Required', 'You must join this auction before placing a bid.');
      return;
    }

    const price = auction.current_price;
    const increment = auction.minimum_bid_increment;
    const startPrice = auction.starting_price;
    const nextMinBid = price > 0 ? price + increment : startPrice;

    const bidVal = amountVal ?? parseFloat(bidAmountStr);
    if (isNaN(bidVal) || bidVal <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid numeric bid amount.');
      return;
    }
    if (bidVal < nextMinBid) {
      Alert.alert(
        'Bid Too Low',
        `Your bid is too low. The minimum allowed next bid is ₹${nextMinBid.toLocaleString('en-IN')}.`
      );
      return;
    }

    setPlacingBid(true);
    try {
      const result = await placeBid(id!, bidVal);
      if (result.success) {
        triggerHaptic('success');
        setBidAmountStr('');
        refresh();
        Alert.alert('Bid Success', 'Your bid was accepted and recorded in the database.');
      } else {
        triggerHaptic('error');
        if (result.message.includes('at least')) {
          Alert.alert('Outbid!', 'Someone else placed a higher bid during your submission. Please verify the new price and try again.');
        } else {
          Alert.alert('Bid Rejected', result.message);
        }
        refresh();
      }
    } catch (err: any) {
      triggerHaptic('error');
      Alert.alert('Error', err.message || 'Unable to submit bid. Please check your network and try again.');
      refresh();
    } finally {
      setPlacingBid(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!auction) return;
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
        updates.current_price = startPrice;
      }

      await updateAuction(auction.id, updates);
      Alert.alert('Success', 'Listing updated successfully.');
      setShowManageModal(false);
      refresh();
    } catch (err: any) {
      Alert.alert('Failed to Edit', err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelPress = () => {
    if (!auction) return;
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
              refresh();
            } catch (err: any) {
              Alert.alert('Failed to Cancel', err.message);
            }
          },
        },
      ]
    );
  };

  const maskUsername = (username?: string) => {
    if (!username) return 'Anonymous';
    if (username.length <= 2) return `${username.charAt(0)}*`;
    return `${username.charAt(0)}***${username.charAt(username.length - 1)}`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = +new Date() - +new Date(dateStr);
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString('en-IN');
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
  const isJoined = participant?.status === 'active';

  // Determine badges & visual options based on real database status
  let statusText = 'Live';
  let badgeType: 'success' | 'warning' | 'error' | 'neutral' = 'success';
  if (currentStatus === 'scheduled') {
    statusText = 'Upcoming';
    badgeType = 'warning';
  } else if (currentStatus === 'ended') {
    statusText = 'Ended';
    badgeType = 'neutral';
  } else if (currentStatus === 'cancelled') {
    statusText = 'Cancelled';
    badgeType = 'error';
  }

  const nextMinBidAmount = auction.current_price > 0 
    ? auction.current_price + auction.minimum_bid_increment 
    : auction.starting_price;

  // Convenient bid chips suggestions
  const bidSuggestions = [nextMinBidAmount, nextMinBidAmount + 500, nextMinBidAmount + 1000, nextMinBidAmount + 2000];

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Navigation Header */}
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-stone-200 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft size={20} color="#1A1A1A" />
        </Pressable>
        
        <Text className="font-display font-extrabold text-brand-text text-base">
          {currentStatus === 'live' ? '⚡ Live Auction' : 'Auction Details'}
        </Text>

        {isSeller ? (
          <Pressable onPress={() => setShowManageModal(true)} className="p-2 -mr-2">
            <Settings size={20} color="#FF6B35" />
          </Pressable>
        ) : (
          <Pressable className="p-2 -mr-2">
            <Share2 size={20} color="#1A1A1A" />
          </Pressable>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Horizontal Photo Gallery */}
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
                {auction.images.map((img: any) => (
                  <View key={img.id} style={{ width: Platform.OS === 'web' ? '100%' : 400 }} className="aspect-[4/3]">
                    <Image
                      source={{ uri: getAuctionImageUrl(img.storage_path) }}
                      contentFit="cover"
                      className="w-full h-full"
                    />
                  </View>
                ))}
              </ScrollView>
              
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

        {/* Offline Warning banner */}
        {(!isOnline || !isConnected) && (
          <View className="flex-row items-center justify-center bg-brand-error/10 border-b border-brand-error/20 py-2.5 px-4 gap-2">
            <AlertCircle size={14} color="#E71D36" />
            <Text className="text-xs font-display font-semibold text-brand-error">
              {!isOnline ? "You're offline" : "Connection lost. Reconnecting..."}
            </Text>
          </View>
        )}

        {/* Details Container */}
        <View className="w-full max-w-2xl mx-auto px-5 pt-5 pb-16">
          <Text className="text-xl font-display font-extrabold text-brand-text mb-1">
            {auction.title}
          </Text>

          {/* Live bidding stats count */}
          {currentStatus === 'live' && (
            <View className="flex-row items-center gap-1.5 mb-4">
              <Users size={12} color="#7F8C8D" />
              <Text className="text-xs font-display text-brand-muted font-medium">
                {participantCount} participating in this war
              </Text>
            </View>
          )}

          {/* Price details and countdown box */}
          <View className="w-full flex-row border border-stone-200 bg-white rounded-3xl p-5 mb-6 shadow-sm">
            <View className="flex-1">
              <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold tracking-wider mb-1">
                {currentStatus === 'scheduled' ? 'Starting Price' : 'Current Bid'}
              </Text>
              <PriceDisplay amount={auction.current_price} size="xl" className="text-brand-text" />
              <Text className="text-[10px] font-display text-brand-muted mt-1">
                Increment: ₹{(auction.minimum_bid_increment || 0).toLocaleString('en-IN')}
              </Text>
            </View>

            <View className="w-[1px] bg-stone-200 my-1 mx-4" />

            <View className="flex-1 items-end justify-center">
              <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold tracking-wider mb-1">
                {currentStatus === 'scheduled' ? 'Starts In' : currentStatus === 'ended' ? 'Finished' : 'Time Left'}
              </Text>
              {currentStatus === 'ended' || isExpired ? (
                <Text className="text-lg font-display font-bold text-brand-muted">Ended</Text>
              ) : currentStatus === 'cancelled' ? (
                <Text className="text-lg font-display font-bold text-brand-error">Cancelled</Text>
              ) : (
                <Text className="text-lg font-display font-bold text-brand-primary">
                  {timeLeft || 'Calculating...'}
                </Text>
              )}
            </View>
          </View>

          {/* Core Live Auction Bidding Panel */}
          {currentStatus === 'live' && !isExpired && (
            <View className="mb-6 bg-white border border-stone-200 p-5 rounded-3xl shadow-sm">
              {isSeller ? (
                <View className="items-center py-2">
                  <Text className="text-sm font-display font-bold text-brand-text mb-1">
                    Your Auction is Live!
                  </Text>
                  <Text className="text-xs font-display text-brand-muted text-center max-w-sm leading-relaxed">
                    Participants are placing bids in real time. Use the Settings icon in the top right to manage listing copy details.
                  </Text>
                </View>
              ) : !isJoined ? (
                // Pre-Join Interface
                <View className="gap-3">
                  <Text className="text-xs font-display text-brand-muted text-center leading-relaxed mb-1">
                    Join this auction to start placing bids and participate in the live pricing pool.
                  </Text>
                  <Button
                    label={joining ? 'Joining Pool...' : 'Join Live Auction'}
                    onPress={handleJoinAuction}
                    loading={joining}
                    disabled={joining || !isOnline || !isConnected}
                    icon={<Gavel size={18} color="#FFFFFF" />}
                    className="h-12 w-full"
                  />
                </View>
              ) : (
                // Active Bidder Panel
                <View className="gap-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5">
                      <View className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <Text className="text-xs font-display text-brand-muted font-bold">
                        You are participating
                      </Text>
                    </View>
                    
                    <Pressable
                      onPress={async () => {
                        Alert.alert('Leave Auction', 'Are you sure you want to opt-out?', [
                          { text: 'Keep Active', style: 'cancel' },
                          {
                            text: 'Leave',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const res = await leaveAuction(id!);
                                if (res.success) {
                                  Alert.alert('Left', 'You opted-out of this auction.');
                                  fetchParticipation();
                                } else {
                                  Alert.alert('Failed', res.message);
                                }
                              } catch (err: any) {
                                Alert.alert('Cannot Leave', err.message);
                              }
                            },
                          },
                        ]);
                      }}
                    >
                      <Text className="text-xs font-display font-semibold text-brand-muted underline">
                        Leave Pool
                      </Text>
                    </Pressable>
                  </View>

                  {/* Quick Bid Suggestion Chips */}
                  <View className="flex-row justify-between gap-2.5">
                    {bidSuggestions.map((val, idx) => (
                      <Pressable
                        key={idx}
                        onPress={() => handlePlaceBidAmount(val)}
                        disabled={placingBid || !isOnline || !isConnected}
                        className="flex-1 items-center justify-center py-2.5 bg-stone-50 border border-stone-200 rounded-xl active:bg-brand-primary/10 active:border-brand-primary"
                      >
                        <Text className="text-[10px] font-display text-brand-muted font-semibold mb-0.5">
                          {idx === 0 ? 'Min Bid' : `+₹${((val - nextMinBidAmount)).toLocaleString('en-IN')}`}
                        </Text>
                        <Text className="text-xs font-display font-bold text-brand-text">
                          ₹{val.toLocaleString('en-IN')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Manual Bid Input */}
                  <View className="flex-row gap-3">
                    <View className="flex-1 flex-row items-center bg-stone-50 border border-stone-200 rounded-2xl px-4 h-12">
                      <Text className="text-base font-display font-bold text-brand-muted mr-1.5">₹</Text>
                      <Input
                        placeholder={`Min ${nextMinBidAmount.toLocaleString('en-IN')}`}
                        value={bidAmountStr}
                        onChangeText={setBidAmountStr}
                        keyboardType="numeric"
                        editable={!placingBid}
                        className="flex-1 h-full bg-transparent border-0 font-display font-bold text-brand-text p-0 m-0"
                      />
                    </View>
                    <Button
                      label="Bid"
                      onPress={() => handlePlaceBidAmount()}
                      loading={placingBid}
                      disabled={placingBid || !isOnline || !isConnected}
                      className="h-12 px-6"
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Post-Auction Coordination Panel */}
          {currentStatus === 'ended' && (
            <View className="mb-6 bg-white border border-stone-200 p-5 rounded-3xl shadow-sm gap-3">
              {isSeller ? (
                auction.winner ? (
                  <View className="items-center py-1">
                    <Text className="text-base font-display font-bold text-brand-text mb-1">
                      🎉 Your Listing Sold!
                    </Text>
                    <Text className="text-xs font-display text-brand-muted text-center max-w-sm leading-relaxed mb-4">
                      Winning Bid: <Text className="font-bold text-brand-text">₹{auction.current_price.toLocaleString('en-IN')}</Text> by <Text className="font-bold text-brand-text">@{auction.winner.username}</Text>.
                    </Text>
                    <Button
                      label="Contact Winner"
                      onPress={handleContactPress}
                      loading={initiatingChat}
                      disabled={initiatingChat}
                      icon={<MessageSquare size={18} color="#FFFFFF" />}
                      className="h-12 w-full"
                    />
                  </View>
                ) : (
                  <View className="items-center py-2">
                    <Text className="text-sm font-display font-bold text-brand-text mb-1">
                      Auction Finished
                    </Text>
                    <Text className="text-xs font-display text-brand-muted text-center max-w-sm leading-relaxed">
                      No bids were placed on this listing. You can clone or republish it.
                    </Text>
                  </View>
                )
              ) : auction.winner_id === user?.id ? (
                <View className="items-center py-1">
                  <Text className="text-base font-display font-bold text-emerald-600 mb-1">
                    🎉 You Won This Auction!
                  </Text>
                  <Text className="text-xs font-display text-brand-muted text-center max-w-sm leading-relaxed mb-4">
                    Your winning bid was <Text className="font-bold text-brand-text">₹{auction.current_price.toLocaleString('en-IN')}</Text>. Connect with the seller <Text className="font-bold text-brand-text">@{auction.seller?.username}</Text> to complete transaction terms.
                  </Text>
                  <Button
                    label="Contact Seller"
                    onPress={handleContactPress}
                    loading={initiatingChat}
                    disabled={initiatingChat}
                    icon={<MessageSquare size={18} color="#FFFFFF" />}
                    className="h-12 w-full"
                  />
                </View>
              ) : (
                <View className="items-center py-2">
                  <Text className="text-sm font-display font-bold text-brand-text mb-1">
                    Auction Ended
                  </Text>
                  <Text className="text-xs font-display text-brand-muted text-center max-w-sm leading-relaxed">
                    This auction has ended. The winning bid was <Text className="font-bold text-brand-text">₹{auction.current_price.toLocaleString('en-IN')}</Text>.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Bid History Segment */}
          {currentStatus === 'live' && (
            <View className="mb-6 bg-white border border-stone-200 p-5 rounded-3xl shadow-sm">
              <Text className="text-sm font-display font-bold text-brand-text mb-3">
                Live Bid History
              </Text>
              
              {bids.length === 0 ? (
                <View className="py-4 items-center justify-center">
                  <Text className="text-xs font-display text-brand-muted">No bids placed yet. Be the first!</Text>
                </View>
              ) : (
                <View className="gap-2.5">
                  {bids.slice(0, 5).map((bid) => (
                    <Animated.View
                      key={bid.id}
                      entering={FadeInUp.duration(300)}
                      layout={Layout.springify()}
                      className="flex-row items-center justify-between py-2 border-b border-stone-100 last:border-0"
                    >
                      <View className="flex-row items-center">
                        <View className="w-8 h-8 rounded-full bg-brand-primary/10 border border-brand-primary/20 items-center justify-center mr-2.5">
                          <Text className="text-xs font-display font-bold text-brand-primary">
                            {bid.bidder?.username?.charAt(0).toUpperCase() || 'U'}
                          </Text>
                        </View>
                        <View>
                          <Text className="text-xs font-display font-bold text-brand-text">
                            @{maskUsername(bid.bidder?.username)}
                          </Text>
                          <Text className="text-[9px] font-display text-brand-muted">
                            {formatTimeAgo(bid.created_at)}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-sm font-display font-extrabold text-brand-text">
                        ₹{bid.amount.toLocaleString('en-IN')}
                      </Text>
                    </Animated.View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Item Description */}
          <View className="mb-6 bg-white border border-stone-200 p-5 rounded-3xl shadow-sm">
            <Text className="text-sm font-display font-bold text-brand-text mb-2">
              Item Description
            </Text>
            <Text className="text-xs font-display text-brand-muted leading-relaxed">
              {auction.description || 'No description provided by the seller.'}
            </Text>
          </View>

          {/* Seller details card */}
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
