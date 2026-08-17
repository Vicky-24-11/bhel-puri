import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, FlatList, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Gavel, Compass, SlidersHorizontal, Check } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getCategories } from '@/services/categoryService';
import { getAuctions, FetchAuctionsParams } from '@/services/auctionService';
import { Category, Auction } from '@/types/database.types';
import { AuctionCard } from '@/components/ui/AuctionCard';
import { finalizeExpiredAuctions } from '@/services/auctionFinalizationService';

export default function ExploreScreen() {
  const params = useLocalSearchParams<{
    category?: string;
    query?: string;
    status?: string;
    type?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
  }>();
  const router = useRouter();

  // Search, Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Price range state
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [debouncedMinPrice, setDebouncedMinPrice] = useState('');
  const [debouncedMaxPrice, setDebouncedMaxPrice] = useState('');

  // Sync category, search, and other routing parameters
  useEffect(() => {
    if (params.category !== undefined) {
      setSelectedCategory(params.category || null);
    }
    if (params.query !== undefined) {
      setSearchQuery(params.query || '');
      setDebouncedSearch(params.query || '');
    }
    if (params.status !== undefined) {
      setSelectedStatus(params.status as any || 'all');
    }
    if (params.type !== undefined) {
      setAuctionTypeFilter(params.type as any || 'all');
    }
    if (params.sort !== undefined) {
      setSortBy(params.sort as any || 'newest');
    }
    if (params.minPrice !== undefined) {
      setMinPrice(params.minPrice || '');
      setDebouncedMinPrice(params.minPrice || '');
    }
    if (params.maxPrice !== undefined) {
      setMaxPrice(params.maxPrice || '');
      setDebouncedMaxPrice(params.maxPrice || '');
    }
  }, [params.category, params.query, params.status, params.type, params.sort, params.minPrice, params.maxPrice]);
  
  // Advanced filters state
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'live' | 'scheduled' | 'ending_soon'>('all');
  const [auctionTypeFilter, setAuctionTypeFilter] = useState<'all' | 'forward' | 'reverse'>('all');
  const [sortBy, setSortBy] = useState<FetchAuctionsParams['sortBy']>('newest');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Pagination and listings state
  const [listings, setListings] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Debounce price inputs
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedMinPrice(minPrice);
      setDebouncedMaxPrice(maxPrice);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [minPrice, maxPrice]);

  // Sync state to Web URL parameters
  useEffect(() => {
    if (Platform.OS === 'web') {
      router.setParams({
        category: selectedCategory || '',
        query: debouncedSearch || '',
        status: selectedStatus || 'all',
        type: auctionTypeFilter || 'all',
        sort: sortBy || 'newest',
        minPrice: debouncedMinPrice || '',
        maxPrice: debouncedMaxPrice || '',
      });
    }
  }, [selectedCategory, debouncedSearch, selectedStatus, auctionTypeFilter, sortBy, debouncedMinPrice, debouncedMaxPrice, router]);

  // Load Categories on mount & sweep expired auctions
  useEffect(() => {
    finalizeExpiredAuctions().catch((err) => {
      console.warn('Lazy sweep of expired auctions failed:', err);
    });

    getCategories()
      .then((data) => {
        setCategories(data);
      })
      .catch((err) => {
        console.error('Error fetching categories:', err);
      });
  }, []);

  // Primary listings loader
  const loadListings = useCallback(
    async (pageNum: number, clearExisting = false) => {
      if (pageNum === 1) {
        if (!clearExisting) setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const categoryId = selectedCategory
          ? categories.find((c) => c.slug === selectedCategory)?.id
          : null;

        const minPriceNum = debouncedMinPrice ? parseFloat(debouncedMinPrice) : null;
        const maxPriceNum = debouncedMaxPrice ? parseFloat(debouncedMaxPrice) : null;

        const results = await getAuctions({
          categoryId,
          status: selectedStatus === 'all' ? null : (selectedStatus === 'ending_soon' ? 'live' : selectedStatus),
          searchQuery: debouncedSearch,
          sortBy: selectedStatus === 'ending_soon' ? 'ending_soon' : sortBy,
          page: pageNum,
          limit: 20,
          auctionType: auctionTypeFilter === 'all' ? null : auctionTypeFilter,
          minPrice: minPriceNum,
          maxPrice: maxPriceNum,
        });

        if (clearExisting) {
          setListings(results);
        } else {
          setListings((prev) => [...prev, ...results]);
        }
        setHasMore(results.length === 20);
      } catch (err) {
        console.error('Error loading explore listings:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedCategory, selectedStatus, auctionTypeFilter, debouncedSearch, sortBy, debouncedMinPrice, debouncedMaxPrice, categories]
  );

  // Reload listings on filter/search change
  useEffect(() => {
    setPage(1);
    loadListings(1, true);
  }, [selectedCategory, selectedStatus, auctionTypeFilter, debouncedSearch, sortBy, debouncedMinPrice, debouncedMaxPrice, loadListings]);

  // Fetch next page on scroll
  const handleLoadMore = () => {
    if (loadingMore || !hasMore || loading || refreshing) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadListings(nextPage, false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await loadListings(1, true);
    setRefreshing(false);
  };

  const handleClearAll = () => {
    setSearchQuery('');
    setSelectedCategory(null);
    setSelectedStatus('all');
    setAuctionTypeFilter('all');
    setSortBy('newest');
    setMinPrice('');
    setMaxPrice('');

    if (Platform.OS === 'web') {
      router.setParams({
        category: '',
        query: '',
        status: 'all',
        type: 'all',
        sort: 'newest',
        minPrice: '',
        maxPrice: '',
      });
    }
  };

  const isAnyFilterActive =
    selectedCategory !== null ||
    selectedStatus !== 'all' ||
    auctionTypeFilter !== 'all' ||
    sortBy !== 'newest' ||
    minPrice !== '' ||
    maxPrice !== '' ||
    searchQuery !== '';

  // Dynamic icon helper for categories
  const renderCategoryIcon = (iconName: string | null, color: string) => {
    if (!iconName) return <LucideIcons.Package size={16} color={color} />;
    const formattedName = iconName
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    const IconComponent = (LucideIcons as any)[formattedName] || LucideIcons.Package;
    return <IconComponent size={16} color={color} />;
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* 1. Header Bar */}
      <View className="px-5 pt-3 pb-2 flex-row justify-between items-center border-b border-stone-200">
        <View>
          <Text className="text-2xl font-display font-extrabold text-brand-text">
            Explore Auctions
          </Text>
          <Text className="text-xs font-display text-brand-muted mt-0.5">
            Discover active live bidding wars
          </Text>
        </View>
        <Gavel size={24} color="#FF6B35" />
      </View>

      {/* Explore content list */}
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-5 mb-2">
            <AuctionCard
              id={item.id}
              title={item.title}
              current_price={item.current_price}
              ends_at={item.ends_at}
              starts_at={item.starts_at}
              category_name={categories.find((c) => c.id === item.category_id)?.name}
              status={item.status}
              bid_count={item.bid_count}
              auction_type={item.auction_type}
              primary_image_url={item.primary_image_url}
            />
          </View>
        )}
        ListHeaderComponent={
          <View className="w-full max-w-5xl mx-auto pt-4">
            {/* Search Input and Filters toggle */}
            <View className="flex-row gap-3 px-5 mb-4 items-center">
              <View className="flex-1 flex-row items-center bg-white border border-stone-200 rounded-2xl px-4 h-12 shadow-sm">
                <Search size={20} color="#7F8C8D" className="mr-3" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search live or scheduled..."
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 h-full text-base font-display text-brand-text"
                />
              </View>
              <Pressable
                onPress={() => setShowFiltersModal(!showFiltersModal)}
                style={{
                  backgroundColor: showFiltersModal ? '#FF6B35' : '#FFFFFF',
                  borderColor: showFiltersModal ? '#FF6B35' : '#E5E7EB',
                }}
                className="w-12 h-12 border rounded-2xl items-center justify-center shadow-sm active:opacity-95"
              >
                <SlidersHorizontal size={20} color={showFiltersModal ? '#FFFFFF' : '#1A1A1A'} />
              </Pressable>
            </View>

            {/* Quick Categories Filter Slider */}
            <View className="mb-4">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              >
                <Pressable
                  onPress={() => setSelectedCategory(null)}
                  className={`flex-row items-center px-4 py-2 mr-3 rounded-full border shadow-sm ${
                    selectedCategory === null
                      ? 'bg-brand-primary border-brand-primary'
                      : 'bg-white border-stone-200'
                  }`}
                >
                  <Compass size={16} color={selectedCategory === null ? '#FFFFFF' : '#FF6B35'} className="mr-1.5" />
                  <Text className={`text-xs font-display font-semibold ${selectedCategory === null ? 'text-white' : 'text-brand-text'}`}>
                    All
                  </Text>
                </Pressable>

                {categories.map((cat) => {
                  const isActive = selectedCategory === cat.slug;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat.slug)}
                      className={`flex-row items-center px-4 py-2 mr-3 rounded-full border shadow-sm ${
                        isActive ? 'bg-brand-primary border-brand-primary' : 'bg-white border-stone-200'
                      }`}
                    >
                      <View className="mr-1.5">
                        {renderCategoryIcon(cat.icon, isActive ? '#FFFFFF' : '#FF6B35')}
                      </View>
                      <Text className={`text-xs font-display font-semibold ${isActive ? 'text-white' : 'text-brand-text'}`}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Auction Type Filter Row */}
            <View className="px-5 mb-3 flex-row gap-2">
              {([
                { label: 'All Requests', value: 'all' },
                { label: '🔨 Sell Auctions', value: 'forward' },
                { label: '🔄 Buy Requests', value: 'reverse' },
              ] as const).map((item) => {
                const isActive = auctionTypeFilter === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setAuctionTypeFilter(item.value)}
                    className={`flex-1 py-2.5 rounded-2xl border items-center justify-center shadow-sm ${
                      isActive ? 'bg-brand-primary border-brand-primary' : 'bg-white border-stone-200'
                    }`}
                  >
                    <Text className={`text-xs font-display font-bold ${isActive ? 'text-white' : 'text-brand-text'}`}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Detailed Filters Modal / Row Panel */}
            {showFiltersModal && (
              <View className="bg-white border-b border-stone-200 px-5 py-4 gap-4 mb-4">
                {/* 1. Status selector */}
                <View>
                  <Text className="text-xs font-display font-bold text-brand-text mb-2">
                    Filter by Status
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {([
                      { label: 'All Statuses', value: 'all' },
                      { label: 'Live Now', value: 'live' },
                      { label: 'Upcoming', value: 'scheduled' },
                      { label: 'Ending Soon', value: 'ending_soon' },
                    ] as const).map((item) => {
                      const isActive = selectedStatus === item.value;
                      return (
                        <Pressable
                          key={item.value}
                          onPress={() => setSelectedStatus(item.value)}
                          className={`px-3 py-2.5 rounded-xl border items-center ${
                            isActive ? 'bg-brand-text border-brand-text' : 'bg-stone-50 border-stone-200'
                          }`}
                        >
                          <Text className={`text-xs font-display font-bold ${isActive ? 'text-white' : 'text-brand-text'}`}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* 2. Sorting options */}
                <View>
                  <Text className="text-xs font-display font-bold text-brand-text mb-2">
                    Sort Results By
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {([
                      { label: 'Recommended', value: 'recommended' },
                      { label: 'Newest Listings', value: 'newest' },
                      { label: 'Ending Soonest', value: 'ending_soon' },
                      { label: 'Starting Soonest', value: 'starting_soon' },
                      { label: 'Price: Low to High', value: 'price_low' },
                      { label: 'Price: High to Low', value: 'price_high' },
                    ] as const).map((item) => {
                      const isActive = sortBy === item.value;
                      return (
                        <Pressable
                          key={item.value}
                          onPress={() => setSortBy(item.value)}
                          className={`flex-row items-center px-3.5 py-2 rounded-xl border gap-1.5 ${
                            isActive ? 'bg-brand-primary/10 border-brand-primary' : 'bg-stone-50 border-stone-200'
                          }`}
                        >
                          {isActive && <Check size={12} color="#FF6B35" />}
                          <Text className={`text-xs font-display font-bold ${isActive ? 'text-brand-primary' : 'text-brand-text'}`}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* 3. Price range input */}
                <View>
                  <Text className="text-xs font-display font-bold text-brand-text mb-2">
                    Price Range (₹)
                  </Text>
                  <View className="flex-row gap-3 items-center">
                    <TextInput
                      placeholder="Min Price"
                      value={minPrice}
                      onChangeText={setMinPrice}
                      keyboardType="numeric"
                      className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3.5 h-11 text-xs font-display text-brand-text"
                    />
                    <Text className="text-xs font-display text-brand-muted">to</Text>
                    <TextInput
                      placeholder="Max Price"
                      value={maxPrice}
                      onChangeText={setMaxPrice}
                      keyboardType="numeric"
                      className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3.5 h-11 text-xs font-display text-brand-text"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Results count & Clear actions */}
            <View className="px-5 mb-3 flex-row justify-between items-center">
              <Text className="text-xs font-display font-semibold text-brand-muted">
                Showing {listings.length} {listings.length === 1 ? 'auction' : 'auctions'}
              </Text>
              {isAnyFilterActive && (
                <Pressable onPress={handleClearAll} className="active:opacity-85">
                  <Text className="text-xs font-display font-bold text-brand-primary">
                    Clear All
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View className="mx-5 items-center py-20 bg-white rounded-3xl border border-stone-200 shadow-sm mt-2 px-6">
              <View className="w-16 h-16 rounded-full bg-brand-primary/10 items-center justify-center mb-4">
                <Gavel size={32} color="#FF6B35" />
              </View>
              <Text className="text-lg font-display font-bold text-brand-text mb-1">
                No Auctions Found
              </Text>
              <Text className="text-sm font-display text-brand-muted text-center max-w-xs px-2 leading-relaxed">
                {"We couldn't find any listings matching your search criteria. Try removing filters or searching other keywords."}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="small" color="#FF6B35" />
            </View>
          ) : loadingMore ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#FF6B35" />
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </SafeAreaView>
  );
}
