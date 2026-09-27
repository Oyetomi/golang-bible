"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* Makes long example programs readable instead of overwhelming.

   1. Boilerplate fold: `package main` + the import block collapse into one
      clickable summary line ("package main · 3 imports"), so a program opens
      on the code that matters. Line numbers stay true: the first visible line
      resets the gutter counter to its real number.
   2. Height clamp: programs longer than CLAMP_AT visible lines open on their
      first PEEK lines under a fade, with "Show all N lines" below.

   All controls live OUTSIDE the <pre>, because the Codapi runner and the Copy
   button read the <pre>'s text. CodeWalks, labs and project files are left
   alone: their steps point at exact lines, or the reader is meant to edit
   the whole thing. */
const MIN_LINES = 12; // don't fold boilerplate in tiny programs
const CLAMP_AT = 28;
const PEEK = 18;
const SKIP = ".cwk, .lab, .lab-starter, .hacklab, .proj-code, .ply-modal";

const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+$/, "");

export function CodeFold() {
  const pathname = usePathname();

  useEffect(() => {
    // Let rehype output and the other enhancers settle first.
    const t = window.setTimeout(foldAll, 60);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return null;
}

function foldAll() {
  for (const pre of Array.from(document.querySelectorAll<HTMLElement>(".prose pre"))) {
    if (pre.dataset.fold) continue;
    pre.dataset.fold = "1";
    if (pre.closest(SKIP)) continue;
    const lines = Array.from(pre.querySelectorAll<HTMLElement>("code > [data-line]"));
    if (lines.length < MIN_LINES) continue;

    const hidden = foldBoilerplate(pre, lines);
    clamp(pre, lines.length - hidden);
  }
}

/* Returns how many lines were folded away. */
function foldBoilerplate(pre: HTMLElement, lines: HTMLElement[]): number {
  const first = text(lines[0]).trim();
  const pkg = first.match(/^package\s+(\w+)/);
  if (!pkg) return 0;

  let i = 1;
  while (i < lines.length && text(lines[i]).trim() === "") i++;
  if (i >= lines.length) return 0;

  let end = -1;
  let imports = 0;
  const line = text(lines[i]).trim();
  if (/^import\s*\($/.test(line)) {
    for (let j = i + 1; j < lines.length; j++) {
      const l = text(lines[j]).trim();
      if (l === ")") {
        end = j;
        break;
      }
      if (l.includes('"')) imports++;
    }
  } else if (/^import\s+(\w+\s+)?"/.test(line)) {
    end = i;
    imports = 1;
  }
  if (end < 0) return 0;
  // Swallow the blank line after the imports too.
  if (end + 1 < lines.length && text(lines[end + 1]).trim() === "") end++;
  if (end + 1 >= lines.length) return 0;

  const folded = lines.slice(0, end + 1);
  const firstVisible = lines[end + 1];
  const setFolded = (on: boolean) => {
    folded.forEach((l) => l.classList.toggle("gb-fold-hide", on));
    // counter-set runs before counter-increment, so the next line shows end+2:
    // its real 1-based line number.
    firstVisible.style.setProperty("counter-set", on ? `gb-line ${end + 1}` : "");
    bar.setAttribute("aria-expanded", on ? "false" : "true");
    bar.querySelector(".gb-fold-act")!.textContent = on ? "show" : "hide";
  };

  const bar = document.createElement("button");
  bar.type = "button";
  bar.className = "gb-fold-bar";
  bar.innerHTML = `<span class="gb-fold-pkg">package ${pkg[1]}</span><span class="gb-fold-sep">·</span><span>${imports} import${imports === 1 ? "" : "s"}</span><span class="gb-fold-act"></span>`;
  bar.title = "Show or hide the package clause and imports";
  bar.addEventListener("click", () => setFolded(folded[0].classList.contains("gb-fold-hide") ? false : true));
  pre.parentElement?.insertBefore(bar, pre);
  setFolded(true);
  return folded.length;
}

function clamp(pre: HTMLElement, visible: number) {
  if (visible <= CLAMP_AT) return;
  if (pre.classList.contains("gb-2col")) return;
  const lh = parseFloat(getComputedStyle(pre.querySelector("code") ?? pre).lineHeight) || 22;
  const pad = parseFloat(getComputedStyle(pre).paddingTop) || 0;
  const peek = Math.round(PEEK * lh + pad);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gb-clamp-btn";
  const set = (on: boolean) => {
    pre.classList.toggle("gb-clamped", on);
    pre.style.maxHeight = on ? `${peek}px` : "";
    btn.textContent = on ? `Show all ${visible} lines` : "Show less";
    btn.setAttribute("aria-expanded", on ? "false" : "true");
  };
  btn.addEventListener("click", () => {
    const opening = pre.classList.contains("gb-clamped");
    set(!opening);
    if (!opening) pre.scrollIntoView({ block: "nearest" });
  });
  pre.insertAdjacentElement("afterend", btn);
  set(true);
}
