import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isYesterday } from "date-fns";
import { supabase, Message } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages, useTyping } from "@/hooks/useChat";
import { UserAvatar } from "./UserAvatar";
import { TypingIndicator } from "./TypingIndicator";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Hash, Send, Image as ImageIcon, Smile, X, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EMOJIS = ["🔥", "💚", "😂", "👀", "🚀", "💀", "✨", "👍"];

interface Props {
  channelId: string | null;
  dmId: string | null;
  title: string;
  subtitle?: string;
  isPrivate?: boolean;
  recipientOnline?: boolean;
}

function formatGroupDate(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

export function ChatView({ channelId, dmId, title, subtitle, isPrivate, recipientOnline }: Props) {
  const { user, profile } = useAuth();
  const { messages, loading } = useMessages(channelId, dmId);
  const { typing, broadcast } = useTyping(channelId, dmId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing]);

  const send = async () => {
    if (!user || (!text.trim() && !pendingImage)) return;
    if (!channelId && !dmId) return;
    setSending(true);
    try {
      let imageUrl: string | null = null;
      if (pendingImage) {
        const ext = pendingImage.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("message-images").upload(path, pendingImage);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("message-images").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }
      const { error } = await supabase.from("messages").insert({
        user_id: user.id,
        channel_id: channelId,
        dm_id: dmId,
        content: text.trim(),
        image_url: imageUrl,
      });
      if (error) throw error;
      setText("");
      setPendingImage(null);
      setPendingPreview(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setPendingImage(f);
    setPendingPreview(URL.createObjectURL(f));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const toggleReaction = async (msg: Message, emoji: string) => {
    if (!user) return;
    const existing = msg.reactions?.find((r) => r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("reactions").insert({ message_id: msg.id, user_id: user.id, emoji });
    }
  };

  const deleteMessage = async (id: string) => {
    await supabase.from("messages").delete().eq("id", id);
  };

  // Group messages
  const grouped: { date: string; messages: Message[] }[] = [];
  messages.forEach((m) => {
    const dateKey = formatGroupDate(new Date(m.created_at));
    const last = grouped[grouped.length - 1];
    if (last?.date === dateKey) last.messages.push(m);
    else grouped.push({ date: dateKey, messages: [m] });
  });

  const typingNames = Object.values(typing);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="h-14 px-5 border-b border-white/5 flex items-center gap-3 bg-surface/50 backdrop-blur-xl shrink-0">
        {channelId ? (
          <Hash className="h-5 w-5 text-muted-foreground" />
        ) : (
          recipientOnline !== undefined && (
            <div className={cn("h-2 w-2 rounded-full", recipientOnline ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]" : "bg-muted-strong")} />
          )
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-semibold truncate">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {isPrivate && <span className="text-[10px] uppercase tracking-wider text-primary/70 font-mono">private</span>}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-2 sm:px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
              <Hash className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold mb-1">It's quiet here</h3>
            <p className="text-sm text-muted-foreground">Be the first to break the silence.</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-4 px-2">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-strong">{group.date}</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
              <AnimatePresence initial={false}>
                {group.messages.map((m, i) => {
                  const prev = group.messages[i - 1];
                  const showHeader = !prev || prev.user_id !== m.user_id || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
                  return (
                    <MessageRow
                      key={m.id}
                      message={m}
                      showHeader={showHeader}
                      isOwn={m.user_id === user?.id}
                      onReact={toggleReaction}
                      onDelete={deleteMessage}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          ))
        )}
        <AnimatePresence>
          {typingNames.length > 0 && <TypingIndicator names={typingNames} />}
        </AnimatePresence>
      </div>

      {/* Composer */}
      <div className="px-3 sm:px-4 pb-4 pt-2 bg-background shrink-0">
        {pendingPreview && (
          <div className="mb-2 inline-block relative">
            <img src={pendingPreview} alt="preview" className="h-24 rounded-lg border border-white/10" />
            <button
              onClick={() => {
                setPendingImage(null);
                setPendingPreview(null);
              }}
              className="absolute -top-2 -right-2 bg-destructive rounded-full p-1 hover:scale-110 transition"
            >
              <X className="h-3 w-3 text-destructive-foreground" />
            </button>
          </div>
        )}
        <div className="glass rounded-2xl flex items-end gap-2 p-2 focus-within:ring-2 focus-within:ring-primary/40 transition">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl h-10 w-10 shrink-0 text-muted-foreground hover:text-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              broadcast();
            }}
            onKeyDown={onKey}
            placeholder={`Message ${channelId ? "#" : ""}${title}`}
            rows={1}
            className="flex-1 resize-none bg-transparent border-0 focus-visible:ring-0 min-h-[40px] max-h-32 py-2.5"
          />
          <Button
            onClick={send}
            disabled={sending || (!text.trim() && !pendingImage)}
            variant="hero"
            size="icon"
            className="rounded-xl h-10 w-10 shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  showHeader,
  isOwn,
  onReact,
  onDelete,
}: {
  message: Message;
  showHeader: boolean;
  isOwn: boolean;
  onReact: (m: Message, emoji: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const reactionGroups: Record<string, string[]> = {};
  message.reactions?.forEach((r) => {
    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = [];
    reactionGroups[r.emoji].push(r.user_id);
  });

  const displayName = message.profile?.display_name || message.profile?.username || "Unknown";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "group relative flex gap-2 px-2 sm:px-3",
        isOwn ? "flex-row-reverse" : "flex-row",
        showHeader ? "mt-3" : "mt-0.5"
      )}
    >
      {/* Avatar (only on header, opposite side stays empty for alignment) */}
      <div className="w-8 shrink-0 flex items-end">
        {showHeader && !isOwn && (
          <UserAvatar username={message.profile?.username} avatarUrl={message.profile?.avatar_url} size="md" />
        )}
      </div>

      <div className={cn("flex flex-col max-w-[75%] sm:max-w-[65%]", isOwn ? "items-end" : "items-start")}>
        {showHeader && !isOwn && (
          <span className="text-xs font-semibold text-primary mb-1 px-2">{displayName}</span>
        )}

        <div
          className={cn(
            "relative px-3.5 py-2 rounded-2xl shadow-sm break-words",
            isOwn
              ? "bg-primary/15 border border-primary/30 text-foreground rounded-br-md"
              : "bg-elevated border border-white/5 text-foreground/90 rounded-bl-md"
          )}
        >
          {message.image_url && (
            <a href={message.image_url} target="_blank" rel="noreferrer" className="block mb-1.5">
              <img
                src={message.image_url}
                alt="attachment"
                className="max-w-full max-h-72 rounded-lg hover:opacity-90 transition"
              />
            </a>
          )}
          {message.content && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
          )}
          <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5">
            <span className="text-[10px] text-muted-strong font-mono">
              {format(new Date(message.created_at), "HH:mm")}
            </span>
          </div>
        </div>

        {Object.keys(reactionGroups).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isOwn ? "justify-end" : "justify-start")}>
            {Object.entries(reactionGroups).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact(message, emoji)}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-elevated border border-white/5 hover:border-primary/40 hover:bg-primary/10 transition"
              >
                <span>{emoji}</span>
                <span className="text-muted-foreground font-mono">{users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions */}
      <div
        className={cn(
          "self-center hidden group-hover:flex items-center gap-1 bg-elevated rounded-lg border border-white/5 shadow-lg px-1 py-0.5",
          isOwn ? "mr-1" : "ml-1"
        )}
      >
        <div className="relative">
          <button
            onClick={() => setShowEmoji((s) => !s)}
            className="p-1.5 hover:text-primary text-muted-foreground rounded transition"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
          {showEmoji && (
            <div
              className={cn(
                "absolute bottom-full mb-1 bg-elevated rounded-xl border border-white/5 shadow-xl p-1.5 flex gap-1 z-10",
                isOwn ? "right-0" : "left-0"
              )}
            >
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    onReact(message, e);
                    setShowEmoji(false);
                  }}
                  className="text-base hover:scale-125 transition p-1 rounded hover:bg-primary/10"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        {isOwn && (
          <button
            onClick={() => onDelete(message.id)}
            className="p-1.5 hover:text-destructive text-muted-foreground rounded transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
