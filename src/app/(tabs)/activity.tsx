import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, Bell, MessageSquare, ArrowUpRight, Award, CheckCircle2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { getWatchlist, getAuctionImageUrl } from '@/services/auctionService';
import { getCategories } from '@/services/categoryService';
import { getConversations } from '@/services/chatService';
import { getNotifications, markNotificationRead, markAllNotificationsRead, getUnreadNotificationsCount } from '@/services/notificationService';
import { Auction, Category, Conversation, Notification } from '@/types/database.types';
import { AuctionCard } from '@/components/ui/AuctionCard';

export default function ActivityScreen() {
  const { user } = useAuth();
  const [activeSegment, setActiveSegment] = useState<'watchlist' | 'inbox' | 'alerts'>('watchlist');

  // Watchlist states
  const [watchlistItems, setWatchlistItems] = useState<Auction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);

  // Inbox states
  const [conversations, setConversations] = useState<(Conversation & { unread_count: number })[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [inboxUnreadTotal, setInboxUnreadTotal] = useState(0);

  // Alerts states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [alertsUnreadTotal, setAlertsUnreadTotal] = useState(0);

  // Realtime channel references
  const msgChannelRef = useRef<RealtimeChannel | null>(null);
  const notifChannelRef = useRef<RealtimeChannel | null>(null);

  // Load Watchlist Data
  const loadWatchlist = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingWatchlist(true);
      const [list, cats] = await Promise.all([getWatchlist(user.id), getCategories()]);
      setWatchlistItems(list);
      setCategories(cats);
    } catch (err) {
      console.error('Error fetching watchlist data:', err);
    } finally {
      setLoadingWatchlist(false);
    }
  }, [user]);

  // Load Inbox Data
  const loadInbox = useCallback(async () => {
    if (!user) return;
    try {
      if (loadingInbox) setLoadingInbox(true);
      const data = await getConversations(user.id);
      setConversations(data as any);
      const total = data.reduce((sum, item) => sum + (item.unread_count || 0), 0);
      setInboxUnreadTotal(total);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoadingInbox(false);
    }
  }, [user, loadingInbox]);

  // Load Alerts (Notifications)
  const loadAlerts = useCallback(async () => {
    if (!user) return;
    try {
      if (loadingAlerts) setLoadingAlerts(true);
      const data = await getNotifications();
      setNotifications(data);
      const unreadCount = await getUnreadNotificationsCount(user.id);
      setAlertsUnreadTotal(unreadCount);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoadingAlerts(false);
    }
  }, [user, loadingAlerts]);

  // Initial Loaders
  useEffect(() => {
    if (user) {
      loadWatchlist();
      loadInbox();
      loadAlerts();
    }
  }, [user, loadWatchlist, loadInbox, loadAlerts]);

  // Realtime Listeners setup for Messages and Notifications updates
  useEffect(() => {
    if (!user) return;
    let active = true;

    // A. Subscribe to any insert/update on the messages table to update inbox snippet and unread count
    const msgChannel = supabase
      .channel('inbox_realtime_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          if (active) loadInbox();
        }
      )
      .subscribe();
    msgChannelRef.current = msgChannel;

    // B. Subscribe to notifications updates specifically scoped to current user
    const notifChannel = supabase
      .channel(`notifications_realtime_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (active) loadAlerts();
        }
      )
      .subscribe();
    notifChannelRef.current = notifChannel;

    return () => {
      active = false;
      if (msgChannelRef.current) supabase.removeChannel(msgChannelRef.current);
      if (notifChannelRef.current) supabase.removeChannel(notifChannelRef.current);
    };
  }, [user, loadInbox, loadAlerts]);

  // Handle Mark All Alerts As Read
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      loadAlerts();
    } catch (err: any) {
      console.error('Mark all read error:', err.message);
    }
  };

  // Handle Notification tap (marks read and navigates)
  const handleNotificationTap = async (notif: Notification) => {
    try {
      if (!notif.is_read) {
        await markNotificationRead(notif.id);
        loadAlerts();
      }

      // Dynamic navigation targeting
      if (notif.type === 'new_message' && notif.conversation_id) {
        router.push(`/chat/${notif.conversation_id}`);
      } else if (notif.auction_id) {
        router.push(`/auction/${notif.auction_id}`);
      }
    } catch (err: any) {
      console.error('Notification tap handler fail:', err.message);
    }
  };

  const renderNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'outbid':
        return <ArrowUpRight size={16} color="#E71D36" />;
      case 'auction_won':
        return <Award size={16} color="#2EC4B6" />;
      case 'new_message':
        return <MessageSquare size={16} color="#FFB627" />;
      default:
        return <Bell size={16} color="#FF6B35" />;
    }
  };

  const formatLastMessageTime = (dateStr: string) => {
    const diff = +new Date() - +new Date(dateStr);
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return 'Just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Dynamic Segment selectors */}
      <View className="px-5 pt-3 pb-2 border-b border-stone-200 bg-white">
        <View className="flex-row bg-stone-100 rounded-xl p-1 mb-1">
          {/* Watchlist Tab */}
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
            <Heart size={15} color={activeSegment === 'watchlist' ? '#FF6B35' : '#7F8C8D'} className="mr-1" />
            <Text className={`text-[12px] font-display font-bold ${activeSegment === 'watchlist' ? 'text-brand-text' : 'text-brand-muted'}`}>
              Watchlist
            </Text>
          </Pressable>

          {/* Inbox Tab */}
          <Pressable
            onPress={() => setActiveSegment('inbox')}
            style={
              activeSegment === 'inbox'
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
            className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg relative"
          >
            <MessageSquare size={15} color={activeSegment === 'inbox' ? '#FF6B35' : '#7F8C8D'} className="mr-1" />
            <Text className={`text-[12px] font-display font-bold ${activeSegment === 'inbox' ? 'text-brand-text' : 'text-brand-muted'}`}>
              Inbox
            </Text>
            {inboxUnreadTotal > 0 && (
              <View className="absolute right-2 top-2 bg-brand-primary min-w-[16px] h-4 rounded-full items-center justify-center px-1">
                <Text className="text-[9px] font-display font-bold text-white leading-none">
                  {inboxUnreadTotal}
                </Text>
              </View>
            )}
          </Pressable>

          {/* Alerts Tab */}
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
            className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg relative"
          >
            <Bell size={15} color={activeSegment === 'alerts' ? '#FF6B35' : '#7F8C8D'} className="mr-1" />
            <Text className={`text-[12px] font-display font-bold ${activeSegment === 'alerts' ? 'text-brand-text' : 'text-brand-muted'}`}>
              Alerts
            </Text>
            {alertsUnreadTotal > 0 && (
              <View className="absolute right-2 top-2 bg-brand-primary min-w-[16px] h-4 rounded-full items-center justify-center px-1">
                <Text className="text-[9px] font-display font-bold text-white leading-none">
                  {alertsUnreadTotal}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Segment Views */}
      {activeSegment === 'watchlist' && (
        loadingWatchlist ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#FF6B35" />
          </View>
        ) : watchlistItems.length === 0 ? (
          <ScrollView className="flex-1 pt-12 px-6">
            <View className="items-center py-16 bg-white rounded-3xl border border-stone-200 shadow-sm px-6">
              <View className="w-14 h-14 rounded-full bg-brand-primary/10 items-center justify-center mb-4">
                <Heart size={24} color="#FF6B35" />
              </View>
              <Text className="text-base font-display font-bold text-brand-text mb-1 text-center">
                Your Watchlist is Empty
              </Text>
              <Text className="text-xs font-display text-brand-muted text-center max-w-xs leading-relaxed">
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
      )}

      {activeSegment === 'inbox' && (
        loadingInbox ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#FF6B35" />
          </View>
        ) : conversations.length === 0 ? (
          <ScrollView className="flex-1 pt-12 px-6">
            <View className="items-center py-16 bg-white rounded-3xl border border-stone-200 shadow-sm px-6">
              <View className="w-14 h-14 rounded-full bg-brand-primary/10 items-center justify-center mb-4">
                <MessageSquare size={24} color="#FF6B35" />
              </View>
              <Text className="text-base font-display font-bold text-brand-text mb-1 text-center">
                No Conversations Yet
              </Text>
              <Text className="text-xs font-display text-brand-muted text-center max-w-xs leading-relaxed">
                Once an auction you participate in ends, you can chat with the seller or winner directly here.
              </Text>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20 }}
            renderItem={({ item }) => {
              const otherUser = user?.id === item.seller_id ? item.winner : item.seller;
              const productTitle = item.auction?.title || 'Bhel Puri Item';
              const latestMsgText = item.last_message?.content || 'Conversation started';
              const lastMsgTime = item.last_message ? formatLastMessageTime(item.last_message.created_at) : '';
              const imgUrl = item.auction?.primary_image_url;

              return (
                <Pressable
                  onPress={() => router.push(`/chat/${item.id}`)}
                  className="flex-row items-center bg-white border border-stone-200 rounded-3xl p-4 mb-3 active:bg-stone-50 shadow-sm"
                >
                  {/* Product Image Context badge */}
                  <View className="w-12 h-12 rounded-2xl bg-stone-100 overflow-hidden mr-3.5 relative">
                    {imgUrl ? (
                      <Image source={{ uri: getAuctionImageUrl(imgUrl) }} className="w-full h-full" contentFit="cover" />
                    ) : (
                      <View className="w-full h-full items-center justify-center bg-stone-200">
                        <MessageSquare size={16} color="#7F8C8D" />
                      </View>
                    )}
                  </View>

                  <View className="flex-1">
                    <View className="flex-row justify-between items-baseline mb-0.5">
                      <Text className="font-display font-extrabold text-brand-text text-sm" numberOfLines={1}>
                        @{otherUser?.username || 'User'}
                      </Text>
                      {lastMsgTime ? (
                        <Text className="text-[10px] font-display text-brand-muted font-medium">
                          {lastMsgTime}
                        </Text>
                      ) : null}
                    </View>
                    
                    <Text className="text-[10px] font-display font-semibold text-brand-primary mb-1 uppercase tracking-wider">
                      {productTitle}
                    </Text>

                    <Text className={`text-xs font-display ${item.unread_count > 0 ? 'font-bold text-brand-text' : 'text-brand-muted'}`} numberOfLines={1}>
                      {latestMsgText}
                    </Text>
                  </View>

                  {item.unread_count > 0 && (
                    <View className="w-5 h-5 rounded-full bg-brand-primary items-center justify-center ml-2">
                      <Text className="text-[10px] font-display font-bold text-white">
                        {item.unread_count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        )
      )}

      {activeSegment === 'alerts' && (
        loadingAlerts ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#FF6B35" />
          </View>
        ) : notifications.length === 0 ? (
          <ScrollView className="flex-1 pt-12 px-6">
            <View className="items-center py-16 bg-white rounded-3xl border border-stone-200 shadow-sm px-6">
              <View className="w-14 h-14 rounded-full bg-brand-primary/10 items-center justify-center mb-4">
                <Bell size={24} color="#FF6B35" />
              </View>
              <Text className="text-base font-display font-bold text-brand-text mb-1 text-center">
                All Caught Up!
              </Text>
              <Text className="text-xs font-display text-brand-muted text-center max-w-xs leading-relaxed">
                {"We'll notify you here when you win an auction, get outbid, or receive new chat messages."}
              </Text>
            </View>
          </ScrollView>
        ) : (
          <View className="flex-1">
            {alertsUnreadTotal > 0 && (
              <View className="px-5 pt-3 pb-1 flex-row justify-between items-center bg-stone-50 border-b border-stone-100">
                <Text className="text-[10px] font-display font-bold text-brand-muted uppercase tracking-wider">
                  {alertsUnreadTotal} Unread alerts
                </Text>
                <Pressable onPress={handleMarkAllRead} className="flex-row items-center gap-1">
                  <CheckCircle2 size={13} color="#FF6B35" />
                  <Text className="text-xs font-display font-bold text-brand-primary">
                    Mark all read
                  </Text>
                </Pressable>
              </View>
            )}
            
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 20 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleNotificationTap(item)}
                  style={{
                    borderLeftWidth: item.is_read ? 0 : 3,
                    borderLeftColor: '#FF6B35',
                  }}
                  className={`flex-row items-start p-4 mb-3 border border-stone-200 rounded-3xl bg-white shadow-sm ${item.is_read ? 'opacity-85' : 'bg-brand-primary/5'}`}
                >
                  <View className="w-8 h-8 rounded-full bg-stone-100 items-center justify-center mr-3 mt-0.5">
                    {renderNotificationIcon(item.type)}
                  </View>

                  <View className="flex-1">
                    <View className="flex-row justify-between items-center mb-0.5">
                      <Text className={`font-display text-xs ${item.is_read ? 'font-semibold text-brand-muted' : 'font-extrabold text-brand-text'}`}>
                        {item.title}
                      </Text>
                      <Text className="text-[9px] font-display text-brand-muted">
                        {formatLastMessageTime(item.created_at)}
                      </Text>
                    </View>
                    <Text className="text-xs font-display text-brand-muted leading-relaxed">
                      {item.body}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        )
      )}
    </SafeAreaView>
  );
}
