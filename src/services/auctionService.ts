import { supabase } from '../lib/supabase';
import { Auction, AuctionImage } from '../types/database.types';

// Storage Upload Helper (converts file URI to blob for native/web cross-platform uploads)
export async function uploadAuctionImage(uri: string, sellerId: string, auctionId: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  
  const extension = uri.split('.').pop() || 'jpg';
  const fileName = `${sellerId}/${auctionId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
  
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(fileName, blob, {
      contentType: `image/${extension === 'png' ? 'png' : 'jpeg'}`,
    });

  if (error) {
    console.error('Error in uploadAuctionImage:', error);
    throw new Error('Failed to upload auction photo.');
  }

  return data.path;
}

// Delete Image Helper
export async function deleteAuctionImage(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from('product-images')
    .remove([storagePath]);

  if (error) {
    console.error('Error in deleteAuctionImage:', error);
    throw new Error('Failed to delete auction photo.');
  }
}

// Get Image URL Helper
export function getAuctionImageUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

export interface FetchAuctionsParams {
  categoryId?: string | null;
  status?: string | null;
  searchQuery?: string;
  sortBy?: 'newest' | 'ending_soon' | 'starting_soon' | 'price_low' | 'price_high';
  page?: number;
  limit?: number;
}

/**
 * Fetches all public auctions with optional filters, search queries, sorting, and pagination.
 */
export async function getAuctions({
  categoryId,
  status,
  searchQuery,
  sortBy = 'newest',
  page = 1,
  limit = 10,
}: FetchAuctionsParams): Promise<Auction[]> {
  let query = supabase.from('auctions').select('*, images:auction_images(*)');

  // Apply filters
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }
  if (status) {
    query = query.eq('status', status.toLowerCase());
  } else {
    // Default: only show live and scheduled/upcoming auctions publicly
    query = query.in('status', ['live', 'scheduled']);
  }
  if (searchQuery?.trim()) {
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
  }

  // Apply Sorting
  if (sortBy === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (sortBy === 'ending_soon') {
    query = query.order('ends_at', { ascending: true });
  } else if (sortBy === 'starting_soon') {
    query = query.order('starts_at', { ascending: true });
  } else if (sortBy === 'price_low') {
    query = query.order('current_price', { ascending: true });
  } else if (sortBy === 'price_high') {
    query = query.order('current_price', { ascending: false });
  }

  // Apply Range-based pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching auctions:', error);
    throw new Error('Unable to retrieve auctions. Please pull to refresh.');
  }

  const auctionsWithImages = (data || []).map((auc: any) => {
    const images = auc.images || [];
    const primaryImg = images.find((img: any) => img.display_order === 0) || images[0];
    return {
      ...auc,
      primary_image_url: primaryImg ? getAuctionImageUrl(primaryImg.storage_path) : undefined,
    };
  });

  return auctionsWithImages;
}

/**
 * Fetches live auctions ending soonest.
 */
export async function getFeaturedAuctions(): Promise<Auction[]> {
  return getAuctions({ status: 'live', sortBy: 'ending_soon', limit: 5 });
}

/**
 * Fetches live auctions ending shortly.
 */
export async function getEndingSoonAuctions(): Promise<Auction[]> {
  return getAuctions({ status: 'live', sortBy: 'ending_soon', limit: 5 });
}

/**
 * Fetches recently created active auctions.
 */
export async function getRecentAuctions(): Promise<Auction[]> {
  return getAuctions({ status: 'live', sortBy: 'newest', limit: 5 });
}

/**
 * Retrieves details of a specific auction by ID, including its seller profile and images.
 */
export async function getAuctionById(id: string): Promise<(Auction & { seller: any; images: AuctionImage[] }) | null> {
  const { data: auction, error: aucError } = await supabase
    .from('auctions')
    .select('*, seller:profiles!auctions_seller_id_fkey(*), images:auction_images(*)')
    .eq('id', id)
    .single();

  if (aucError) {
    if (aucError.code === 'PGRST116') return null;
    console.error('Error fetching auction by ID:', aucError);
    throw new Error('Unable to load auction details.');
  }

  return auction;
}

/**
 * Fetches all auctions listed by a specific seller.
 */
export async function getMyAuctions(sellerId: string): Promise<Auction[]> {
  const { data, error } = await supabase
    .from('auctions')
    .select('*, images:auction_images(*)')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error in getMyAuctions:', error);
    throw new Error('Unable to retrieve your listings.');
  }

  return (data || []).map((auc: any) => {
    const images = auc.images || [];
    const primaryImg = images.find((img: any) => img.display_order === 0) || images[0];
    return {
      ...auc,
      primary_image_url: primaryImg ? getAuctionImageUrl(primaryImg.storage_path) : undefined,
    };
  });
}

/**
 * Creates a new auction listing and uploads associated photos. 
 * Performs a rollback deletion of the database row and storage assets if the image upload fails.
 */
export async function createAuction(
  auctionData: Omit<Auction, 'id' | 'created_at' | 'updated_at'>,
  imageUris: string[]
): Promise<Auction> {
  // Step 1: Create the auction row in the database
  const { data: auction, error: auctionError } = await supabase
    .from('auctions')
    .insert({
      ...auctionData,
      status: auctionData.status.toLowerCase() as any,
    })
    .select()
    .single();

  if (auctionError) {
    console.error('Error in createAuction:', auctionError);
    throw new Error('Unable to create auction. Please check your parameters and try again.');
  }

  const uploadedPaths: string[] = [];
  try {
    // Step 2: Upload images one-by-one
    for (let i = 0; i < imageUris.length; i++) {
      const path = await uploadAuctionImage(imageUris[i], auctionData.seller_id, auction.id);
      uploadedPaths.push(path);
      
      const { error: imgError } = await supabase
        .from('auction_images')
        .insert({
          auction_id: auction.id,
          storage_path: path,
          display_order: i,
        });

      if (imgError) throw imgError;
    }
  } catch (uploadError) {
    console.error('Image upload failed, rolling back auction creation:', uploadError);
    // Cleanup any successfully uploaded assets from Supabase Storage
    if (uploadedPaths.length > 0) {
      try {
        await supabase.storage.from('product-images').remove(uploadedPaths);
      } catch (e) {
        console.error('Rollback storage removal failed:', e);
      }
    }
    // Delete the database listing to prevent orphan draft records
    try {
      await supabase.from('auctions').delete().eq('id', auction.id);
    } catch (e) {
      console.error('Rollback auction database delete failed:', e);
    }
    throw new Error('Auction creation failed because listing photos could not be uploaded.');
  }

  return auction;
}

/**
 * Updates non-sensitive details of an auction.
 */
export async function updateAuction(auctionId: string, updates: Partial<Auction>): Promise<Auction> {
  const { data, error } = await supabase
    .from('auctions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auctionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating auction:', error);
    throw new Error('Unable to update listing. Please verify parameters.');
  }

  return data;
}

/**
 * Cancels an active/upcoming auction.
 */
export async function cancelAuction(auctionId: string): Promise<void> {
  const { error } = await supabase
    .from('auctions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', auctionId);

  if (error) {
    console.error('Error cancelling auction:', error);
    throw new Error('Unable to cancel listing. Please try again.');
  }
}

/**
 * Adds an auction listing to the user's watchlist.
 */
export async function addToWatchlist(userId: string, auctionId: string): Promise<void> {
  const { error } = await supabase
    .from('watchlists')
    .insert({ user_id: userId, auction_id: auctionId });

  if (error) {
    console.error('Error in addToWatchlist:', error);
    throw new Error('Failed to add listing to your watchlist.');
  }
}

/**
 * Removes an auction listing from the user's watchlist.
 */
export async function removeFromWatchlist(userId: string, auctionId: string): Promise<void> {
  const { error } = await supabase
    .from('watchlists')
    .delete()
    .eq('user_id', userId)
    .eq('auction_id', auctionId);

  if (error) {
    console.error('Error in removeFromWatchlist:', error);
    throw new Error('Failed to remove listing from your watchlist.');
  }
}

/**
 * Retrieves the list of auctions in the user's watchlist.
 */
export async function getWatchlist(userId: string): Promise<Auction[]> {
  const { data, error } = await supabase
    .from('watchlists')
    .select('*, auction:auctions(*, images:auction_images(*))')
    .eq('user_id', userId);

  if (error) {
    console.error('Error in getWatchlist:', error);
    throw new Error('Unable to retrieve your watchlist.');
  }

  return (data || [])
    .map((item: any) => {
      const auc = item.auction;
      if (!auc) return null;
      const images = auc.images || [];
      const primaryImg = images.find((img: any) => img.display_order === 0) || images[0];
      return {
        ...auc,
        primary_image_url: primaryImg ? getAuctionImageUrl(primaryImg.storage_path) : undefined,
      };
    })
    .filter(Boolean) as Auction[];
}
