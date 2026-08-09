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
