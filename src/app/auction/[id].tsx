import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Gavel, MapPin, ShieldCheck, Heart, Share2 } from 'lucide-react-native';
import { Image } from 'expo-image';

import { mockAuctions } from '@/mocks/auctions';
import { Button } from '@/components/ui/Button';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { Badge } from '@/components/ui/Badge';

export default function AuctionDetailsScreen() {
  const { id } = useLocalSearchParams();
  
  // Find the target auction in our mock database
  const auction = mockAuctions.find((auc) => auc.id === id);

  const [bidAmount, setBidAmount] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentHighest, setCurrentHighest] = useState(auction?.currentHighestBid || 0);
  const [bidsCount, setBidsCount] = useState(auction?.bidCount || 0);

  if (!auction) {
    return (
      <SafeAreaView className="flex-1 bg-brand-background items-center justify-center p-5">
        <Text className="text-lg font-display font-bold text-brand-text mb-2">
          Auction Not Found
        </Text>
        <Text className="text-sm font-display text-brand-muted text-center mb-6">
          The requested listing could not be resolved or has expired.
        </Text>
        <Button label="Go back to Home" onPress={() => router.replace('/(tabs)')} />
      </SafeAreaView>
    );
  }

  const handlePlaceBid = () => {
    setErrorMsg('');
    setSuccessMsg('');
    const parsedBid = parseFloat(bidAmount.replace(/[^0-9]/g, ''));

    if (isNaN(parsedBid)) {
      setErrorMsg('Please enter a valid numerical bid amount.');
      return;
    }

    const minRequired = currentHighest + 100; // Mock minimum increment of ₹100
    if (parsedBid < minRequired) {
      setErrorMsg(`Bid must be at least ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(minRequired)}`);
      return;
    }

    // Success simulation
    setCurrentHighest(parsedBid);
    setBidsCount(bidsCount + 1);
    setSuccessMsg(`Congratulations! You are now the highest bidder at ₹${parsedBid.toLocaleString('en-IN')}`);
    setBidAmount('');
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Custom Header Row */}
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-stone-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft size={20} color="#1A1A1A" />
        </Pressable>
        
        <Text className="font-display font-extrabold text-brand-text text-base">
          Live Bidding Stream
        </Text>

        <Pressable className="p-2 -mr-2">
          <Share2 size={20} color="#1A1A1A" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Large Product Image */}
        <View className="w-full aspect-[4/3] bg-stone-100 relative">
          <Image
            source={auction.image}
            contentFit="cover"
            className="w-full h-full"
          />
          <View className="absolute bottom-4 left-5">
            <Badge label="Live Bids" type="success" size="md" />
          </View>
        </View>

        {/* Content details */}
        <View className="w-full max-w-2xl mx-auto px-5 pt-5 pb-16">
          
          <Text className="text-2xl font-display font-extrabold text-brand-text mb-2">
            {auction.title}
          </Text>

          <View className="flex-row items-center mb-5">
            <MapPin size={14} color="#7F8C8D" className="mr-1" />
            <Text className="text-xs font-display text-brand-muted">
              {auction.location}
            </Text>
          </View>

          {/* Pricing and Timer Details Dashboard Panel */}
          <View className="w-full flex-row border border-stone-200/80 bg-white rounded-3xl p-5 mb-6 shadow-sm">
            <View className="flex-1">
              <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold tracking-wider mb-1">
                Current Bid (Highest)
              </Text>
              <PriceDisplay amount={currentHighest} size="xl" className="text-brand-text" />
              <Text className="text-xs font-display text-brand-primary font-semibold mt-1">
                ⚡ {bidsCount} bids placed
              </Text>
            </View>

            <View className="w-[1px] bg-stone-200 my-1 mx-4" />

            <View className="flex-1 items-end justify-center">
              <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold tracking-wider mb-1">
                Remaining Time
              </Text>
              <CountdownTimer endTime={auction.endTime} className="text-lg" />
              <Text className="text-xs font-display text-brand-muted mt-1">
                Ends shortly
              </Text>
            </View>
          </View>

          {/* Place Bid Interactive Section */}
          <View className="w-full bg-white border border-stone-200/80 rounded-3xl p-5 mb-6 shadow-sm">
            <Text className="font-display font-bold text-brand-text mb-3">
              Place a Counter Bid
            </Text>

            <View className="flex-row gap-3 items-center mb-2">
              <View className="flex-1 flex-row items-center border border-stone-300 rounded-xl px-3.5 h-12 bg-stone-50">
                <Text className="font-display font-semibold text-brand-muted mr-1.5">₹</Text>
                <TextInput
                  placeholder={`Min ₹${(currentHighest + 100).toLocaleString('en-IN')}`}
                  keyboardType="numeric"
                  value={bidAmount}
                  onChangeText={setBidAmount}
                  className="flex-1 h-full font-display text-brand-text text-base"
                />
              </View>

              <Button
                label="Submit Bid"
                onPress={handlePlaceBid}
                icon={<Gavel size={16} color="#FFFFFF" />}
                className="h-12 px-5"
              />
            </View>

            {/* Verification Success/Error alerts */}
            {successMsg ? (
              <Text className="text-xs font-display font-semibold text-brand-success mt-2 ml-1">
                {successMsg}
              </Text>
            ) : errorMsg ? (
              <Text className="text-xs font-display font-semibold text-brand-error mt-2 ml-1">
                {errorMsg}
              </Text>
            ) : (
              <Text className="text-[10px] font-display text-brand-muted mt-2 ml-1">
                Min Bid Increment required is ₹100. Server timing is authoritative.
              </Text>
            )}
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-base font-display font-bold text-brand-text mb-2">
              Product Description
            </Text>
            <Text className="text-sm font-display text-brand-muted leading-relaxed">
              {auction.description}
            </Text>
          </View>

          {/* Seller Profile Card */}
          <View className="w-full bg-stone-50 border border-stone-100 rounded-2xl p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-brand-primary/10 border border-brand-primary/20 rounded-full items-center justify-center mr-3">
                <Text className="font-display font-bold text-brand-primary">
                  {auction.seller.name.charAt(0)}
                </Text>
              </View>
              <View>
                <View className="flex-row items-center gap-1">
                  <Text className="font-display font-bold text-brand-text text-sm">
                    {auction.seller.name}
                  </Text>
                  <ShieldCheck size={14} color="#2EC4B6" />
                </View>
                <Text className="text-[10px] font-display text-brand-muted">
                  Verified Bhel Puri Seller
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Heart size={14} color="#FFB627" fill="#FFB627" className="mr-1" />
              <Text className="text-xs font-display font-bold text-brand-text">
                {auction.seller.rating} Rating
              </Text>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
