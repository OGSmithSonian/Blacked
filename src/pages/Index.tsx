import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, Channel, Profile, DirectMessage } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { ProfileDialog } from "@/components/ProfileDialog";
import Auth from "./Auth";
import { Loader2, Menu, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePresence } from "@/hooks/useChat";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

type Selection = { type: "channel"; id: string } | { type: "dm"; id: string; otherId: string } | null;
type DmWithProfile = DirectMessage & { other: Profile };

const Index = () => {
  const { user, profile, loading } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDms] = useState<DmWithProfile[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const onlineUsers = usePresence();

  const loadChannels = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("channels")
      .select("*")
      .order("created_at", { ascending: true });
    setChannels((data as Channel[]) || []);
    return data as Channel[] | null;
  }, [user]);

  const loadDms = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    if (!data) return;
    const otherIds = data.map((d: any) => (d.user1_id === user.id ? d.user2_id : d.user1_id));
    if (otherIds.length === 0) {
      setDms([]);
      return;
    }
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", otherIds);
    const map = new Map((profiles || []).map((p: Profile) => [p.id, p]));
    setDms(
      (data as DirectMessage[]).map((d) => {
        const otherId = d.user1_id === user.id ? d.user2_id : d.user1_id;
        return { ...d, other: map.get(otherId) as Profile };
      }).filter((d) => d.other)
    );
  }, [user]);

  // Bootstrap: ensure profile exists, then load
  useEffect(() => {
    if (!user || loading) return;
    let active = true;
    (async () => {
      // Ensure profile exists
      const { data: existing } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!existing) {
        const username = (user.user_metadata?.username || user.email?.split("@")[0] || `user${Math.floor(Math.random() * 9999)}`).toLowerCase();
        await supabase.from("profiles").insert({ id: user.id, username });
      }
      await loadChannels();
      await loadDms();
      if (active) setBootstrapping(false);
    })();
    return () => {
      active = false;
    };
  }, [user, loading, loadChannels, loadDms]);

  // Auto-select first channel
  useEffect(() => {
    if (!selection && channels.length > 0) {
      setSelection({ type: "channel", id: channels[0].id });
    }
  }, [channels, selection]);

  // Realtime: notifications for new messages in other channels/dms
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new as any;
          if (m.user_id === user.id) return;
          const isCurrent =
            (selection?.type === "channel" && selection.id === m.channel_id) ||
            (selection?.type === "dm" && selection.id === m.dm_id);
          if (isCurrent) return;
          // Only notify for DMs to me, or channels I belong to
          if (m.dm_id) {
            const isMine = dms.find((d) => d.id === m.dm_id);
            if (isMine) {
              const { data: p } = await supabase.from("profiles").select("username, display_name").eq("id", m.user_id).maybeSingle();
              toast(`💬 ${p?.display_name || p?.username || "Someone"}`, {
                description: m.content?.slice(0, 80) || "Sent an image",
              });
            }
          } else if (m.channel_id) {
            const inCh = channels.find((c) => c.id === m.channel_id);
            if (inCh) {
              const { data: p } = await supabase.from("profiles").select("username, display_name").eq("id", m.user_id).maybeSingle();
              toast(`#${inCh.name}`, {
                description: `${p?.display_name || p?.username}: ${m.content?.slice(0, 60) || "Sent an image"}`,
              });
            }
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selection, dms, channels]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Auth />;

  if (bootstrapping || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Logo size={40} />
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-mono">connecting...</p>
      </div>
    );
  }

  // Selected metadata
  let title = "Blacked";
  let subtitle: string | undefined;
  let isPrivate = false;
  let recipientOnline: boolean | undefined;
  let channelId: string | null = null;
  let dmId: string | null = null;

  if (selection?.type === "channel") {
    const c = channels.find((x) => x.id === selection.id);
    if (c) {
      title = c.name;
      subtitle = c.description || undefined;
      isPrivate = c.is_private;
      channelId = c.id;
    }
  } else if (selection?.type === "dm") {
    const d = dms.find((x) => x.id === selection.id);
    if (d) {
      title = d.other.display_name || d.other.username;
      subtitle = `@${d.other.username}`;
      dmId = d.id;
      recipientOnline = !!onlineUsers[d.other.id];
    }
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar
        channels={channels}
        dms={dms}
        selection={selection}
        onSelect={setSelection}
        onlineUsers={onlineUsers}
        onOpenProfile={() => setProfileOpen(true)}
        onChannelsChange={loadChannels}
        onDmsChange={loadDms}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile top bar */}
        <div className="md:hidden h-12 px-3 flex items-center gap-2 border-b border-white/5 bg-surface/80 backdrop-blur-xl shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setMobileSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Logo size={24} />
        </div>

        {selection ? (
          <ChatView
            channelId={channelId}
            dmId={dmId}
            title={title}
            subtitle={subtitle}
            isPrivate={isPrivate}
            recipientOnline={recipientOnline}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-5 animate-pulse-glow">
              <MessageSquare className="h-10 w-10 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">Welcome to Blacked</h2>
            <p className="text-muted-foreground max-w-sm">
              Pick a channel or start a direct message to dive in.
            </p>
          </div>
        )}
      </main>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
};

export default Index;
