import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

export function getSupabaseClient(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Supabase Backend] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão configurados!');
  }

  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }
  );
}

/** Service-role client for trusted server jobs (Telegram webhook, etc). Bypasses RLS. */
export function getServiceRoleClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no servidor');
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
