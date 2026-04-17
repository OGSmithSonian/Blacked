import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, Channel, Profile, DirectMessage } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "./Logo";
import { UserAvatar } from "./UserAvatar";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Hash, Lock, Plus, Settings, LogOut, MessageSquarePlus, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Selection = { type: "channel"; id: string } | { type: "dm"; id: string; otherId: string } | null;

interface Props {
  channels: Channel[];
  dms: (DirectMessage & { other: Profile })[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  onlineUsers: Record<string, any>;
  onOpenProfile: () => void;
  onChannelsChange: () => void;
  onDmsChange: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  channels,
  dms,
  selection,
  onSelect,
  onlineUsers,
  onOpenProfile,
  onChannelsChange,
  onDmsChange,
  mobileOpen,
  onCloseMobile,
}: Props) {
  const { user, profile, signOut } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const onlineCount = Object.keys(onlineUsers).length;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30" onClick={onCloseMobile} />
      )}

      <aside
        className={cn(
          "fixed md:relative inset-y-0 left-0 z-40 w-72 bg-surface/80 backdrop-blur-xl border-r border-white/5 flex flex-col transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/5 shrink-0">
          <Logo />
          <button onClick={onCloseMobile} className="md:hidden text-muted-foreground p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="font-mono text-muted-foreground">
              <span className="text-primary font-semibold">{onlineCount}</span> online now
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
          {/* Channels */}
          <div className="mb-5">
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-strong">Channels</h3>
              <button
                onClick={() => setCreateOpen(true)}
                className="text-muted-foreground hover:text-primary transition p-1 rounded hover:bg-elevated"
                title="New channel"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {channels.map((c) => {
                const active = selection?.type === "channel" && selection.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelect({ type: "channel", id: c.id });
                      onCloseMobile();
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all",
                      active
                        ? "bg-primary/15 text-primary font-semibold border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-elevated"
                    )}
                  >
                    {c.is_private ? <Lock className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />}
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
              {channels.length === 0 && (
                <p className="text-xs text-muted-strong px-3 py-2">No channels yet.</p>
              )}
            </div>
          </div>

          {/* DMs */}
          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-strong">Direct Messages</h3>
              <button
                onClick={() => setDmOpen(true)}
                className="text-muted-foreground hover:text-primary transition p-1 rounded hover:bg-elevated"
                title="New DM"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {dms.map((d) => {
                const active = selection?.type === "dm" && selection.id === d.id;
                const online = !!onlineUsers[d.other.id];
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      onSelect({ type: "dm", id: d.id, otherId: d.other.id });
                      onCloseMobile();
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all",
                      active
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-elevated"
                    )}
                  >
                    <UserAvatar username={d.other.username} avatarUrl={d.other.avatar_url} size="sm" online={online} />
                    <span className="truncate">{d.other.display_name || d.other.username}</span>
                  </button>
                );
              })}
              {dms.length === 0 && (
                <p className="text-xs text-muted-strong px-3 py-2">Start a conversation.</p>
              )}
            </div>
          </div>
        </div>

        {/* User strip */}
        <div className="border-t border-white/5 p-3 flex items-center gap-2 shrink-0 bg-surface">
          <button onClick={onOpenProfile} className="flex items-center gap-2 flex-1 min-w-0 hover:bg-elevated rounded-lg p-1.5 transition">
            <UserAvatar username={profile?.username} avatarUrl={profile?.avatar_url} size="md" online />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold truncate">{profile?.display_name || profile?.username}</p>
              <p className="text-xs text-primary font-mono">online</p>
            </div>
          </button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={onOpenProfile} className="rounded-full h-9 w-9">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} className="rounded-full h-9 w-9 hover:text-destructive">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onChannelsChange} />
      <NewDmDialog open={dmOpen} onOpenChange={setDmOpen} onCreated={onDmsChange} onSelect={onSelect} />
    </>
  );
}

function CreateChannelDialog({ open, onOpenChange, onCreated }: any) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [priv, setPriv] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);
    try {
      const cleanName = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const { data, error } = await supabase
        .from("channels")
        .insert({ name: cleanName, description: desc.trim() || null, is_private: priv, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("channel_members").insert({ channel_id: data.id, user_id: user.id });
      toast.success(`#${cleanName} created`);
      setName("");
      setDesc("");
      setPriv(false);
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-white/5">
        <DialogHeader>
          <DialogTitle className="font-display">Create channel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="general" className="bg-elevated border-white/5" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="what's this about?" className="bg-elevated border-white/5" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-elevated">
            <div>
              <Label className="cursor-pointer">Private channel</Label>
              <p className="text-xs text-muted-foreground">Only invited members</p>
            </div>
            <Switch checked={priv} onCheckedChange={setPriv} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="hero" onClick={submit} disabled={busy || !name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewDmDialog({ open, onOpenChange, onCreated, onSelect }: any) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    const t = setTimeout(async () => {
      const q = supabase.from("profiles").select("*").neq("id", user.id).limit(20);
      if (search.trim()) q.ilike("username", `%${search.trim().toLowerCase()}%`);
      const { data } = await q;
      if (active) setResults(data || []);
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [search, open, user]);

  const start = async (other: Profile) => {
    if (!user) return;
    const [u1, u2] = [user.id, other.id].sort();
    let { data: existing } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("user1_id", u1)
      .eq("user2_id", u2)
      .maybeSingle();
    if (!existing) {
      const { data, error } = await supabase
        .from("direct_messages")
        .insert({ user1_id: u1, user2_id: u2 })
        .select()
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      existing = data;
    }
    onCreated();
    onSelect({ type: "dm", id: existing.id, otherId: other.id });
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-white/5">
        <DialogHeader>
          <DialogTitle className="font-display">Start a conversation</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-elevated border-white/5"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-1">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => start(p)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-elevated transition text-left"
            >
              <UserAvatar username={p.username} avatarUrl={p.avatar_url} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.display_name || p.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
              </div>
            </button>
          ))}
          {results.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No users found</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
