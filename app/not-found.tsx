import Link from "next/link";

export default function NotFound() {
  return (
    <div className="prose" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.25rem 0.75rem",
          borderRadius: "999px",
          background: "var(--accent-soft)",
          border: "1px solid var(--accent-line)",
          color: "var(--accent-strong)",
          fontSize: "0.85rem",
          fontFamily: "var(--font-mono)",
          marginBottom: "1.5rem",
        }}
      >
        <span>404</span>
        <span>·</span>
        <span>nil pointer dereference</span>
      </div>

      <h1 style={{ fontSize: "2.5rem", margin: "0 0 1rem", letterSpacing: "-0.03em" }}>
        Chapter Not Found
      </h1>

      <p
        style={{
          maxWidth: "520px",
          margin: "0 auto 2.5rem",
          color: "var(--text-dim)",
          fontSize: "1.05rem",
          lineHeight: "1.6",
        }}
      >
        The runtime could not resolve this route in the manifest. The page may have been
        relocated, or you followed a dead pointer into unallocated memory.
      </p>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          className="ccard"
          style={{
            padding: "0.75rem 1.5rem",
            textDecoration: "none",
            borderRadius: "var(--radius-sm)",
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>← Table of Contents</span>
        </Link>
        <Link
          href="/part-1/go-fundamentals"
          className="ccard"
          style={{
            padding: "0.75rem 1.5rem",
            textDecoration: "none",
            borderRadius: "var(--radius-sm)",
            fontWeight: 500,
            background: "var(--accent-soft)",
            borderColor: "var(--accent-line)",
            color: "var(--accent-strong)",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>Start at Chapter 1 →</span>
        </Link>
      </div>
    </div>
  );
}
