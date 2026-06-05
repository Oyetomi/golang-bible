/* The ribbon bookmark — like the silk ribbon in a physical Bible. One ribbon,
   moved around the book, persisted in localStorage. It remembers the chapter
   AND the exact scroll position so "return to ribbon" lands you where you were. */

export type RibbonMark = {
  href: string;
  title: string;
  part: string;
  scrollY: number;
  pct: number; // fraction 0..1, fallback if layout height changed
  ts: number;
};

const KEY = "gb-ribbon";
const RESTORE_KEY = "gb-ribbon-restore";

export function getRibbon(): RibbonMark | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RibbonMark) : null;
  } catch {
    return null;
  }
}

export function setRibbon(mark: RibbonMark | null) {
  if (typeof window === "undefined") return;
  try {
    if (mark) localStorage.setItem(KEY, JSON.stringify(mark));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — no-op */
  }
  window.dispatchEvent(new Event("gb:ribbon"));
}

/** Stash the target scroll position before navigating to the ribbon's chapter;
    the destination page consumes it on mount. */
export function armScrollRestore(href: string, y: number, pct: number) {
  try {
    sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ href, y, pct }));
  } catch {
    /* no-op */
  }
}

export function consumeScrollRestore(
  href: string
): { y: number; pct: number } | null {
  try {
    const raw = sessionStorage.getItem(RESTORE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o.href === href) {
      sessionStorage.removeItem(RESTORE_KEY);
      return { y: o.y, pct: o.pct };
    }
  } catch {
    /* no-op */
  }
  return null;
}
