-- =====================================================================
-- BLACKED — Full Supabase schema
-- Run this entire file in your Supabase SQL editor.
-- Project: gvqgielvdmyvbvsvnmov
-- =====================================================================

-- ---------- 1. PROFILES ----------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 32),
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  uname text;
begin
  uname := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1),
    'user' || substr(new.id::text, 1, 6)
  );
  -- ensure unique
  while exists (select 1 from public.profiles where username = uname) loop
    uname := uname || floor(random() * 1000)::text;
  end loop;
  insert into public.profiles (id, username) values (new.id, uname);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------- 2. CHANNELS ----------------------------------------------
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  is_private boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

alter table public.channels enable row level security;
alter table public.channel_members enable row level security;

-- Helper function to avoid recursive RLS
create or replace function public.is_channel_member(_channel_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.channel_members
    where channel_id = _channel_id and user_id = _user_id
  );
$$;

drop policy if exists "Public channels visible to all auth users" on public.channels;
create policy "Public channels visible to all auth users"
  on public.channels for select to authenticated
  using (is_private = false or public.is_channel_member(id, auth.uid()) or created_by = auth.uid());

drop policy if exists "Auth users can create channels" on public.channels;
create policy "Auth users can create channels"
  on public.channels for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "Creator can update channel" on public.channels;
create policy "Creator can update channel"
  on public.channels for update to authenticated using (auth.uid() = created_by);

drop policy if exists "Creator can delete channel" on public.channels;
create policy "Creator can delete channel"
  on public.channels for delete to authenticated using (auth.uid() = created_by);

drop policy if exists "Members visible to channel members" on public.channel_members;
create policy "Members visible to channel members"
  on public.channel_members for select to authenticated
  using (public.is_channel_member(channel_id, auth.uid()) or user_id = auth.uid());

drop policy if exists "Users can join channels" on public.channel_members;
create policy "Users can join channels"
  on public.channel_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can leave channels" on public.channel_members;
create policy "Users can leave channels"
  on public.channel_members for delete to authenticated using (user_id = auth.uid());


-- ---------- 3. DIRECT MESSAGES ---------------------------------------
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references auth.users(id) on delete cascade,
  user2_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user1_id, user2_id),
  check (user1_id < user2_id)
);

alter table public.direct_messages enable row level security;

drop policy if exists "Participants can view DM" on public.direct_messages;
create policy "Participants can view DM"
  on public.direct_messages for select to authenticated
  using (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "Auth users can create DM" on public.direct_messages;
create policy "Auth users can create DM"
  on public.direct_messages for insert to authenticated
  with check (auth.uid() = user1_id or auth.uid() = user2_id);


-- ---------- 4. MESSAGES ----------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  dm_id uuid references public.direct_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  image_url text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  check (
    (channel_id is not null and dm_id is null)
    or (channel_id is null and dm_id is not null)
  ),
  check (char_length(content) <= 4000)
);

create index if not exists messages_channel_idx on public.messages(channel_id, created_at);
create index if not exists messages_dm_idx on public.messages(dm_id, created_at);

alter table public.messages enable row level security;

-- Helper for DM access
create or replace function public.is_dm_participant(_dm_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.direct_messages
    where id = _dm_id and (user1_id = _user_id or user2_id = _user_id)
  );
$$;

create or replace function public.can_view_channel(_channel_id uuid, _user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.channels c
    where c.id = _channel_id
      and (c.is_private = false or public.is_channel_member(c.id, _user_id) or c.created_by = _user_id)
  );
$$;

drop policy if exists "View messages in accessible channels/DMs" on public.messages;
create policy "View messages in accessible channels/DMs"
  on public.messages for select to authenticated using (
    (channel_id is not null and public.can_view_channel(channel_id, auth.uid()))
    or (dm_id is not null and public.is_dm_participant(dm_id, auth.uid()))
  );

drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages"
  on public.messages for insert to authenticated with check (
    auth.uid() = user_id and (
      (channel_id is not null and public.can_view_channel(channel_id, auth.uid()))
      or (dm_id is not null and public.is_dm_participant(dm_id, auth.uid()))
    )
  );

drop policy if exists "Users can update own messages" on public.messages;
create policy "Users can update own messages"
  on public.messages for update to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can delete own messages" on public.messages;
create policy "Users can delete own messages"
  on public.messages for delete to authenticated using (auth.uid() = user_id);


-- ---------- 5. REACTIONS ---------------------------------------------
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists reactions_message_idx on public.reactions(message_id);

alter table public.reactions enable row level security;

drop policy if exists "Reactions visible if message is" on public.reactions;
create policy "Reactions visible if message is"
  on public.reactions for select to authenticated using (true);

drop policy if exists "Auth users can react" on public.reactions;
create policy "Auth users can react"
  on public.reactions for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can remove own reactions" on public.reactions;
create policy "Users can remove own reactions"
  on public.reactions for delete to authenticated using (auth.uid() = user_id);


-- ---------- 6. REALTIME PUBLICATION ----------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.channels;
alter publication supabase_realtime add table public.direct_messages;

alter table public.messages replica identity full;
alter table public.reactions replica identity full;


-- ---------- 7. STORAGE BUCKETS ---------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('message-images', 'message-images', true)
on conflict (id) do update set public = true;

-- Avatar policies
drop policy if exists "Avatars are publicly accessible" on storage.objects;
create policy "Avatars are publicly accessible"
  on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Message image policies
drop policy if exists "Message images are publicly accessible" on storage.objects;
create policy "Message images are publicly accessible"
  on storage.objects for select using (bucket_id = 'message-images');

drop policy if exists "Users can upload message images" on storage.objects;
create policy "Users can upload message images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'message-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own message images" on storage.objects;
create policy "Users can delete own message images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'message-images' and (storage.foldername(name))[1] = auth.uid()::text);


-- ---------- 8. SEED CHANNELS (optional) ------------------------------
-- Run this once with a real user uuid to bootstrap default channels:
-- insert into public.channels (name, description, is_private, created_by)
-- values
--   ('general', 'The town square', false, '<your-user-id>'),
--   ('random', 'Anything goes', false, '<your-user-id>'),
--   ('introductions', 'Say hi 👋', false, '<your-user-id>');
