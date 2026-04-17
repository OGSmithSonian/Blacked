import { motion } from "framer-motion";

export function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const text =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground"
    >
      <span className="flex gap-1 items-end h-3">
        <span className="pulse-dot inline-block w-1 h-1 rounded-full bg-primary" />
        <span className="pulse-dot inline-block w-1 h-1 rounded-full bg-primary" />
        <span className="pulse-dot inline-block w-1 h-1 rounded-full bg-primary" />
      </span>
      <span className="italic">
        <span className="text-foreground/80 font-medium">{text}</span>
        <span className="opacity-60">...</span>
      </span>
    </motion.div>
  );
}
