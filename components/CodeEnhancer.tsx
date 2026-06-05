"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* Tall code blocks (>= THRESHOLD lines) don't fit a laptop screen at a glance.
   This tags them and adds a toggle that flows the code into TWO side-by-side
   columns (newspaper order: down column 1, then column 2), so a long function
   is visible all at once. Wide screens default to 2 columns; the reader can
   switch back to a single wrapped column. Pure progressive enhancement —
   it mutates server-rendered code DOM that no client component owns. */
const THRESHOLD = 30;

export function CodeEnhancer() {
  const pathname = usePathname();
  useEffect(() => {
    const pres = Array.from(
      document.querySelectorAll<HTMLElement>(".prose pre")
    );
    for (const pre of pres) {
      if (pre.dataset.enhanced) continue;
      const lines = pre.querySelectorAll("code [data-line]").length;
      if (lines < THRESHOLD) continue;
      pre.dataset.enhanced = "1";
      pre.classList.add("gb-tall");
      if (window.innerWidth >= 1100) pre.classList.add("gb-2col");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gb-coltoggle";
      const sync = () => {
        btn.textContent = pre.classList.contains("gb-2col")
          ? "1 column"
          : "2 columns";
      };
      sync();
      btn.addEventListener("click", () => {
        pre.classList.toggle("gb-2col");
        sync();
      });
      // Append the toggle to the figure (the pre's wrapper), NOT inside the pre
      // itself — otherwise its text leaks into the code Codapi runs.
      const host = (pre.parentElement as HTMLElement) ?? pre;
      host.style.position = "relative";
      host.appendChild(btn);
    }
  }, [pathname]);

  return null;
}
