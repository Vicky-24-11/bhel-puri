import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, MapPin, Flame, Clock, Compass, Bell, SlidersHorizontal } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { router } from 'expo-router';

import { mockAuctions, mockCategories } from '@/mocks/auctions';
import { AuctionCard } from '@/components/ui/AuctionCard';

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLocation] = useState('Mumbai, MH');

  // Filter listings based on category selection and search query
  const filteredAuctions = mockAuctions.filter((auc) => {
    const matchesCategory = !selectedCategory || auc.category === selectedCategory;
    const matchesSearch =
      !searchQuery || auc.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Split listings for different sections
  const liveAuctions = filteredAuctions; // In this mock, all are live
  const endingSoon = filteredAuctions.filter((auc) => {
    const difference = +new Date(auc.endTime) - +new Date();
    return difference > 0 && difference < 30 * 60 * 1000; // ends in < 30 mins
  });
  const nearYou = filteredAuctions.filter((auc) =>
    auc.location.toLowerCase().includes(selectedLocation.split(',')[0].toLowerCase())
  );

  // Dynamic icon helper for categories
  const renderCategoryIcon = (iconName: string, color: string) => {
    // Resolve Lucide icon component dynamically
    const IconComponent = (LucideIcons as any)[
      iconName.charAt(0).toUpperCase() + iconName.slice(1)
    ] || LucideIcons.Package;
    return <IconComponent size={20} color={color} />;
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* 1. Header Area */}
      <View className="px-5 pt-3 pb-2 flex-row justify-between items-center">
        <View>
          <Text className="text-3xl font-display font-extrabold text-brand-primary tracking-tight">
            Bhel Puri
          </Text>
          <Text className="text-xs font-display font-semibold text-brand-muted uppercase tracking-widest mt-0.5">
            The Auction App
          </Text>
        </View>

        {/* Small Profile Avatar Mock & Notifications */}
        <View className="flex-row items-center gap-4">
          <Pressable
            onPress={() => router.push('/activity')}
            className="w-10 h-10 items-center justify-center bg-white border border-stone-200 rounded-full shadow-sm active:bg-stone-50"
          >
            <Bell size={20} color="#1A1A1A" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/profile')}
            style={{ borderColor: 'rgba(255, 107, 53, 0.2)' }}
            className="w-10 h-10 rounded-full bg-brand-secondary items-center justify-center border shadow-sm active:opacity-90"
          >
            <Text className="font-display font-bold text-brand-text">BP</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Max Width Container for Desktop Web */}
        <View className="w-full max-w-5xl mx-auto px-5 pb-12">
          
          {/* 2. Search & Location Bar */}
          <View className="flex-col md:flex-row gap-3 mt-4 mb-6">
            {/* Search Input */}
            <View className="flex-1 flex-row items-center bg-white border border-stone-200/80 rounded-2xl px-4 h-12 shadow-sm">
              <Search size={20} color="#7F8C8D" className="mr-3" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search auctions..."
                placeholderTextColor="#9CA3AF"
                className="flex-1 h-full text-base font-display text-brand-text"
              />
              <Pressable className="p-1">
                <SlidersHorizontal size={18} color="#7F8C8D" />
              </Pressable>
            </View>

            {/* Location selector */}
            <Pressable className="flex-row items-center bg-white border border-stone-200/80 rounded-2xl px-4 h-12 shadow-sm w-full md:w-auto md:min-w-[150px]">
              <MapPin size={18} color="#FF6B35" className="mr-2" />
              <View>
                <Text className="text-[10px] font-display text-brand-muted uppercase font-semibold">
                  Location
                </Text>
                <Text className="text-sm font-display font-bold text-brand-text">
                  {selectedLocation}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* 3. Horizontal Categories Section */}
          <View className="mb-8">
            <Text className="text-lg font-display font-bold text-brand-text mb-3">
              Browse Categories
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="py-1"
            >
              <Pressable
                onPress={() => setSelectedCategory(null)}
                className={`flex-row items-center px-4 py-2.5 mr-3 rounded-full border shadow-sm ${
                  selectedCategory === null
                    ? 'bg-brand-primary border-brand-primary'
                    : 'bg-white border-stone-200/80'
                }`}
              >
                <Compass size={18} color={selectedCategory === null ? '#FFFFFF' : '#FF6B35'} className="mr-2" />
                <Text
                  className={`text-sm font-display font-semibold ${
                    selectedCategory === null ? 'text-white' : 'text-brand-text'
                  }`}
                >
                  All
                </Text>
              </Pressable>

              {mockCategories.map((cat) => {
                const isActive = selectedCategory === cat.slug;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setSelectedCategory(cat.slug)}
                    className={`flex-row items-center px-4 py-2.5 mr-3 rounded-full border shadow-sm ${
                      isActive
                        ? 'bg-brand-primary border-brand-primary'
                        : 'bg-white border-stone-200/80'
                    }`}
                  >
                    <View className="mr-2">
                      {renderCategoryIcon(cat.icon, isActive ? '#FFFFFF' : '#FF6B35')}
                    </View>
                    <Text
                      className={`text-sm font-display font-semibold ${
                        isActive ? 'text-white' : 'text-brand-text'
                      }`}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 4. Active Auction Feeds */}
          {filteredAuctions.length === 0 ? (
            <View className="items-center py-16 bg-white rounded-3xl border border-brand-border/60 shadow-sm mt-4">
              <Text className="text-lg font-display font-bold text-brand-text mb-1">
                No Auctions Found
              </Text>
              <Text className="text-sm font-display text-brand-muted text-center max-w-xs px-4">
                We couldn&apos;t find any active listings matching &quot;{searchQuery}&quot; in this category.
              </Text>
            </View>
          ) : (
            <View>
              {/* 🔥 LIVE AUCTIONS SECTION */}
              <View className="mb-8">
                <View className="flex-row items-center mb-4">
                  <Flame size={20} color="#FF6B35" className="mr-2" />
                  <Text className="text-xl font-display font-extrabold text-brand-text">
                    Live Auctions
                  </Text>
                </View>
                {/* Responsive grid mapping */}
                <View className="flex-row flex-wrap justify-between">
                  {liveAuctions.map((auc) => (
                    <View key={auc.id} className="w-full sm:w-[48%] md:w-[31%] mb-2">
                      <AuctionCard {...auc} />
                    </View>
                  ))}
                </View>
              </View>

              {/* ⏰ ENDING SOON SECTION */}
              {endingSoon.length > 0 && (
                <View className="mb-8">
                  <View className="flex-row items-center mb-4">
                    <Clock size={20} color="#E71D36" className="mr-2" />
                    <Text className="text-xl font-display font-extrabold text-brand-text">
                      Ending Soon
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap justify-between">
                    {endingSoon.map((auc) => (
                      <View key={auc.id} className="w-full sm:w-[48%] md:w-[31%] mb-2">
                        <AuctionCard {...auc} />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* 📍 NEAR YOU SECTION */}
              {nearYou.length > 0 && (
                <View className="mb-4">
                  <View className="flex-row items-center mb-4">
                    <MapPin size={20} color="#2EC4B6" className="mr-2" />
                    <Text className="text-xl font-display font-extrabold text-brand-text">
                      Near You
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap justify-between">
                    {nearYou.map((auc) => (
                      <View key={auc.id} className="w-full sm:w-[48%] md:w-[31%] mb-2">
                        <AuctionCard {...auc} />
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
