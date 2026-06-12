// Thin, guarded wrapper over Telegram's HapticFeedback — no-ops outside Telegram.
type Impact = "light" | "medium" | "heavy";

function hf() {
  return typeof window !== "undefined" ? window.Telegram?.WebApp?.HapticFeedback : undefined;
}

export const haptic = {
  impact(style: Impact = "light") {
    hf()?.impactOccurred?.(style);
  },
  success() {
    hf()?.notificationOccurred?.("success");
  },
  error() {
    hf()?.notificationOccurred?.("error");
  },
  selection() {
    hf()?.selectionChanged?.();
  },
};
