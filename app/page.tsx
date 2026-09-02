import Link from "next/link";
import type { CSSProperties } from "react";
import { chapters, partGroups } from "@/lib/manifest";
import { ContinueReading } from "@/components/ContinueReading";

export default function Home() {
  const groups = partGroups();
  const first = chapters.find((c) => c.part === 1 && c.order === 1);

  return (
    <div className="prose">
      <section className="hero">
        <div className="hero-label">The Go Bible</div>
        <h1 className="hero-title">
          You want to be great at Go. Good. You came to the right teacher.
        </h1>
        <div className="hero-intro">
          <p>
            Three core tracks and a comprehensive systems & DS&amp;A appendix. {chapters.length} flagship chapters. Zero
            hand-waving. We go from your very first <code>package main</code> all
            the way to high-concurrency systems, distributed Raft consensus, eBPF
            kernel tracing, Kubernetes operators, and audited double-entry ledgers —
            and we explain every machine underneath it. Every concept gets a real
            scenario and an interactive visual you can actually watch run.
          </p>
        </div>
      </section>

      <ContinueReading />

      {first && (
        <Link href={first.href} className="nextup">
          <span className="nextup-label">Start here →</span>
          <span className="nextup-title">{first.title}</span>
        </Link>
      )}

      {groups.map((g) => (
        <section key={g.part}>
          <h2>
            {g.label} — {g.title}
          </h2>
          <p style={{ color: "var(--text-dim)", marginTop: "-0.4em" }}>
            {g.subtitle}.
          </p>
          <div className="cgrid" style={{ "--cols": "2" } as CSSProperties}>
            {g.chapters.map((c) => (
              <Link
                key={c.slug}
                href={c.href}
                className="ccard"
                style={{ textDecoration: "none", display: "block" }}
              >
                <div className="ccard-label">
                  {c.order}. {c.type === "project" ? "Project" : "Course"}
                </div>
                <div className="ccard-body" style={{ color: "var(--text)" }}>
                  {c.title}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
