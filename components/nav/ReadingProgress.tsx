"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { chapterByHref } from "@/lib/manifest";
import { recordChapter } from "@/lib/gamification";

/* The thin progress bar under the header. Reaching the end of a chapter
   (97% of the page) also marks it read, once, which is what the sidebar
   ticks and the home page's outlines count. */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  const recorded = useRef<string | null>(null);

  useEffect(() => {
    const chapter = chapterByHref(pathname);
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setProgress(Math.min(100, Math.max(0, currentProgress)));
        if (chapter && currentProgress >= 97 && recorded.current !== chapter.slug) {
          recorded.current = chapter.slug;
          recordChapter(chapter.slug);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  return (
    <div className="gb-reading-progress-track" aria-hidden="true">
      <div
        className="gb-reading-progress-fill"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
