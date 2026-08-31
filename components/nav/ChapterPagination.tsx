import Link from "next/link";
import type { Chapter } from "@/lib/manifest";

interface ChapterPaginationProps {
  prev: Chapter | null;
  next: Chapter | null;
}

export function ChapterPagination({ prev, next }: ChapterPaginationProps) {
  if (!prev && !next) return null;

  return (
    <nav className="gb-chapter-nav" aria-label="Chapter navigation">
      {prev ? (
        <Link href={prev.href} className="gb-nav-card gb-nav-prev">
          <div className="gb-nav-card-dir">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Previous Chapter</span>
          </div>
          <div className="gb-nav-card-title">
            <span className="gb-nav-order">{prev.order}.</span>
            <span>{prev.title}</span>
          </div>
        </Link>
      ) : (
        <div className="gb-nav-spacer" />
      )}

      {next ? (
        <Link href={next.href} className="gb-nav-card gb-nav-next">
          <div className="gb-nav-card-dir">
            <span>Next Chapter</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
          <div className="gb-nav-card-title">
            <span className="gb-nav-order">{next.order}.</span>
            <span>{next.title}</span>
          </div>
        </Link>
      ) : (
        <div className="gb-nav-spacer" />
      )}
    </nav>
  );
}
