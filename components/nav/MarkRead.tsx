"use client";

import { useEffect, useState } from "react";
import { getProfile, recordChapter, unrecordChapter } from "@/lib/gamification";

/* The button at the end of a chapter that marks it read (the sidebar tick
   and the home page's counts). Clicking again un-marks it. */
export function MarkRead({ slug }: { slug: string }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sync = () => setDone(getProfile().completedChapters.includes(slug));
    sync();
    window.addEventListener("gb:gamification", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gb:gamification", sync);
      window.removeEventListener("storage", sync);
    };
  }, [slug]);

  return (
    <div className="markread">
      <button
        type="button"
        className={`markread-btn ${done ? "markread-done" : ""}`}
        aria-pressed={done}
        onClick={() => (done ? unrecordChapter(slug) : recordChapter(slug))}
      >
        {done ? "✓ Read" : "Mark as read"}
      </button>
      {done && <span className="markread-hint">Click again to un-mark</span>}
    </div>
  );
}
