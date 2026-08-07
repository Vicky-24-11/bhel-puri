import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Gavel } from 'lucide-react-native';

import { mockAuctions } from '@/mocks/auctions';
import { AuctionCard } from '@/components/ui/AuctionCard';
import { Input } from '@/components/ui/Input';

export default function AuctionsScreen() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'vehicles' | 'electronics' | 'watches' | 'furniture'>('all');

  const filteredAuctions = mockAuctions.filter((auc) => {
    const matchesFilter = activeFilter === 'all' || auc.category === activeFilter;
    const matchesSearch = auc.title.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      <View className="px-5 pt-3 pb-2 flex-row justify-between items-center border-b border-stone-200/50">
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            Marketplace
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            Discover live bidding wars
          </Text>
        </View>
        <Gavel size={24} color="#FF6B35" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="w-full max-w-5xl mx-auto px-5 pt-4 pb-12">
          {/* Search bar */}
          <Input
            placeholder="Search all listings..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Search size={18} color="#7F8C8D" />}
            containerClassName="mb-4"
          />

          {/* Quick Filters */}
          <View className="flex-row flex-wrap gap-2 mb-6">
            {(['all', 'vehicles', 'electronics', 'watches', 'furniture'] as const).map((filter) => {
              const isActive = activeFilter === filter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  className={`px-4 py-2 rounded-full border ${
                    isActive
                      ? 'bg-brand-text border-brand-text'
                      : 'bg-white border-stone-200/80'
                  }`}
                >
                  <Text
                    className={`text-xs font-display font-semibold capitalize ${
                      isActive ? 'text-white' : 'text-brand-text'
                    }`}
                  >
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Grid list of auctions */}
          {filteredAuctions.length === 0 ? (
            <View className="items-center py-20 bg-white rounded-3xl border border-brand-border/60 shadow-sm">
              <Text className="text-lg font-display font-bold text-brand-text mb-1">
                No Results Found
              </Text>
              <Text className="text-sm font-display text-brand-muted text-center max-w-xs px-4">
                Try widening your search terms or selecting another category.
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {filteredAuctions.map((auc) => (
                <View key={auc.id} className="w-full sm:w-[48%] md:w-[31%] mb-2">
                  <AuctionCard {...auc} />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
