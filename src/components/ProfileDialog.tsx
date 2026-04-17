import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { UserAvatar } from "./UserAvatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null, bio: bio.trim() || null })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    await refreshProfile();
    onOpenChange(false);
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Avatar must be under 3MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}?t=${Date.now()}`;
      const cleanPath = path.split("?")[0];
      await supabase.storage.from("avatars").remove([cleanPath]);
      const { error: upErr } = await supabase.storage.from("avatars").upload(cleanPath, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(cleanPath);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (updErr) throw updErr;
      await refreshProfile();
      toast.success("Avatar updated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-white/5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Your profile</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center pb-2">
          <div className="relative group">
            <UserAvatar username={profile?.username} avatarUrl={profile?.avatar_url} size="xl" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
            >
              {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Camera className="h-6 w-6 text-primary" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground font-mono">@{profile?.username}</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you appear"
              className="bg-elevated border-white/5"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about you..."
              rows={3}
              className="bg-elevated border-white/5 resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="hero" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
