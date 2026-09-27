"use client";

import { useEffect, useState } from "react";
import type { BadgeDefinition } from "@/lib/gamification";
import { RARITY, STICKERS } from "@/lib/stickers";
import { playSuccess } from "@/lib/sound";
import { StickerArt } from "./StickerArt";

interface Toast {
  key: number;
  badge: BadgeDefinition;
}

/* When a badge unlocks, its sticker is slapped onto the corner of the page.
   Confetti already fires from lib/gamification (gb:confetti); this adds the
   picture and the sound. Up to three stack; each leaves after 5.5 s. */
export function StickerToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onUnlock = (e: CustomEvent<BadgeDefinition>) => {
      const badge = e.detail;
      if (!badge || !STICKERS[badge.id]) return;
      const key = Date.now() + Math.random();
      playSuccess();
      setToasts((t) => [...t.slice(-2), { key, badge }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), 5500);
    };
    window.addEventListener("gb:badge-unlock", onUnlock as EventListener);
    return () => window.removeEventListener("gb:badge-unlock", onUnlock as EventListener);
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div className="stk-toasts" aria-live="polite">
      {toasts.map(({ key, badge }) => {
        const s = STICKERS[badge.id];
        return (
          <div key={key} className="stk-toast">
            <StickerArt sticker={s} size={64} className="sticker-enter" title={badge.title} />
            <div className="stk-text">
              <span className="stk-kicker">New sticker · {RARITY[s.rarity].label}</span>
              <strong className="stk-name">{badge.title}</strong>
              <span className="stk-lore">{s.lore}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
