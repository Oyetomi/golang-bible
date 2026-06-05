/* Client-side search: lazy-loads the prebuilt index and scores it with a small
   field-weighted matcher (no external search dep). */

export type SearchEntry = {
  id: number;
  chTitle: string;
  href: string;
  part: number | "appendix";
  type: "course" | "project";
  heading: string | null;
  anchor: string;
  desc?: string;
  text: string;
};

export type Hit = {
  entry: SearchEntry;
  score: number;
  snippet: { text: string; terms: string[] };
};

export type ChapterGroup = {
  href: string;
  chTitle: string;
  part: number | "appendix";
  type: "course" | "project";
  hits: Hit[];
};

let cache: SearchEntry[] | null = null;
let loading: Promise<SearchEntry[]> | null = null;

export function loadIndex(): Promise<SearchEntry[]> {
  if (cache) return Promise.resolve(cache);
  if (loading) return loading;
  loading = fetch("/search-index.json")
    .then((r) => r.json())
    .then((data: SearchEntry[]) => {
      cache = data;
      return data;
    });
  return loading;
}

/** Fire-and-forget signal that opens the search modal (wired in Search.tsx). */
export function openSearch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("gb:search"));
  }
}

function makeSnippet(text: string, terms: string[]): { text: string; terms: string[] } {
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return { text: text.slice(0, 160), terms };
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, at + 120);
  let snip = text.slice(start, end).trim();
  if (start > 0) snip = "… " + snip;
  if (end < text.length) snip = snip + " …";
  return { text: snip, terms };
}

export function search(index: SearchEntry[], query: string): ChapterGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const hits: Hit[] = [];
  for (const e of index) {
    const title = e.chTitle.toLowerCase();
    const heading = (e.heading ?? "").toLowerCase();
    const desc = (e.desc ?? "").toLowerCase();
    const body = e.text.toLowerCase();

    let score = 0;
    let matchedAll = true;
    for (const t of terms) {
      let s = 0;
      if (title.includes(t)) s += 10;
      if (heading.includes(t)) s += 6;
      if (desc.includes(t)) s += 4;
      if (body.includes(t)) s += 1;
      if (s === 0) matchedAll = false;
      score += s;
    }
    if (!matchedAll) continue;

    // whole-phrase bonuses
    if (terms.length > 1) {
      if (title.includes(q)) score += 8;
      if (heading.includes(q)) score += 5;
    }
    // prefer section hits over the broad intro entry on ties
    if (e.heading) score += 0.5;

    hits.push({ entry: e, score, snippet: makeSnippet(e.text, terms) });
  }

  hits.sort((a, b) => b.score - a.score);

  // Group by chapter, preserving best-first order; cap sections per chapter.
  const byHref = new Map<string, ChapterGroup>();
  for (const h of hits) {
    const { href, chTitle, part, type } = h.entry;
    let g = byHref.get(href);
    if (!g) {
      g = { href, chTitle, part, type, hits: [] };
      byHref.set(href, g);
    }
    if (g.hits.length < 4) g.hits.push(h);
  }
  return [...byHref.values()].slice(0, 8);
}

export function partLabel(part: number | "appendix"): string {
  return part === "appendix" ? "Appendix" : `Part ${part}`;
}
