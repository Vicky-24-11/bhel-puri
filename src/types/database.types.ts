export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  is_verified: boolean;
  rating: number;
  total_ratings: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export type AuctionStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled' | 'completed';

export type TransactionStatus = 'pending' | 'contacted' | 'completed' | 'cancelled';

export interface Transaction {
  id: string;
  auction_id: string;
  seller_id: string;
  buyer_id: string;
  winning_bid_id: string | null;
  amount: number;
  status: TransactionStatus;
  created_at: string;
  updated_at: string;
}

export interface Auction {
  id: string;
  seller_id: string;
  category_id: string;
  title: string;
  description: string | null;
  starting_price: number;
  current_price: number;
  minimum_bid_increment: number;
  starts_at: string;
  ends_at: string;
  status: AuctionStatus;
  highest_bidder_id?: string | null;
  winner_id: string | null;
  auction_type: 'forward' | 'reverse';
  minimum_price?: number | null;
  bid_count?: number;
  created_at: string;
  updated_at: string;
  primary_image_url?: string;
  images?: AuctionImage[];
}

export interface AuctionImage {
  id: string;
  auction_id: string;
  storage_path: string;
  display_order: number;
  created_at: string;
}

export type ParticipantStatus = 'active' | 'left' | 'winner' | 'lost';

export interface AuctionParticipant {
  id: string;
  auction_id: string;
  user_id: string;
  status: ParticipantStatus;
  joined_at: string;
  left_at: string | null;
  created_at: string;
}

export interface Bid {
  id: string;
  auction_id: string;
  bidder_id: string;
  amount: number;
  created_at: string;
  bidder?: {
    username: string;
    avatar_url: string | null;
    full_name: string | null;
  } | null;
}

export interface Conversation {
  id: string;
  auction_id: string;
  seller_id: string;
  winner_id: string;
  created_at: string;
  updated_at: string;
  auction?: Auction;
  seller?: Profile;
  winner?: Profile;
  last_message?: Message | null;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  sender?: Profile;
}

export type NotificationType = 'auction_won' | 'auction_ended' | 'new_message' | 'auction_started' | 'outbid' | 'auction_cancelled';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  auction_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  is_read: boolean;
  created_at: string;
  auction?: Auction;
  conversation?: Conversation;
}

export interface Rating {
  id: string;
  auction_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating_value: number;
  comment: string | null;
  created_at: string;
  reviewer?: Profile;
  auction?: Auction;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  auction_id: string | null;
  message_id: string | null;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed' | 'action_taken';
  created_at: string;
  updated_at: string;
}
