import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const colors = ["bg-primary/20 text-primary", "bg-accent/20 text-accent", "bg-warning/20 text-warning", "bg-destructive/20 text-destructive"];

export function UserAvatar({
  username,
  avatarUrl,
  size = "md",
  online,
}: {
  username?: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
}) {
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-11 w-11 text-sm",
    xl: "h-20 w-20 text-2xl",
  };
  const dotSize = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
    xl: "h-4 w-4 ring-4",
  };
  const initial = (username || "?").charAt(0).toUpperCase();
  const colorIdx = (username?.charCodeAt(0) || 0) % colors.length;

  return (
    <div className="relative inline-block">
      <Avatar className={cn(sizes[size], "ring-2 ring-elevated")}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={username || ""} />}
        <AvatarFallback className={cn("font-semibold", colors[colorIdx])}>{initial}</AvatarFallback>
      </Avatar>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2 ring-surface",
            dotSize[size],
            online ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]" : "bg-muted-strong"
          )}
        />
      )}
    </div>
  );
}
