import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { PlaygroundRunner } from "@/components/course/Playground";
import { highlightGo } from "@/lib/highlight";

let plyCounter = 0;

/* ──────────────────────────────────────────────
   Server (static) course components.
   Interactive ones live in ./client.tsx.
   All are injected into MDX via /mdx-components.tsx,
   so chapter files use them with NO import lines.
   ────────────────────────────────────────────── */

export function HeroCard({
  label,
  title,
  children,
}: {
  label?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="hero">
      {label && <div className="hero-label">{label}</div>}
      <h1 className="hero-title">{title}</h1>
      {children && <div className="hero-intro">{children}</div>}
    </section>
  );
}

function CodeWindow({
  file,
  label,
  tone,
  code,
}: {
  file: string;
  label: string;
  tone: "bad" | "good";
  code: string;
}) {
  return (
    <div className={`cw cw-${tone}`}>
      <div className="cw-bar">
        <span className="cw-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="cw-file">{file}</span>
        <span className={`cw-tag cw-tag-${tone}`}>{label}</span>
      </div>
      <pre className="cw-code">
        <code dangerouslySetInnerHTML={{ __html: highlightGo(code.replace(/^\n+|\n+$/g, "")) }} />
      </pre>
    </div>
  );
}

export function BeforeAfter({
  bad,
  good,
  badFile = "main.go",
  goodFile = "main.go",
  badLabel = "Naïve",
  goodLabel = "Idiomatic",
}: {
  bad: string;
  good: string;
  badFile?: string;
  goodFile?: string;
  badLabel?: string;
  goodLabel?: string;
}) {
  return (
    <div className="beforeafter">
      <CodeWindow tone="bad" file={badFile} label={badLabel} code={bad} />
      <CodeWindow tone="good" file={goodFile} label={goodLabel} code={good} />
    </div>
  );
}

export function ConceptGrid({
  children,
  cols,
}: {
  children: ReactNode;
  cols?: number;
}) {
  return (
    <div
      className="cgrid"
      style={cols ? ({ "--cols": String(cols) } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

export function ConceptCard({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="ccard">
      <div className="ccard-label">{label}</div>
      <div className="ccard-body">{children}</div>
    </div>
  );
}

export function Gotcha({
  label = "Gotcha",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="ccard ccard-gotcha">
      <div className="ccard-label">⚠ {label}</div>
      <div className="ccard-body">{children}</div>
    </div>
  );
}

export function UnderTheHood({
  title = "Under the Hood",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="uth">
      <div className="uth-tag">⚙ {title}</div>
      <div className="uth-body">{children}</div>
    </section>
  );
}

/* The runnable code is authored as a fenced ```go block INSIDE this component,
   so it goes through the same rehype-pretty-code/Shiki pipeline as prose code
   (identical formatting) with no JS-template-literal escaping pitfalls. We give
   the code wrapper an id and point Codapi's runner at it via selector. */
export function GoPlayground({
  title = "main.go",
  folder = "playground/",
  children,
}: {
  title?: string;
  folder?: string;
  children?: ReactNode;
}) {
  const id = `ply-${++plyCounter}`;
  return (
    <div className="ply gb-ide-window">
      <div className="ply-ide-bar">
        <div className="gb-ide-left">
          <span className="gb-ide-dots">
            <i className="gb-dot-r" />
            <i className="gb-dot-y" />
            <i className="gb-dot-g" />
          </span>
          <div className="gb-ide-tab">
            <span className="gb-ide-folder">📁 {folder}</span>
            <span className="gb-ide-file">📄 {title}</span>
          </div>
        </div>
        <div className="gb-ide-right">
          <span className="ply-kbd-hint">⌘Enter to run</span>
          <span className="gb-ide-lang">GO 1.26</span>
          <span className="ply-hint">runnable</span>
        </div>
      </div>
      <div className="ply-code" id={id}>
        {children}
      </div>
      {/* Target the <pre> specifically so Codapi/Copy read ONLY the code,
          never the column-toggle button that may be appended to the figure. */}
      <PlaygroundRunner selector={`#${id} pre`} />
    </div>
  );
}

export function Solution({
  title = "Show solution",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <details className="sol">
      <summary className="sol-sum">{title}</summary>
      <div className="sol-body">{children}</div>
    </details>
  );
}

/** Inline term definition — define every new term on first use. Projects and
 *  heavy chapters MUST define the concepts they lean on (idempotency, a ledger,
 *  Kafka, …) right where they're first used, with a one-line plain-language
 *  definition, why it matters, and a link to the chapter that goes deep. */
export function Define({
  term,
  since,
  children,
}: {
  term: string;
  since?: string; // optional "deep dive: <chapter>" pointer, plain text or a link
  children: ReactNode;
}) {
  return (
    <div className="define">
      <div className="define-term">
        <span className="define-tag">def</span>
        {term}
      </div>
      <div className="define-body">{children}</div>
      {since && <div className="define-since">Goes deep in: {since}</div>}
    </div>
  );
}

export function Callout({
  kind = "note",
  title,
  children,
}: {
  kind?: "note" | "warn" | "pro" | "tip" | "advanced";
  title?: string;
  children: ReactNode;
}) {
  const icon =
    kind === "warn"
      ? "⚠"
      : kind === "pro"
      ? "★"
      : kind === "tip"
      ? "✦"
      : kind === "advanced"
      ? "⚙"
      : "❖";
  return (
    <div className={`callout callout-${kind}`}>
      {title && (
        <div className="callout-title">
          {icon} {title}
        </div>
      )}
      <div className="callout-body">{children}</div>
    </div>
  );
}

export function Exercise({
  n,
  title,
  level,
  children,
}: {
  n?: number | string;
  title: string;
  level?: "easy" | "medium" | "hard";
  children: ReactNode;
}) {
  return (
    <section className="exo">
      <div className="exo-head">
        <span className="exo-n">Exercise {n ?? ""}</span>
        <span className="exo-title">{title}</span>
        {level && <span className={`exo-lvl exo-lvl-${level}`}>{level}</span>}
      </div>
      <div className="exo-body">{children}</div>
    </section>
  );
}

export function Recap({ children }: { children: ReactNode }) {
  return (
    <section className="recap">
      <div className="recap-tag">Recap</div>
      <div className="recap-body">{children}</div>
    </section>
  );
}

export function NextUp({
  href,
  title,
  label = "Next chapter",
}: {
  href: string;
  title: string;
  label?: string;
}) {
  return (
    <Link href={href} className="nextup">
      <span className="nextup-label">{label} →</span>
      <span className="nextup-title">{title}</span>
    </Link>
  );
}

export function ComingSoon({ title }: { title: string }) {
  return (
    <section className="hero">
      <div className="hero-label">In the forge</div>
      <h1 className="hero-title">{title}</h1>
      <div className="hero-intro">
        <p>
          This chapter hasn&rsquo;t been forged yet — the fan-out hasn&rsquo;t reached it.
          It&rsquo;s on the manifest, it&rsquo;s coming, and it&rsquo;ll be flawless. Patience, sport.
        </p>
      </div>
    </section>
  );
}
