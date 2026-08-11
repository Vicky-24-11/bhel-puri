import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, FlatList, AppState, AppStateStatus } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, ShieldCheck, AlertCircle, ShoppingBag } from 'lucide-react-native';
import { Image } from 'expo-image';
import { RealtimeChannel } from '@supabase/supabase-js';
import Animated, { FadeIn } from 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { getAuctionImageUrl } from '@/services/auctionService';
import { getMessages, sendMessage, markConversationMessagesRead } from '@/services/chatService';
import { Conversation, Message } from '@/types/database.types';

// ES6 Haptics import
import * as Haptics from 'expo-haptics';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  // Connection & loading states
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Pagination & sending states
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // References
  const chatChannelRef = useRef<RealtimeChannel | null>(null);

  // Monitor network online/offline state
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

  const triggerHaptic = () => {
    if (Haptics && Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // Fetch conversation metadata
  const fetchMetadata = useCallback(async () => {
    if (!id || !user) return;
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, auction:auctions(*, images:auction_images(*)), seller:profiles!conversations_seller_id_fkey(*), winner:profiles!conversations_winner_id_fkey(*)')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        // Map primary image path
        if (data.auction && data.auction.images && data.auction.images.length > 0) {
          const sortedImgs = [...data.auction.images].sort((a, b) => a.display_order - b.display_order);
          data.auction.primary_image_url = sortedImgs[0].storage_path;
        }
        setConversation(data as Conversation);
      }
    } catch (err: any) {
      console.error('Error fetching conversation metadata:', err);
      Alert.alert('Error', 'Unable to retrieve chat metadata.');
    }
  }, [id, user]);

  // Fetch initial messages and mark them read
  const fetchInitialMessages = useCallback(async () => {
    if (!id || !user) return;
    try {
      setLoading(true);
      const history = await getMessages(id, 30);
      setMessages(history);
      if (history.length < 30) {
        setHasMore(false);
      }
      // Mark as read in DB
      await markConversationMessagesRead(id, user.id);
    } catch (err: any) {
      console.error('Error loading initial messages:', err);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  // Load older messages for pagination (scrolling up)
  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMore || messages.length === 0 || !id) return;
    setLoadingOlder(true);
    try {
      const oldestMsgTimestamp = messages[0].created_at;
      const older = await getMessages(id, 30, oldestMsgTimestamp);
      if (older.length < 30) {
        setHasMore(false);
      }
      setMessages((prev) => [...older, ...prev]);
    } catch (err) {
      console.error('Error paginating chat messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Sync details on Foreground Resume or Reconnection
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchMetadata(), fetchInitialMessages()]);
  }, [fetchMetadata, fetchInitialMessages]);

  useEffect(() => {
    refreshAll();
  }, [id, refreshAll]);

  // App State listener for background/foreground resumes
  useEffect(() => {
    const handleAppStateChange = (nextStatus: AppStateStatus) => {
      if (nextStatus === 'active') {
        refreshAll();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [refreshAll]);

  // Set up Realtime Message listener
  useEffect(() => {
    if (!id || !user) return;
    let active = true;

    const channel = supabase
      .channel(`chat_messages_${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        async (payload) => {
          if (!active) return;
          const newMsg = payload.new as Message;

          // Fetch profile details for sender to join locally
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single();

          const joinedMsg = {
            ...newMsg,
            sender: profile || undefined,
          };

          setMessages((prev) => {
            // Deduplicate message ID
            if (prev.some((m) => m.id === joinedMsg.id)) return prev;
            return [...prev, joinedMsg];
          });

          // If current user is not sender, mark read
          if (joinedMsg.sender_id !== user.id && active) {
            markConversationMessagesRead(id, user.id);
          }
        }
      )
      .subscribe();

    chatChannelRef.current = channel;

    return () => {
      active = false;
      if (chatChannelRef.current) {
        supabase.removeChannel(chatChannelRef.current);
      }
    };
  }, [id, user]);

  const handleSend = async () => {
    const cleanText = inputText.trim();
    if (!cleanText || sending || !id || !isOnline) return;

    setSending(true);
    try {
      triggerHaptic();
      const newMsg = await sendMessage(id, cleanText);
      
      // Update state optimistically to guarantee immediate display
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setInputText('');
    } catch (err: any) {
      Alert.alert('Send Failure', err.message || 'Couldn\'t send message. Try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-brand-background items-center justify-center">
        <ActivityIndicator size="large" color="#FF6B35" />
      </SafeAreaView>
    );
  }

  const otherUser = user?.id === conversation?.seller_id ? conversation?.winner : conversation?.seller;
  const isSeller = user?.id === conversation?.seller_id;
  const auctionTitle = conversation?.auction?.title || 'Listing Details';
  const winningPrice = conversation?.auction?.current_price || 0;

  // Reverse list order locally to support inverted rendering (newest bottom, oldest top)
  const renderedMessages = [...messages].reverse();

  return (
    <SafeAreaView className="flex-1 bg-brand-background">
      {/* Header Panel */}
      <View className="px-5 py-3 flex-row items-center border-b border-stone-200 bg-white">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2 mr-1">
          <ArrowLeft size={20} color="#1A1A1A" />
        </Pressable>

        <View className="flex-row items-center flex-1">
          {otherUser?.avatar_url ? (
            <Image source={{ uri: otherUser.avatar_url }} className="w-9 h-9 rounded-full mr-2.5 border border-stone-200" />
          ) : (
            <View className="w-9 h-9 rounded-full bg-brand-primary/10 border border-brand-primary/20 items-center justify-center mr-2.5">
              <Text className="font-display font-extrabold text-brand-primary text-sm">
                {otherUser?.username?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
          )}

          <View className="flex-1">
            <View className="flex-row items-center gap-1">
              <Text className="font-display font-extrabold text-brand-text text-sm" numberOfLines={1}>
                @{otherUser?.username || 'User'}
              </Text>
              {otherUser?.is_verified && <ShieldCheck size={13} color="#2EC4B6" />}
            </View>
            <Text className="text-[10px] font-display text-brand-muted" numberOfLines={1}>
              {isSeller ? 'Winning Bidder' : 'Listing Seller'}
            </Text>
          </View>
        </View>
      </View>

      {/* Offline Status banner */}
      {!isOnline && (
        <View className="flex-row items-center justify-center bg-brand-error/10 border-b border-brand-error/20 py-2 px-4 gap-1.5">
          <AlertCircle size={13} color="#E71D36" />
          <Text className="text-[11px] font-display font-semibold text-brand-error">
            {"You're offline. Reconnecting..."}
          </Text>
        </View>
      )}

      {/* Context Product Card */}
      {conversation?.auction && (
        <Pressable
          onPress={() => router.push(`/auction/${conversation.auction_id}`)}
          className="mx-4 mt-3 bg-stone-50 border border-stone-200 rounded-3xl p-3 flex-row items-center shadow-sm"
        >
          <View className="w-10 h-10 rounded-xl overflow-hidden bg-stone-100 mr-3">
            {conversation.auction.primary_image_url ? (
              <Image source={{ uri: getAuctionImageUrl(conversation.auction.primary_image_url) }} className="w-full h-full" contentFit="cover" />
            ) : (
              <View className="w-full h-full items-center justify-center bg-stone-200">
                <ShoppingBag size={14} color="#7F8C8D" />
              </View>
            )}
          </View>

          <View className="flex-1">
            <Text className="font-display font-bold text-brand-text text-xs" numberOfLines={1}>
              {auctionTitle}
            </Text>
            <Text className="text-[10px] font-display text-brand-muted">
              Winning Bid: <Text className="font-bold text-brand-primary">₹{winningPrice.toLocaleString('en-IN')}</Text>
            </Text>
          </View>

          <View className="bg-white border border-stone-200 px-3 py-1.5 rounded-full">
            <Text className="text-[9px] font-display font-bold text-brand-text">View Listing</Text>
          </View>
        </Pressable>
      )}

      {/* Messages Scroll Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        className="flex-1"
      >
        <FlatList
          data={renderedMessages}
          keyExtractor={(item) => item.id}
          inverted
          onEndReached={loadOlderMessages}
          onEndReachedThreshold={0.25}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          ListFooterComponent={
            loadingOlder ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#FF6B35" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="py-12 px-6 items-center">
              <Text className="text-base font-display font-bold text-brand-text mb-1 text-center">
                Start the conversation
              </Text>
              <Text className="text-xs font-display text-brand-muted text-center max-w-xs leading-relaxed">
                Discuss pickup, payment and handover details with the {isSeller ? 'winner' : 'seller'} here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.sender_id === user?.id;
            const messageTime = new Date(item.created_at).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <Animated.View
                entering={FadeIn.duration(150)}
                className={`flex-row mb-3.5 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  otherUser?.avatar_url ? (
                    <Image source={{ uri: otherUser.avatar_url }} className="w-6 h-6 rounded-full mr-2 self-end border border-stone-200" />
                  ) : (
                    <View className="w-6 h-6 rounded-full bg-brand-primary/10 border border-brand-primary/20 items-center justify-center mr-2 self-end">
                      <Text className="font-display font-bold text-brand-primary text-[10px]">
                        {otherUser?.username?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )
                )}

                <View className="max-w-[75%]">
                  <View
                    style={{
                      borderTopRightRadius: isMe ? 4 : 20,
                      borderTopLeftRadius: isMe ? 20 : 4,
                    }}
                    className={`px-4 py-3 rounded-3xl ${isMe ? 'bg-brand-primary' : 'bg-stone-100 border border-stone-200'}`}
                  >
                    <Text className={`text-xs font-display leading-relaxed ${isMe ? 'text-white' : 'text-brand-text'}`}>
                      {item.content}
                    </Text>
                  </View>
                  <View className={`flex-row items-center mt-1 px-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <Text className="text-[8px] font-display text-brand-muted mr-1.5">{messageTime}</Text>
                    {isMe && (
                      <Text className="text-[8px] font-display text-brand-muted">
                        {item.read_at ? 'Read' : 'Sent'}
                      </Text>
                    )}
                  </View>
                </View>
              </Animated.View>
            );
          }}
        />

        {/* Input Text Composer */}
        <View className="p-4 border-t border-stone-200 bg-white flex-row items-center gap-3">
          <View className="flex-1 bg-stone-50 border border-stone-200 rounded-3xl px-4 h-12 flex-row items-center">
            <TextInput
              placeholder={isOnline ? "Type a message..." : "Disconnected"}
              value={inputText}
              onChangeText={setInputText}
              editable={!sending && isOnline}
              maxLength={2000}
              className="flex-1 h-full font-display text-xs text-brand-text p-0 m-0 bg-transparent"
            />
          </View>

          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || sending || !isOnline}
            className={`w-12 h-12 rounded-full items-center justify-center ${inputText.trim() && isOnline ? 'bg-brand-primary active:bg-brand-primary/95' : 'bg-stone-100'}`}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={16} color={inputText.trim() && isOnline ? '#FFFFFF' : '#B2BEC3'} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
