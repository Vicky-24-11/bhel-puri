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

export type AuctionStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';

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
