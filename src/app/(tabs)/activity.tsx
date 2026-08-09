import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, Bell, MessageSquare, ArrowUpRight, Award } from 'lucide-react-native';

import { useAuth } from '@/lib/AuthContext';
import { getWatchlist } from '@/services/auctionService';
import { getCategories } from '@/services/categoryService';
import { Auction, Category } from '@/types/database.types';
import { AuctionCard } from '@/components/ui/AuctionCard';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'outbid' | 'won' | 'message' | 'ending';
  time: string;
  read: boolean;
}

export default function ActivityScreen() {
  const { user } = useAuth();
  const [activeSegment, setActiveSegment] = useState<'watchlist' | 'alerts'>('watchlist');

  // Watchlist states
  const [watchlistItems, setWatchlistItems] = useState<Auction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);

  // Static mock notifications
  const notifications: NotificationItem[] = [
    {
      id: '1',
      title: '🚨 Outbid Warning!',
      body: 'You have been outbid on "iPhone 15 Pro Max". Current highest bid is ₹1,05,500.',
      type: 'outbid',
      time: '5 mins ago',
      read: false,
    },
    {
      id: '2',
      title: '💬 New message from Priya',
      body: '"Let us meet tomorrow at Starbucks to finalize the laptop deal."',
      type: 'message',
      time: '1 hour ago',
      read: false,
    },
    {
      id: '3',
      title: '🏆 You Won the Auction!',
      body: 'Congratulations! Your bid of ₹45,000 won "Sony Alpha 7 Camera". Tap to chat with the seller.',
      type: 'won',
      time: 'Yesterday',
      read: true,
    },
    {
      id: '4',
      title: '⏰ Auction ending soon',
      body: '"Ferrari Roma" ends in 12 minutes! Place your counter-bid now.',
      type: 'ending',
      time: '3 hours ago',
      read: true,
    }
  ];

  const fetchWatchlistData = React.useCallback(async () => {
    if (!user) return;
    try {
      const [list, cats] = await Promise.all([
        getWatchlist(user.id),
        getCategories()
      ]);
      setWatchlistItems(list);
      setCategories(cats);
    } catch (err) {
      console.error('Error fetching watchlist data:', err);
    } finally {
      setLoadingWatchlist(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchWatchlistData();
    }
  }, [user, fetchWatchlistData]);

  const renderNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'outbid':
        return <ArrowUpRight size={18} color="#E71D36" />;
      case 'won':
        return <Award size={18} color="#2EC4B6" />;
      case 'message':
        return <MessageSquare size={18} color="#FFB627" />;
      case 'ending':
        return <Heart size={18} color="#FF6B35" />;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Segment tabs */}
      <View className="px-5 pt-3 pb-2 border-b border-stone-200 bg-white">
        <View className="flex-row bg-stone-100 rounded-xl p-1 mb-1">
          <Pressable
            onPress={() => setActiveSegment('watchlist')}
            style={
              activeSegment === 'watchlist'
                ? {
                    backgroundColor: '#FFFFFF',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 1.5,
                    elevation: 2,
                  }
                : { backgroundColor: 'transparent' }
            }
            className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg"
          >
            <Heart size={16} color={activeSegment === 'watchlist' ? '#FF6B35' : '#7F8C8D'} className="mr-1.5" />
            <Text className={`text-sm font-display font-bold ${activeSegment === 'watchlist' ? 'text-brand-text' : 'text-brand-muted'}`}>
              Watchlist
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveSegment('alerts')}
            style={
              activeSegment === 'alerts'
                ? {
                    backgroundColor: '#FFFFFF',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 1.5,
                    elevation: 2,
                  }
                : { backgroundColor: 'transparent' }
            }
            className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg"
          >
            <Bell size={16} color={activeSegment === 'alerts' ? '#FF6B35' : '#7F8C8D'} className="mr-1.5" />
            <Text className={`text-sm font-display font-bold ${activeSegment === 'alerts' ? 'text-brand-text' : 'text-brand-muted'}`}>
              Alerts
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Content area */}
      {activeSegment === 'watchlist' ? (
        loadingWatchlist ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#FF6B35" />
          </View>
        ) : watchlistItems.length === 0 ? (
          <ScrollView className="flex-1 pt-20 px-6">
            <View className="items-center py-16 bg-white rounded-3xl border border-stone-200 shadow-sm px-6">
              <View className="w-16 h-16 rounded-full bg-brand-primary/10 items-center justify-center mb-4">
                <Heart size={32} color="#FF6B35" />
              </View>
              <Text className="text-lg font-display font-bold text-brand-text mb-1 text-center">
                Your Watchlist is Empty
              </Text>
              <Text className="text-sm font-display text-brand-muted text-center max-w-xs leading-relaxed">
                {"Save auctions you're interested in by tapping the heart icon on any listing card."}
              </Text>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={watchlistItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20 }}
            renderItem={({ item }) => (
              <AuctionCard
                id={item.id}
                title={item.title}
                current_price={item.current_price}
                ends_at={item.ends_at}
                starts_at={item.starts_at}
                category_name={categories.find((c) => c.id === item.category_id)?.name}
                status={item.status}
                bid_count={0}
                primary_image_url={item.primary_image_url}
              />
            )}
          />
        )
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }}>
          <Text className="text-lg font-display font-bold text-brand-text mb-4">
            Recent Activities
          </Text>

          {notifications.map((notif) => (
            <View
              key={notif.id}
              style={
                notif.read
                  ? { borderColor: '#E5E7EB', opacity: 0.8 }
                  : { borderColor: 'rgba(255, 107, 53, 0.15)', backgroundColor: 'rgba(255, 107, 53, 0.04)' }
              }
              className="w-full flex-row items-start p-4 mb-3 border rounded-2xl bg-white shadow-sm"
            >
              <View className="w-9 h-9 rounded-full bg-stone-100 items-center justify-center mr-3 mt-0.5">
                {renderNotificationIcon(notif.type)}
              </View>

              <View className="flex-1">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className={`font-display text-sm ${notif.read ? 'font-semibold text-brand-text' : 'font-bold text-brand-text'}`}>
                    {notif.title}
                  </Text>
                  <Text className="text-[10px] font-display text-brand-muted">
                    {notif.time}
                  </Text>
                </View>
                <Text className="text-xs font-display text-brand-muted leading-relaxed">
                  {notif.body}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
