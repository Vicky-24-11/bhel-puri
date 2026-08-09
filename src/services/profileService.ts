import { supabase } from '../lib/supabase';
import { Profile } from '../types/database.types';

/**
 * Fetches the user profile by ID from Supabase.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.code === '42P01') {
      return null; // Return null if profile doesn't exist or tables are not created
    }
    console.error('Error in getProfile:', error);
    throw new Error('Unable to retrieve user profile. Please try again.');
  }

  return data;
}

/**
 * Upserts user profile updates to the profiles table.
 */
export async function updateProfile(profileUpdates: Partial<Profile> & { id: string }): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      ...profileUpdates,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error in updateProfile:', error);
    if (error.code === '23505') {
      throw new Error('That username is already taken. Please choose another one.');
    }
    throw new Error('Unable to update your profile. Please try again.');
  }

  return data;
}

/**
 * Verifies if a given username is unique and not occupied by another user.
 */
export async function isUsernameAvailable(username: string, userId: string): Promise<boolean> {
  const cleanUsername = username.trim().toLowerCase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', cleanUsername)
    .neq('id', userId);

  if (error) {
    console.error('Error in isUsernameAvailable:', error);
    throw new Error('Verification failed. Please try again.');
  }

  return !data || data.length === 0;
}
