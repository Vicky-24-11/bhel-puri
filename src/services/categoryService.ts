import { supabase } from '../lib/supabase';
import { Category } from '../types/database.types';

/**
 * Fetches active categories from Supabase database.
 */
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error in getCategories:', error);
    throw new Error('Unable to retrieve categories. Please try again.');
  }

  return data || [];
}
