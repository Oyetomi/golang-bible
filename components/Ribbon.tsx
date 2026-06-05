"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { chapterByHref } from "@/lib/manifest";
import {
  getRibbon,
  setRibbon,
  armScrollRestore,
  consumeScrollRestore,
  type RibbonMark,
} from "@/lib/reading";

/** The silk ribbon bookmark. Hangs from the top edge of the page. Drop it where
 *  you stopped reading; come back later and it returns you to the exact spot. */
export function Ribbon() {
  const pathname = usePathname();
  const router = useRouter();
  const [ribbon, setRibbonState] = useState<RibbonMark | null>(null);
  const [flash, setFlash] = useState<"" | "placed" | "lifted">("");

  const chapter = chapterByHref(pathname);
  const onChapter = !!chapter;

  // Load + stay in sync with other tabs / the landing card.
  useEffect(() => {
    setRibbonState(getRibbon());
    const sync = () => setRibbonState(getRibbon());
    window.addEventListener("gb:ribbon", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gb:ribbon", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // On arriving at the ribbon's chapter (via "return"), restore the scroll spot.
  useEffect(() => {
    if (!onChapter) return;
    const r = consumeScrollRestore(pathname);
    if (!r) return;
    let tries = 0;
    const settle = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const target = r.y <= max ? r.y : Math.round(r.pct * max);
      window.scrollTo({ top: target, behavior: "auto" });
      // content (timelines, images) can shift layout as it settles — re-aim a few times
      if (tries++ < 6) setTimeout(settle, 120);
    };
    const t = setTimeout(settle, 60);
    return () => clearTimeout(t);
  }, [pathname, onChapter]);

  const plant = useCallback(() => {
    if (!chapter) return;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const y = window.scrollY;
    setRibbon({
      href: pathname,
      title: chapter.title,
      part: String(chapter.part),
      scrollY: y,
      pct: y / max,
      ts: Date.now(),
    });
    setFlash("placed");
    setTimeout(() => setFlash(""), 1500);
  }, [chapter, pathname]);

  const goToRibbon = useCallback(() => {
    if (!ribbon) return;
    if (ribbon.href === pathname) {
      window.scrollTo({ top: ribbon.scrollY, behavior: "smooth" });
    } else {
      armScrollRestore(ribbon.href, ribbon.scrollY, ribbon.pct);
      router.push(ribbon.href);
    }
  }, [ribbon, pathname, router]);

  const lift = useCallback(() => {
    setRibbon(null);
    setFlash("lifted");
    setTimeout(() => setFlash(""), 1500);
  }, []);

  if (!onChapter) return null;

  const here = ribbon?.href === pathname;
  const state = !ribbon ? "empty" : here ? "here" : "away";

  // Clicking the strip is context-aware: place when empty, scroll-to-spot when
  // here, jump-to-chapter when the ribbon rests elsewhere.
  const onStrip = state === "empty" ? plant : goToRibbon;
  const hint =
    state === "empty"
      ? "Place your ribbon here"
      : here
      ? "Your ribbon rests on this page — click to return to the spot"
      : `Your ribbon rests in “${ribbon!.title}” — click to return`;

  return (
    <div className={`ribbon ribbon-${state} ${flash ? "ribbon-flash" : ""}`}>
      <button
        className="ribbon-strip"
        onClick={onStrip}
        aria-label={hint}
        title={hint}
      />
      <div className="ribbon-tools">
        <button className="ribbon-tool" onClick={plant} title={here ? "Move ribbon to this spot" : "Place your ribbon here"}>
          🔖
        </button>
        {ribbon && (
          <button className="ribbon-tool" onClick={lift} title="Remove your ribbon">
            ✕
          </button>
        )}
      </div>
      {flash && (
        <div className="ribbon-toast">
          {flash === "placed" ? "🔖 Ribbon placed" : "Ribbon removed"}
        </div>
      )}
    </div>
  );
}
