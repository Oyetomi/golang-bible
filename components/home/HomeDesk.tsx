"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  calculateLevelInfo,
  getAllBadgesWithProgress,
  getDefaultProfile,
  getProfile,
  type PlayerProfile,
} from "@/lib/gamification";
import { eraForLevel, nextEra, RARITY, STICKERS } from "@/lib/stickers";
import { armScrollRestore, getRibbon, type RibbonMark } from "@/lib/reading";
import { StickerArt } from "@/components/gamification/StickerArt";

type Lite = { slug: string; title: string; href: string; part: string; order: number };

function greeting(h: number) {
  if (h < 5) return "Still up.";
  if (h < 12) return "Good morning.";
  if (h < 18) return "Good afternoon.";
  return "Good evening.";
}

/* The top of the home page: a greeting, then three cards on a desk. Where you
   left off (or where to begin), which Go era your level has reached, and the
   sticker book. Everything here reads localStorage, so it renders after mount;
   before that the server markup shows the "start" state. */
export function HomeDesk({ start, total }: { start: Lite; total: number }) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [profile, setProfile] = useState<PlayerProfile>(getDefaultProfile());
  const [ribbon, setRibbon] = useState<RibbonMark | null>(null);

  useEffect(() => {
    setNow(new Date());
    setProfile(getProfile());
    setRibbon(getRibbon());
    const sync = () => {
      setProfile(getProfile());
      setRibbon(getRibbon());
    };
    window.addEventListener("gb:gamification", sync);
    window.addEventListener("gb:ribbon", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gb:gamification", sync);
      window.removeEventListener("gb:ribbon", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const info = calculateLevelInfo(profile.xp);
  const era = eraForLevel(info.level);
  const upcoming = nextEra(info.level);
  const read = profile.completedChapters?.length ?? 0;
  const badges = getAllBadgesWithProgress(profile);
  const got = badges
    .filter((b) => b.unlocked)
    .sort((a, b) => RARITY[STICKERS[a.id].rarity].order - RARITY[STICKERS[b.id].rarity].order);
  const shown = got.slice(0, 4);
  // A locked sticker to aim for: the nearest one by progress.
  const aim = badges
    .filter((b) => !b.unlocked)
    .sort((a, b) => b.currentProgress / b.maxProgress - a.currentProgress / a.maxProgress)[0];

  const resume = () => {
    if (!ribbon) return;
    armScrollRestore(ribbon.href, ribbon.scrollY, ribbon.pct);
    router.push(ribbon.href);
  };

  const pct = ribbon ? Math.round((ribbon.pct || 0) * 100) : 0;

  return (
    <section className="hd">
      <p className="hd-date">
        {now
          ? now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
          : "The Go Bible"}
      </p>
      <h1 className="hd-hello">{now ? greeting(now.getHours()) : "Welcome."}</h1>
      <p className="hd-lede">
        You want to be great at Go. You came to the right place: {total} chapters that show you the
        machine before the code, and real programs you can watch run.
      </p>

      <div className="hd-desk">
        {ribbon ? (
          <button type="button" className="hd-card hd-continue" onClick={resume}>
            <span className="hd-kicker">Continue reading</span>
            <span className="hd-card-title">{ribbon.title}</span>
            <span className="hd-bar" aria-hidden="true">
              <span style={{ width: `${Math.max(pct, 2)}%` }} />
            </span>
            <span className="hd-card-meta">
              {pct > 0 ? `${pct}% read` : "Bookmarked"} <span className="hd-arrow">→</span>
            </span>
          </button>
        ) : (
          <Link href={start.href} className="hd-card hd-continue">
            <span className="hd-kicker">Start here</span>
            <span className="hd-card-title">{start.title}</span>
            <span className="hd-card-meta">
              {start.part} · Chapter {start.order} <span className="hd-arrow">→</span>
            </span>
          </Link>
        )}

        <div className="hd-card hd-era" title={era.note}>
          <span className="hd-kicker">Your era</span>
          <span className="hd-era-row">
            <span className="hd-era-badge">{info.level}</span>
            <span>
              <span className="hd-card-title hd-era-name">{era.name}</span>
              <span className="hd-era-rel">
                {era.release} · {era.year}
              </span>
            </span>
          </span>
          <span className="hd-era-note">{era.note}</span>
          <span className="hd-bar" aria-hidden="true">
            <span style={{ width: `${info.progressPct}%` }} />
          </span>
          <span className="hd-card-meta">
            {upcoming ? `${upcoming.name} at level ${upcoming.minLevel}` : "Top of the timeline"}
            {" · "}
            {read} of {total} read
          </span>
        </div>

        <button
          type="button"
          className="hd-card hd-stickers"
          onClick={() => window.dispatchEvent(new CustomEvent("gb:open-stickers"))}
        >
          <span className="hd-kicker">Sticker book</span>
          <span className="hd-card-title">
            {got.length} of {badges.length} collected
          </span>
          <span className="hd-sticker-row" aria-hidden="true">
            {shown.map((b, i) => (
              <StickerArt key={b.id} sticker={STICKERS[b.id]} size={54} className={`hd-stk hd-stk-${i}`} />
            ))}
            {aim && shown.length < 4 && (
              <StickerArt sticker={STICKERS[aim.id]} locked size={54} className="hd-stk hd-stk-locked" />
            )}
          </span>
          <span className="hd-card-meta">
            {aim ? `Next: ${aim.title} — ${STICKERS[aim.id].hint.toLowerCase()}` : "Every sticker collected"}
          </span>
        </button>
      </div>
    </section>
  );
}

/* Per-part progress: how many of the part's chapters you've finished. */
export function PartProgress({ slugs }: { slugs: string[] }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    const sync = () => setDone(new Set(getProfile().completedChapters || []));
    sync();
    window.addEventListener("gb:gamification", sync);
    return () => window.removeEventListener("gb:gamification", sync);
  }, []);
  const n = slugs.filter((s) => done.has(s)).length;
  return (
    <span className="hp-progress">
      <span className="hp-progress-bar" aria-hidden="true">
        <span style={{ width: `${(n / slugs.length) * 100}%` }} />
      </span>
      <span className="hp-progress-num">
        {n}/{slugs.length}
      </span>
    </span>
  );
}

/* A chapter card that shows a check once the chapter is finished. */
export function DoneMark({ slug }: { slug: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const sync = () => setDone((getProfile().completedChapters || []).includes(slug));
    sync();
    window.addEventListener("gb:gamification", sync);
    return () => window.removeEventListener("gb:gamification", sync);
  }, [slug]);
  return done ? (
    <span className="hp-done" aria-label="Finished">
      ✓
    </span>
  ) : null;
}
