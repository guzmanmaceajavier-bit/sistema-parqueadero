import { useEffect } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  handler: () => void;
  enabled?: boolean;
}

export function useKeyboard(shortcuts: Shortcut[]) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        if (s.enabled === false) continue;
        const matchCtrl = s.ctrl ? e.ctrlKey || e.metaKey : true;
        const matchAlt = s.alt ? e.altKey : true;
        const matchShift = s.shift ? e.shiftKey : true;
        const matchKey = e.key.toLowerCase() === s.key.toLowerCase();
        if (matchCtrl && matchAlt && matchShift && matchKey) {
          e.preventDefault();
          s.handler();
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);
}
