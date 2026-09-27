import Link from "next/link";
import verified from "@/content/_verified.json";
import { partLabel, PART_TITLES, type Chapter } from "@/lib/manifest";

type Verified = {
  toolchain: string;
  checked: string;
  chapters: Record<string, { built: number; failed: number; updated: string }>;
};

const V = verified as Verified;

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/* The line above every chapter title: where you are, and what was actually
   checked. Every number comes from content/_verified.json, which only
   `pnpm verify:record` writes after a real strict build of every snippet, so
   the badge never claims more than a run proved. */
export function ChapterMeta({ chapter }: { chapter: Chapter }) {
  const v = V.chapters[chapter.path];
  const go = V.toolchain.replace(/^go/, "Go ");
  return (
    <div className="chmeta">
      <nav className="chmeta-crumbs" aria-label="Breadcrumb">
        <Link href="/">The Go Bible</Link>
        <span aria-hidden>/</span>
        <span>
          {partLabel(chapter.part)} · {PART_TITLES[String(chapter.part)]}
        </span>
      </nav>
      {v && v.failed === 0 && (
        <span
          className="chmeta-verified"
          title={`Every standalone Go program in this chapter was compiled with ${V.toolchain} on ${fmt(V.checked)}. Linux-only and intentionally broken examples are excluded.`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
          {v.built > 0 ? (
            <>
              {v.built} program{v.built === 1 ? "" : "s"} build on {go}
            </>
          ) : (
            <>Checked against {go}</>
          )}
          <span className="chmeta-dot" aria-hidden>·</span>
          updated {fmt(v.updated)}
        </span>
      )}
    </div>
  );
}
