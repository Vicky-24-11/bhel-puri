import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Clock, MessageSquare, CheckCircle2, XCircle, ArrowUpRight, Award } from 'lucide-react-native';
import { Image } from 'expo-image';

import { useAuth } from '@/lib/AuthContext';
import { getTransactionsForUser, TransactionWithDetails } from '@/services/transactionService';
import { getAuctionImageUrl } from '@/services/auctionService';
import { PriceDisplay } from '@/components/ui/PriceDisplay';

type TabType = 'pending' | 'contacted' | 'completed' | 'cancelled';

export default function MyPurchasesScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getTransactionsForUser(user.id);
      // Filter where the current user is the buyer (purchased item)
      const purchasesOnly = data.filter((tx) => tx.buyer_id === user.id);
      setTransactions(purchasesOnly);
    } catch (err: any) {
      console.error('Error fetching purchases:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPurchases();
  }, [user, fetchPurchases]);

  const filteredPurchases = transactions.filter((tx) => tx.status === activeTab);

  const renderIcon = (tab: TabType, color: string) => {
    if (tab === 'pending') return <Clock size={16} color={color} />;
    if (tab === 'contacted') return <MessageSquare size={16} color={color} />;
    if (tab === 'completed') return <CheckCircle2 size={16} color={color} />;
    return <XCircle size={16} color={color} />;
  };

  const getTabLabel = (tab: TabType) => {
    if (tab === 'pending') return 'Pending';
    if (tab === 'contacted') return 'In Progress';
    if (tab === 'completed') return 'Completed';
    return 'Cancelled';
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
              My Purchases
            </Text>
            <Text className="text-xs font-display text-brand-muted">
              Auctions you won and purchased
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-stone-100 bg-white px-2">
        {([
          { label: 'Pending', value: 'pending' },
          { label: 'In Progress', value: 'contacted' },
          { label: 'Completed', value: 'completed' },
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

      {/* Purchases List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : filteredPurchases.length === 0 ? (
        <ScrollView className="flex-1 pt-20 px-6">
          <View className="items-center py-16 bg-white rounded-3xl border border-stone-200 shadow-sm px-6">
            <View className="w-16 h-16 rounded-full bg-brand-primary/10 items-center justify-center mb-4">
              {renderIcon(activeTab, '#FF6B35')}
            </View>
            <Text className="text-lg font-display font-bold text-brand-text mb-1">
              No {getTabLabel(activeTab)} Purchases
            </Text>
            <Text className="text-sm font-display text-brand-muted text-center max-w-xs leading-relaxed">
              You do not have any purchases categorized under this status.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredPurchases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => {
            const auctionImage =
              item.auction?.images && item.auction.images.length > 0
                ? getAuctionImageUrl(item.auction.images[0].storage_path)
                : null;

            return (
              <Pressable
                onPress={() => router.push(`/transaction/${item.id}` as any)}
                className="bg-white border border-stone-200 rounded-3xl p-4.5 mb-4 shadow-sm flex-row gap-4 active:opacity-95"
              >
                {/* Product Image */}
                <View className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100">
                  {auctionImage ? (
                    <Image
                      source={{ uri: auctionImage }}
                      className="w-full h-full"
                      contentFit="cover"
                    />
                  ) : (
                    <View className="w-full h-full items-center justify-center bg-stone-200">
                      <Award size={24} color="#BDC3C7" />
                    </View>
                  )}
                </View>

                {/* Details */}
                <View className="flex-1 justify-between py-0.5">
                  <View>
                    <Text numberOfLines={1} className="font-display font-bold text-brand-text text-sm">
                      {item.auction?.title || 'Completed Item'}
                    </Text>
                    <Text className="text-[10px] font-display text-brand-muted mt-0.5">
                      Seller: @{item.seller?.username || 'seller'}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-[9px] font-display text-brand-muted uppercase font-semibold">
                        Winning Price
                      </Text>
                      <PriceDisplay amount={item.amount} size="sm" className="text-brand-text mt-0.5" />
                    </View>

                    <View className="flex-row items-center gap-1 bg-brand-primary/10 px-2.5 py-1 rounded-full">
                      <Text className="text-[10px] font-display font-bold text-brand-primary">Details</Text>
                      <ArrowUpRight size={10} color="#FF6B35" />
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
