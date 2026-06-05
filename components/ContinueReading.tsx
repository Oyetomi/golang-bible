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
      <span className="continue-ribbon" aria-hidden />
      <span className="continue-body">
        <span className="continue-label">Your ribbon rests in</span>
        <span className="continue-title">{ribbon.title}</span>
      </span>
      <span className="continue-meta">
        {pct > 0 ? `${pct}% in` : "start"} <span className="continue-arrow">→</span>
      </span>
    </button>
  );
}
