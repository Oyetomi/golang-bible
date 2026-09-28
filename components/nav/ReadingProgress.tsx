"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/* The thin progress bar under the header. It only shows position: a
   chapter is marked read with the MarkRead button at its end, not by
   scrolling there. */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100;
        setProgress(Math.min(100, Math.max(0, currentProgress)));
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
