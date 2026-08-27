import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string;
  bio: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
};

export type CrownLog = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  mood: string;
  location: string;
  created_at: string;
  updated_at: string;
};
