import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, Bell, MessageSquare, ArrowUpRight, Award } from 'lucide-react-native';

import { mockAuctions } from '@/mocks/auctions';
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
  const [activeSegment, setActiveSegment] = useState<'watchlist' | 'alerts'>('watchlist');

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

  const renderNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'outbid':
        return <ArrowUpRight size={18} color="#E71D36" />;
      case 'won':
        return <Award size={18} color="#2EC4B6" />;
      case 'message':
        return <MessageSquare size={18} color="#FFB627" />;
      case 'ending':
        return <ClockIcon size={18} color="#FF6B35" />;
    }
  };

  // Minimal wrapper since Clock icon is simple
  const ClockIcon = ({ size, color }: { size: number; color: string }) => (
    <View className="items-center justify-center">
      <Heart size={size} color={color} />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Tab Segment Switcher Header */}
      <View className="px-5 pt-3 pb-2 border-b border-stone-200">
        <View className="flex-row bg-stone-100 rounded-xl p-1 mb-2">
          <Pressable
            onPress={() => setActiveSegment('watchlist')}
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
              activeSegment === 'watchlist' ? 'bg-white shadow-sm' : 'bg-transparent'
            }`}
          >
            <Heart size={16} color={activeSegment === 'watchlist' ? '#FF6B35' : '#7F8C8D'} className="mr-1.5" />
            <Text
              className={`text-sm font-display font-bold ${
                activeSegment === 'watchlist' ? 'text-brand-text' : 'text-brand-muted'
              }`}
            >
              Watchlist
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveSegment('alerts')}
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${
              activeSegment === 'alerts' ? 'bg-white shadow-sm' : 'bg-transparent'
            }`}
          >
            <Bell size={16} color={activeSegment === 'alerts' ? '#FF6B35' : '#7F8C8D'} className="mr-1.5" />
            <Text
              className={`text-sm font-display font-bold ${
                activeSegment === 'alerts' ? 'text-brand-text' : 'text-brand-muted'
              }`}
            >
              Alerts
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="w-full max-w-5xl mx-auto px-5 pt-4 pb-12">
          
          {/* WATCHLIST STREAM */}
          {activeSegment === 'watchlist' && (
            <View>
              <Text className="text-lg font-display font-bold text-brand-text mb-4">
                Saved Live Auctions
              </Text>
              
              <View className="flex-row flex-wrap justify-between">
                {/* For demonstration, display first two mock items */}
                {mockAuctions.slice(0, 2).map((auc) => (
                  <View key={auc.id} className="w-full sm:w-[48%] md:w-[31%] mb-2">
                    <AuctionCard {...auc} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ALERTS / NOTIFICATIONS FEED */}
          {activeSegment === 'alerts' && (
            <View>
              <Text className="text-lg font-display font-bold text-brand-text mb-4">
                Recent Activities
              </Text>

              {notifications.map((notif) => (
                <View
                  key={notif.id}
                  style={
                    notif.read
                      ? { borderColor: '#F5F5F5', opacity: 0.8 }
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
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
