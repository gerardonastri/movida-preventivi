/**
 * supabase.ts — Client singleton
 *
 * Importa questo file ovunque ti serva Supabase.
 * Il client viene istanziato una volta sola grazie al module scope di Vite.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Supabase] VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devono essere definite nel file .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Nessun login utente — app interna con anon key
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});