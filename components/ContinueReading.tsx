"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRibbon, armScrollRestore, type RibbonMark } from "@/lib/reading";

/** Landing-page affordance: if a ribbon is placed, offer to return straight to
 *  it (chapter + scroll spot). Mirrors reaching for the ribbon in a real book. */
export function ContinueReading() {
  const router = useRouter();
  const [ribbon, setRibbon] = useState<RibbonMark | null>(null);

  useEffect(() => {
    setRibbon(getRibbon());
    const sync = () => setRibbon(getRibbon());
    window.addEventListener("gb:ribbon", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gb:ribbon", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!ribbon) return null;

  const go = () => {
    armScrollRestore(ribbon.href, ribbon.scrollY, ribbon.pct);
    router.push(ribbon.href);
  };

  const pct = Math.round((ribbon.pct || 0) * 100);

  return (
    <button className="continue" onClick={go}>
      <span className="continue-ribbon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--gold)" stroke="none">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </span>
      <span className="continue-body">
        <span className="continue-label">Resume from bookmark</span>
        <span className="continue-title">{ribbon.title}</span>
      </span>
      <span className="continue-meta">
        {pct > 0 ? `${pct}% read` : "start"} <span className="continue-arrow">→</span>
      </span>
    </button>
  );
}
