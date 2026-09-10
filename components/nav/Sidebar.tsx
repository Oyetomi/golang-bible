"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { partGroups } from "@/lib/manifest";
import { openSearch } from "@/lib/search";
import { getProfile, PlayerProfile } from "@/lib/gamification";

export function Sidebar() {
  const pathname = usePathname();
  const groups = partGroups();
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const railRef = useRef<HTMLElement | null>(null);

  // With 120 chapters the rail is ~5000px tall. Landing on a late one left it
  // parked at the top with the current chapter far below the fold, so the
  // reader had no idea where they were. Bring it into view — centred, and
  // without animation on first paint so it does not read as a jump.
  useEffect(() => {
    const rail = railRef.current;
    const active = rail?.querySelector<HTMLElement>(".sidebar-link.active");
    if (!rail || !active) return;

    const target = active.offsetTop - rail.clientHeight / 2 + active.offsetHeight / 2;
    rail.scrollTo({ top: Math.max(0, target), behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    const update = () => {
      const p = getProfile();
      setCompleted(new Set(p.completedChapters || []));
    };
    update();

    const handleGame = (e: CustomEvent<PlayerProfile>) => {
      if (e.detail?.completedChapters) {
        setCompleted(new Set(e.detail.completedChapters));
      }
    };
    window.addEventListener("gb:gamification", handleGame as EventListener);
    return () => window.removeEventListener("gb:gamification", handleGame as EventListener);
  }, []);

  return (
    <aside className="sidebar" ref={railRef}>
      <Link href="/" className="sidebar-brand">
        <svg className="sidebar-mark" viewBox="0 0 64 64" width="26" height="26" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="gbBrand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#29C9F2" />
              <stop offset="1" stopColor="#0090B6" />
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="15" fill="url(#gbBrand)" />
          <g fill="#0B1220">
            <circle cx="17" cy="17.5" r="7" />
            <circle cx="47" cy="17.5" r="7" />
            <path d="M10 31 C10 13.5, 54 13.5, 54 31 L54 39 C54 51.5, 10 51.5, 10 39 Z" />
          </g>
          <circle cx="23" cy="29.5" r="10.4" fill="#FFFFFF" />
          <circle cx="41" cy="29.5" r="10.4" fill="#FFFFFF" />
          <circle cx="25" cy="29.5" r="5.2" fill="#0B1220" />
          <circle cx="43" cy="29.5" r="5.2" fill="#0B1220" />
          <rect x="29.4" y="43.4" width="2.4" height="5.4" rx="1.1" fill="#FFFFFF" />
          <rect x="32.2" y="43.4" width="2.4" height="5.4" rx="1.1" fill="#FFFFFF" />
        </svg>
        The Go <span className="spark">Bible</span>
      </Link>

      <button className="sidebar-search" onClick={() => openSearch()} type="button">
        <span className="sidebar-search-glass">⌕</span>
        <span>Search</span>
        <kbd className="sidebar-search-kbd">⌘K</kbd>
      </button>

      {groups.map((g) => (
        <div className="sidebar-part" key={g.part}>
          <span className="sidebar-part-label">
            {g.label} · {g.title}
          </span>
          {g.chapters.map((c) => {
            const active = pathname === c.href;
            const isDone = completed.has(c.slug);
            return (
              <Link
                key={c.slug}
                href={c.href}
                className={`sidebar-link ${active ? "active" : ""} ${
                  c.type === "project" ? "is-project" : ""
                } ${isDone ? "is-completed" : ""}`}
              >
                <span className="sidebar-num">{isDone ? "✓" : c.order}</span>
                <span className="sidebar-text">{c.title}</span>
                {c.type === "project" && (
                  <span className="sidebar-badge">build</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
