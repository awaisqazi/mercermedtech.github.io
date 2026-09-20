/**
 * The one Supabase client the whole portal shares.
 *
 * Creating a second client would mean a second auth listener and a second
 * realtime socket, so everything imports this module instead.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The password-reset link arrives with the recovery token in the URL hash.
    detectSessionInUrl: true,
    storageKey: 'wb.auth',
    flowType: 'implicit',
  },
  realtime: {
    // One project channel at a time; a small cap keeps us well inside the
    // free tier's message budget even with a room full of people.
    params: { eventsPerSecond: 8 },
  },
  global: {
    headers: { 'x-client-info': 'mmt-workbench' },
  },
});
