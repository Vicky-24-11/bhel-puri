import { supabase } from '@/lib/supabase';
import { Conversation, Message } from '@/types/database.types';

/**
 * Initiates or retrieves the private chat conversation for an ended auction.
 * Only the seller or winner of the auction is authorized to call this.
 */
export async function createAuctionConversation(auctionId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_auction_conversation', {
    p_auction_id: auctionId,
  });

  if (error) {
    console.error('Error creating conversation:', error);
    throw new Error(error.message || 'Unable to establish chat conversation.');
  }

  return data as string;
}

/**
 * Retrieves the list of active conversations for the authenticated user,
 * joined with the corresponding auction details, seller/winner profiles, and the latest message.
 */
export async function getConversations(currentUserId: string): Promise<Conversation[]> {
  // 1. Fetch conversations with details
  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('*, auction:auctions(*, images:auction_images(*)), seller:profiles(*), winner:profiles(*), messages(*)')
    .or(`seller_id.eq.${currentUserId},winner_id.eq.${currentUserId}`)
    .order('updated_at', { ascending: false });

  if (convError) {
    console.error('Error fetching conversations:', convError);
    throw new Error('Unable to load conversations list.');
  }

  // 2. Fetch unread message counts in a single efficient query
  const { data: unreadMsgs, error: unreadError } = await supabase
    .from('messages')
    .select('conversation_id')
    .is('read_at', null)
    .neq('sender_id', currentUserId);

  if (unreadError) {
    console.error('Error counting unread messages:', unreadError);
  }

  const unreadLookup = (unreadMsgs || []).reduce((acc: Record<string, number>, msg: any) => {
    acc[msg.conversation_id] = (acc[msg.conversation_id] || 0) + 1;
    return acc;
  }, {});

  // 3. Map values and sort nested messages to extract the latest message
  return (convs || []).map((item: any) => {
    // Sort messages locally to ensure latest is at index 0
    const sortedMsgs = (item.messages || []).sort(
      (a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at)
    );
    
    // Map primary image for UI convenience
    if (item.auction && item.auction.images && item.auction.images.length > 0) {
      // Sort images by order
      const sortedImgs = [...item.auction.images].sort((a, b) => a.display_order - b.display_order);
      item.auction.primary_image_url = sortedImgs[0].storage_path;
    }

    return {
      ...item,
      last_message: sortedMsgs[0] || null,
      unread_count: unreadLookup[item.id] || 0,
    } as Conversation & { unread_count: number };
  });
}

/**
 * Retrieves the messages for a specific conversation, ordered chronologically.
 * Supports cursor-based pagination using the beforeDate timestamp.
 */
export async function getMessages(
  conversationId: string,
  limit = 30,
  beforeDate?: string
): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select('*, sender:profiles(*)')
    .eq('conversation_id', conversationId);

  if (beforeDate) {
    query = query.lt('created_at', beforeDate);
  }

  // Order desc to fetch latest first, then reverse on client to render chronologically from top-to-bottom
  const { data: records, error: fetchError } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fetchError) {
    console.error('Error fetching messages:', fetchError);
    throw new Error('Unable to retrieve message history.');
  }

  return (records || []).reverse() as Message[];
}

/**
 * Inserts a new message into a conversation via the secure RPC database transaction.
 */
export async function sendMessage(conversationId: string, content: string): Promise<Message> {
  const { data, error } = await supabase.rpc('send_chat_message', {
    p_conversation_id: conversationId,
    p_content: content,
  });

  if (error) {
    console.error('Error sending message:', error);
    throw new Error(error.message || 'Unable to submit message. Please try again.');
  }

  // Fetch the sender profile details to join with the message object in UI immediately
  const senderId = (data as any).sender_id;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', senderId)
    .single();

  return {
    ...(data as any),
    sender: profile,
  } as Message;
}

/**
 * Marks all messages from the other participant in the conversation as read.
 */
export async function markConversationMessagesRead(
  conversationId: string,
  currentUserId: string
): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', currentUserId)
    .is('read_at', null);

  if (error) {
    console.error('Error marking conversation read:', error);
  }
}
