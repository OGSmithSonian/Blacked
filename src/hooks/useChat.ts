import { useEffect, useState, useRef, useCallback } from "react";
import { supabase, Message, Profile } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function useMessages(channelId: string | null, dmId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const profileCache = useRef<Map<string, Profile>>(new Map());

  const enrich = useCallback(async (msgs: Message[]): Promise<Message[]> => {
    const userIds = [...new Set(msgs.map((m) => m.user_id).filter((id) => !profileCache.current.has(id)))];
    if (userIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
      profiles?.forEach((p: Profile) => profileCache.current.set(p.id, p));
    }
    const messageIds = msgs.map((m) => m.id);
    const { data: reactions } = await supabase.from("reactions").select("*").in("message_id", messageIds);
    return msgs.map((m) => ({
      ...m,
      profile: profileCache.current.get(m.user_id),
      reactions: reactions?.filter((r) => r.message_id === m.id) || [],
    }));
  }, []);

  useEffect(() => {
    if (!channelId && !dmId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let active = true;

    const fetchInitial = async () => {
      const query = supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(100);
      if (channelId) query.eq("channel_id", channelId);
      if (dmId) query.eq("dm_id", dmId);
      const { data } = await query;
      if (!active || !data) return;
      const enriched = await enrich(data as Message[]);
      if (active) {
        setMessages(enriched);
        setLoading(false);
      }
    };
    fetchInitial();

    const filter = channelId ? `channel_id=eq.${channelId}` : `dm_id=eq.${dmId}`;
    const channel = supabase
      .channel(`messages-${channelId || dmId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter },
        async (payload) => {
          const newMsg = payload.new as Message;
          const enriched = await enrich([newMsg]);
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, ...enriched];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reactions" },
        (payload) => {
          const r = payload.new as any;
          setMessages((prev) =>
            prev.map((m) => (m.id === r.message_id ? { ...m, reactions: [...(m.reactions || []), r] } : m))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "reactions" },
        (payload) => {
          const r = payload.old as any;
          setMessages((prev) =>
            prev.map((m) => (m.id === r.message_id ? { ...m, reactions: (m.reactions || []).filter((x) => x.id !== r.id) } : m))
          );
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [channelId, dmId, enrich]);

  return { messages, loading };
}

export function usePresence() {
  const { user, profile } = useAuth();
  const [online, setOnline] = useState<Record<string, { username: string; avatar_url: string | null }>>({});

  useEffect(() => {
    if (!user || !profile) return;
    const channel = supabase.channel("global-presence", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ username: string; avatar_url: string | null }>();
        const map: Record<string, { username: string; avatar_url: string | null }> = {};
        Object.entries(state).forEach(([key, metas]) => {
          if (metas[0]) map[key] = metas[0] as any;
        });
        setOnline(map);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ username: profile.username, avatar_url: profile.avatar_url });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  return online;
}

export function useTyping(channelId: string | null, dmId: string | null) {
  const { user, profile } = useAuth();
  const [typing, setTyping] = useState<Record<string, string>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastBroadcast = useRef(0);
  const timeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    if (!user || !profile || (!channelId && !dmId)) return;
    const room = channelId ? `typing-channel-${channelId}` : `typing-dm-${dmId}`;
    const channel = supabase.channel(room, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId, username } = payload.payload as { userId: string; username: string };
        if (userId === user.id) return;
        setTyping((p) => ({ ...p, [userId]: username }));
        const existing = timeouts.current.get(userId);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          setTyping((p) => {
            const n = { ...p };
            delete n[userId];
            return n;
          });
          timeouts.current.delete(userId);
        }, 3000);
        timeouts.current.set(userId, t);
      })
      .subscribe();

    return () => {
      timeouts.current.forEach((t) => clearTimeout(t));
      timeouts.current.clear();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelId, dmId, user, profile]);

  const broadcast = useCallback(() => {
    if (!channelRef.current || !user || !profile) return;
    const now = Date.now();
    if (now - lastBroadcast.current < 1500) return;
    lastBroadcast.current = now;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id, username: profile.display_name || profile.username },
    });
  }, [user, profile]);

  return { typing, broadcast };
}
