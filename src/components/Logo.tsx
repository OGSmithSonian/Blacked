import { motion } from "framer-motion";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <motion.div
        initial={{ rotate: -8, scale: 0.9 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="relative"
        style={{ width: size, height: size }}
      >
        <div
          className="absolute inset-0 rounded-lg bg-primary/30 blur-md animate-pulse-glow"
        />
        <div
          className="relative w-full h-full rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-3/5 h-3/5 text-background">
            <path
              d="M4 6c0-1.1.9-2 2-2h12a2 2 0 012 2v9a2 2 0 01-2 2h-7l-4 3v-3H6a2 2 0 01-2-2V6z"
              fill="currentColor"
            />
          </svg>
        </div>
      </motion.div>
      <span className="font-display text-lg font-bold tracking-tight">
        Blacked<span className="text-primary">.</span>
      </span>
    </div>
  );
}
