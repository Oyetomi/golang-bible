"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("The Go Bible Runtime Error:", error);
  }, [error]);

  return (
    <div className="prose" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.25rem 0.75rem",
          borderRadius: "999px",
          background: "var(--danger-soft)",
          border: "1px solid var(--danger)",
          color: "var(--danger)",
          fontSize: "0.85rem",
          fontFamily: "var(--font-mono)",
          marginBottom: "1.5rem",
        }}
      >
        <span>panic recovered</span>
      </div>

      <h1 style={{ fontSize: "2.5rem", margin: "0 0 1rem", letterSpacing: "-0.03em" }}>
        Something Went Wrong
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
        A runtime panic was intercepted before it crashed your session. You can attempt
        to recover the current frame or return to the curriculum home.
      </p>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => reset()}
          type="button"
          style={{
            cursor: "pointer",
            padding: "0.75rem 1.5rem",
            borderRadius: "var(--radius-sm)",
            fontWeight: 500,
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-line)",
            color: "var(--accent-strong)",
            fontFamily: "inherit",
          }}
        >
          Recover Frame (Retry)
        </button>
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
          }}
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
