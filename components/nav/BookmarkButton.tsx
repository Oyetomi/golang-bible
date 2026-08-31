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
import { playClick, playSuccess } from "@/lib/sound";

export function BookmarkButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [bookmark, setBookmark] = useState<RibbonMark | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const chapter = chapterByHref(pathname);
  const onChapter = !!chapter;

  // Sync state
  useEffect(() => {
    setBookmark(getRibbon());
    const sync = () => setBookmark(getRibbon());
    window.addEventListener("gb:ribbon", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("gb:ribbon", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Restore scroll on arrival
  useEffect(() => {
    if (!onChapter) return;
    const r = consumeScrollRestore(pathname);
    if (!r) return;
    let tries = 0;
    const settle = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const target = r.y <= max ? r.y : Math.round(r.pct * max);
      window.scrollTo({ top: target, behavior: "auto" });
      if (tries++ < 6) setTimeout(settle, 120);
    };
    const t = setTimeout(settle, 60);
    return () => clearTimeout(t);
  }, [pathname, onChapter]);

  const handleBookmark = useCallback(() => {
    if (!chapter) return;
    playSuccess();
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
    setToast(`Saved bookmark at ${Math.round((y / max) * 100)}%`);
    setTimeout(() => setToast(null), 2400);
  }, [chapter, pathname]);

  const handleJumpToBookmark = useCallback(() => {
    if (!bookmark) return;
    playClick();
    if (bookmark.href === pathname) {
      window.scrollTo({ top: bookmark.scrollY, behavior: "smooth" });
      setToast("Scrolled to saved position");
      setTimeout(() => setToast(null), 2000);
    } else {
      armScrollRestore(bookmark.href, bookmark.scrollY, bookmark.pct);
      router.push(bookmark.href);
    }
  }, [bookmark, pathname, router]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    playClick();
    setRibbon(null);
    setToast("Bookmark removed");
    setTimeout(() => setToast(null), 2000);
  }, []);

  if (!onChapter) return null;

  const isHere = bookmark?.href === pathname;

  return (
    <div className="gb-bookmark-wrap">
      {isHere ? (
        <div className="gb-bookmark-group">
          <button
            className="gb-action-pill gb-bookmark-active"
            onClick={handleBookmark}
            title="Click to update bookmark to current scroll position"
            type="button"
          >
            <svg className="gb-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span className="gb-bookmark-text">Bookmarked</span>
          </button>
          <button
            className="gb-bookmark-remove"
            onClick={handleRemove}
            title="Remove bookmark"
            type="button"
            aria-label="Remove bookmark"
          >
            ✕
          </button>
        </div>
      ) : bookmark ? (
        <button
          className="gb-action-pill gb-bookmark-remote"
          onClick={handleJumpToBookmark}
          title={`Jump back to saved reading position in "${bookmark.title}"`}
          type="button"
        >
          <svg className="gb-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span className="gb-bookmark-text">Resume: {bookmark.title.slice(0, 16)}...</span>
        </button>
      ) : (
        <button
          className="gb-action-pill gb-bookmark-btn"
          onClick={handleBookmark}
          title="Save reading position on this chapter"
          type="button"
        >
          <svg className="gb-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span className="gb-bookmark-text">Bookmark</span>
        </button>
      )}

      {toast && <div className="gb-bookmark-toast">{toast}</div>}
    </div>
  );
}
