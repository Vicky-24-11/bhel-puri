import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Gavel, Calendar, Archive, XCircle, ArrowUpRight } from 'lucide-react-native';
import { Image } from 'expo-image';

import { useAuth } from '@/lib/AuthContext';
import { getMyAuctions } from '@/services/auctionService';
import { Auction } from '@/types/database.types';
import { PriceDisplay } from '@/components/ui/PriceDisplay';

type TabType = 'live' | 'scheduled' | 'ended' | 'cancelled';

export default function MyAuctionsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('live');
  const [listings, setListings] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyListings = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getMyAuctions(user.id);
      setListings(data);
    } catch (err: any) {
      console.error('Error fetching my auctions:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyListings();
  }, [user, fetchMyListings]);

  // Filter listings based on selected tab state
  const filteredListings = listings.filter((item) => {
    const status = item.status.toLowerCase();
    if (activeTab === 'ended') {
      return status === 'ended' || status === 'completed';
    }
    return status === activeTab;
  });

  const renderIcon = (tab: TabType, color: string) => {
    if (tab === 'live') return <Gavel size={16} color={color} />;
    if (tab === 'scheduled') return <Calendar size={16} color={color} />;
    if (tab === 'ended') return <Archive size={16} color={color} />;
    return <XCircle size={16} color={color} />;
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header */}
      <View className="px-5 py-3 flex-row items-center justify-between border-b border-stone-200 bg-white">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center bg-white border border-stone-200 rounded-full shadow-sm active:bg-stone-50"
          >
            <ArrowLeft size={20} color="#1A1A1A" />
          </Pressable>
          <View>
            <Text className="text-xl font-display font-extrabold text-brand-text">
              My Auctions
            </Text>
            <Text className="text-xs font-display text-brand-muted">
              Manage your listed auction sales
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs list */}
      <View className="flex-row border-b border-stone-100 bg-white px-2">
        {([
          { label: 'Active', value: 'live' },
          { label: 'Upcoming', value: 'scheduled' },
          { label: 'Ended', value: 'ended' },
          { label: 'Cancelled', value: 'cancelled' },
        ] as const).map((tab) => {
          const isActive = activeTab === tab.value;
          const activeColor = isActive ? '#FF6B35' : '#7F8C8D';
          return (
            <Pressable
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              className="flex-1 py-3.5 items-center justify-center flex-row gap-1.5"
              style={{
                borderBottomWidth: isActive ? 2 : 0,
                borderBottomColor: '#FF6B35',
              }}
            >
              {renderIcon(tab.value, activeColor)}
              <Text
                className={`text-xs font-display font-bold ${
                  isActive ? 'text-brand-primary' : 'text-brand-muted'
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Listings List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : filteredListings.length === 0 ? (
        <ScrollView className="flex-1 pt-20 px-6">
          <View className="items-center py-16 bg-white rounded-3xl border border-stone-200 shadow-sm px-6">
            <View className="w-16 h-16 rounded-full bg-brand-primary/10 items-center justify-center mb-4">
              {renderIcon(activeTab, '#FF6B35')}
            </View>
            <Text className="text-lg font-display font-bold text-brand-text mb-1 capitalize">
              No {activeTab === 'live' ? 'Active' : activeTab} Auctions
            </Text>
            <Text className="text-sm font-display text-brand-muted text-center max-w-xs leading-relaxed">
              You do not have any listings categorized under this status.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredListings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/auction/${item.id}` as any)}
              className="bg-white border border-stone-200 rounded-3xl p-4.5 mb-4 shadow-sm flex-row gap-4 active:opacity-95"
            >
              {/* Product mini image */}
              <View className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100">
                {item.primary_image_url ? (
                  <Image
                    source={{ uri: item.primary_image_url }}
                    className="w-full h-full"
                    contentFit="cover"
                  />
                ) : (
                  <Image
                    source={require('@/assets/images/sofa_mockup.jpg')}
                    className="w-full h-full"
                    contentFit="cover"
                  />
                )}
              </View>

              {/* Title & info */}
              <View className="flex-1 justify-between py-0.5">
                <View>
                  <Text numberOfLines={1} className="font-display font-bold text-brand-text text-sm">
                    {item.title}
                  </Text>
                  <Text className="text-[10px] font-display text-brand-muted capitalize mt-0.5">
                    Status: {item.status}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-[9px] font-display text-brand-muted uppercase font-semibold">
                      Current Price
                    </Text>
                    <PriceDisplay amount={item.current_price} size="sm" className="text-brand-text mt-0.5" />
                  </View>

                  <View className="flex-row items-center gap-1 bg-brand-primary/10 px-2.5 py-1 rounded-full">
                    <Text className="text-[10px] font-display font-bold text-brand-primary">Manage</Text>
                    <ArrowUpRight size={10} color="#FF6B35" />
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
