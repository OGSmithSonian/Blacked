import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: localStorage,
  },
  realtime: {
    params: { eventsPerSecond: 20 },
  },
});

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

export type Channel = {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_by: string;
  created_at: string;
};

export type Message = {
  id: string;
  channel_id: string | null;
  dm_id: string | null;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  edited_at: string | null;
  profile?: Profile;
  reactions?: Reaction[];
};

export type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

export type DirectMessage = {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
};
