"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeProgress,
  calculateLevelInfo,
  getAllBadgesWithProgress,
  PlayerProfile,
} from "@/lib/gamification";
import { GO_ERAS, RARITY, STICKERS, eraForLevel } from "@/lib/stickers";
import { triggerConfetti } from "@/lib/confetti";
import { playClick, playSuccess } from "@/lib/sound";
import { StickerArt } from "./StickerArt";

interface BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PlayerProfile;
}

type FilterTab = "all" | "unlocked" | "locked";

const FILTERS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unlocked", label: "Collected" },
  { id: "locked", label: "Still to earn" },
];

/* The sticker book. Achievements are die-cut stickers (StickerArt), collected
   ones sorted first and rarest first; a locked slot shows the sticker's
   outline and how to earn it. Above the grid, the reader's level sits on a
   timeline of Go releases, because that is what the levels are named after. */
export function BadgesModal({ isOpen, onClose, profile }: BadgesModalProps) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [focus, setFocus] = useState<BadgeProgress | null>(null);

  const all = useMemo(() => getAllBadgesWithProgress(profile), [profile]);
  const level = calculateLevelInfo(profile.xp).level;
  const era = eraForLevel(level);
  const count = all.filter((b) => b.unlocked).length;

  const list = useMemo(() => {
    const sorted = [...all].sort(
      (a, b) =>
        Number(b.unlocked) - Number(a.unlocked) ||
        RARITY[STICKERS[a.id].rarity].order - RARITY[STICKERS[b.id].rarity].order,
    );
    if (filter === "unlocked") return sorted.filter((b) => b.unlocked);
    if (filter === "locked") return sorted.filter((b) => !b.unlocked);
    return sorted;
  }, [all, filter]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (focus) setFocus(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = orig;
    };
  }, [isOpen, focus, onClose]);

  if (!isOpen) return null;

  const close = () => {
    playClick();
    setFocus(null);
    onClose();
  };

  // Eras are stored newest first; the timeline reads left to right.
  const timeline = [...GO_ERAS].reverse();

  return (
    <div className="sb-scrim" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sb-sheet" role="dialog" aria-modal="true" aria-labelledby="sb-title">
        <div className="sb-head">
          <div>
            <p className="sb-kicker">Your sticker book</p>
            <h2 id="sb-title" className="sb-title">
              {count} of {all.length} collected
            </h2>
          </div>
          <button className="sb-close" onClick={close} aria-label="Close sticker book" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="sb-body">
          <section className="sb-eras" aria-label="Go release eras">
            <div className="sb-eras-head">
              <span className="sb-eras-now">
                Level {level} · <strong>{era.name}</strong>
              </span>
              <span className="sb-eras-note">
                {era.release} ({era.year}): {era.note}
              </span>
            </div>
            <ol className="sb-rail">
              {timeline.map((e) => {
                const state = e === era ? "now" : level >= e.minLevel ? "past" : "ahead";
                return (
                  <li key={e.release} className={`sb-stop is-${state}`} title={`${e.release}: ${e.note}`}>
                    <span className="sb-dot" />
                    <span className="sb-rel">{e.release.replace("Go ", "")}</span>
                    <span className="sb-lv">Lv {e.minLevel}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="sb-meter" aria-hidden="true">
            <span style={{ width: `${(count / all.length) * 100}%` }} />
          </div>

          <div className="sb-filters" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className="sb-chip"
                onClick={() => {
                  playClick();
                  setFilter(f.id);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {list.length === 0 ? (
            <p className="sb-empty">
              {filter === "unlocked"
                ? "Your first sticker is one snippet away: run any playground."
                : "Every sticker collected. Iconic."}
            </p>
          ) : (
            <div className="sb-grid">
              {list.map((b) => {
                const s = STICKERS[b.id];
                return (
                  <button key={b.id} type="button" className="sb-slot" onClick={() => setFocus(b)}>
                    <StickerArt sticker={s} locked={!b.unlocked} title={`${b.title}${b.unlocked ? "" : " (locked)"}`} />
                    <span className="sb-name">{b.title}</span>
                    <span className="sb-meta">
                      {b.unlocked ? RARITY[s.rarity].label : s.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {focus && <StickerDetail badge={focus} onClose={() => setFocus(null)} />}
    </div>
  );
}

function StickerDetail({ badge, onClose }: { badge: BadgeProgress; onClose: () => void }) {
  const s = STICKERS[badge.id];
  const got = badge.unlocked;
  const pct = Math.round(Math.min(1, badge.currentProgress / badge.maxProgress) * 100);

  const celebrate = (e: React.MouseEvent) => {
    if (!got) return;
    playSuccess();
    const r = e.currentTarget.getBoundingClientRect();
    triggerConfetti(r.left + r.width / 2, r.top + r.height / 2, 60);
  };

  return (
    <div className="sb-scrim sb-scrim-top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sb-sheet sb-detail" role="dialog" aria-modal="true" aria-label={badge.title}>
        <button type="button" className="sb-detail-art" onClick={celebrate} aria-label={got ? "Celebrate" : badge.title}>
          <StickerArt sticker={s} locked={!got} size={176} className={got ? "sticker-enter" : ""} />
        </button>
        <p className="sb-kicker">
          {RARITY[s.rarity].label} · {badge.category}
        </p>
        <h3 className="sb-detail-title">{badge.title}</h3>
        <p className="sb-detail-desc">{badge.description}.</p>

        {got ? (
          <>
            <p className="sb-lore">{s.lore}</p>
            {badge.unlockedAt && (
              <p className="sb-when">
                Collected{" "}
                {new Date(badge.unlockedAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </>
        ) : (
          <div className="sb-progress">
            <div className="sb-progress-row">
              <span>To earn it: {s.hint.toLowerCase()}</span>
              <span className="sb-progress-num">
                {badge.currentProgress}/{badge.maxProgress}
              </span>
            </div>
            <div className="sb-meter">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <button type="button" className="sb-back" onClick={onClose}>
          Back to the book
        </button>
      </div>
    </div>
  );
}
