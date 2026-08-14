import { supabase } from '@/lib/supabase';

export interface ReportPayload {
  reported_user_id?: string | null;
  auction_id?: string | null;
  reason: string;
  description?: string | null;
}

/**
 * Submits a new report for a listing or user.
 * Blocks duplicate reports and limits inputs server-side.
 */
export async function submitReport(payload: ReportPayload) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Please sign in to submit a report.');
  }

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: user.id,
      reported_user_id: payload.reported_user_id || null,
      auction_id: payload.auction_id || null,
      reason: payload.reason,
      description: payload.description ? payload.description.trim() : null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error submitting report service:', error);
    throw new Error(error.message || 'Unable to submit report.');
  }

  // Queue a confirmation notification for the reporter
  try {
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'auction_ended',
      title: '🛡️ Report Received',
      body: 'Your report has been logged and is under review. Thank you for keeping Bhel Puri safe.',
      auction_id: payload.auction_id || null,
    });
  } catch (notifErr) {
    console.warn('Failed to insert report submission notification:', notifErr);
  }

  return data;
}
