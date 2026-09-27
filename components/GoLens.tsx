"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { scanLine, type LensDiagram, type LensHit } from "@/lib/golens";

/* GoLens: every Go code block can explain its own syntax.

   - Hover a line (tap on touch) that uses a tricky pattern (`&T{}`, `*T`,
     `<-ch`, `x.(T)`, a pointer receiver…) and a card explains that line in
     plain English, with a small memory picture for pointer patterns.
   - Each block also gets an "Explain the syntax" row listing every pattern
     it uses; hovering an entry highlights the lines that use it.

   Nothing is written inside the code text: lines only gain data attributes
   and classes, so Run and Copy read exactly the original program. */

const hitsOf = new WeakMap<HTMLElement, LensHit[]>();
let card: HTMLDivElement | null = null;
let hideTimer: number | undefined;

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function GoLens() {
  const pathname = usePathname();
  useEffect(() => {
    // After CodeEnhancer and CodeFold have settled.
    const t = window.setTimeout(scanAll, 140);
    return () => window.clearTimeout(t);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hideCard(0);
    const onScroll = () => hideCard(0);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);
  return null;
}

function isGo(pre: HTMLElement) {
  const lang = (pre.getAttribute("data-language") ?? pre.closest("figure")?.getAttribute("data-language") ?? "go").toLowerCase();
  return lang === "go";
}

function scanAll() {
  for (const pre of Array.from(document.querySelectorAll<HTMLElement>(".prose pre"))) {
    if (pre.dataset.lens) continue;
    pre.dataset.lens = "1";
    if (!isGo(pre)) continue;
    const lines = Array.from(pre.querySelectorAll<HTMLElement>("code > [data-line]"));
    const byId = new Map<string, { hit: LensHit; lines: HTMLElement[] }>();
    for (const line of lines) {
      const hits = scanLine(line.textContent ?? "");
      if (!hits.length) continue;
      hitsOf.set(line, hits);
      line.dataset.lensHits = hits.map((h) => h.id).join(" ");
      line.addEventListener("pointerenter", onEnter);
      line.addEventListener("pointerleave", () => hideCard(180));
      line.addEventListener("click", onTap);
      for (const h of hits) {
        const e = byId.get(h.id) ?? { hit: h, lines: [] };
        e.lines.push(line);
        byId.set(h.id, e);
      }
    }
    if (byId.size >= 2) addLegend(pre, byId);
  }
}

/* ── the hover / tap card ─────────────────────────────── */

function onEnter(e: PointerEvent) {
  if (e.pointerType !== "mouse") return; // touch uses tap
  const line = e.currentTarget as HTMLElement;
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => showCard(line), 260);
}

function onTap(e: MouseEvent) {
  // Mouse users get hover; this path serves touch and pen.
  if ((e as PointerEvent).pointerType === "mouse") return;
  if (window.getSelection()?.toString()) return; // don't fight text selection
  const line = e.currentTarget as HTMLElement;
  if (card?.dataset.for === lineKey(line)) hideCard(0);
  else showCard(line);
}

const lineKey = (l: HTMLElement) => `${l.closest("pre")?.dataset.lensId ?? ""}:${Array.from(l.parentElement?.children ?? []).indexOf(l)}`;

function showCard(line: HTMLElement) {
  const hits = hitsOf.get(line);
  if (!hits) return;
  const pre = line.closest("pre")!;
  if (!pre.dataset.lensId) pre.dataset.lensId = Math.random().toString(36).slice(2, 8);
  if (!card) {
    card = document.createElement("div");
    card.className = "lens-card";
    card.setAttribute("role", "tooltip");
    card.addEventListener("pointerenter", () => window.clearTimeout(hideTimer));
    card.addEventListener("pointerleave", () => hideCard(180));
    document.body.appendChild(card);
  }
  card.dataset.for = lineKey(line);
  // Important patterns get a full entry; everyday ones (:=, _, err checks)
  // shrink to one compact line underneath, so the card stays short.
  const main = hits.filter((h) => !h.basic);
  const basics = hits.filter((h) => h.basic);
  const full = (h: LensHit) =>
    `<div class="lens-item"><code class="lens-syntax">${esc(h.title)}</code><p>${esc(h.body)}</p>${
      h.diagram ? diagram(h.diagram, h.name ?? "") : ""
    }</div>`;
  const compact = (h: LensHit) => `<div class="lens-basic"><code>${esc(h.title)}</code> ${esc(h.body)}</div>`;
  card.innerHTML =
    `<div class="lens-kicker">Reading this line</div>` +
    (main.length ? main.map(full).join("") + basics.map(compact).join("") : basics.map(full).join(""));
  document.querySelectorAll(".lens-line-on").forEach((el) => el.classList.remove("lens-line-on"));
  line.classList.add("lens-line-on");

  // Place it beside the line, never over it: below if it fits, else above,
  // else on the roomier side with its own scroll.
  const r = line.getBoundingClientRect();
  const pr = pre.getBoundingClientRect();
  const w = Math.min(440, window.innerWidth - 24);
  const gap = 8;
  const spaceBelow = window.innerHeight - r.bottom - gap - 8;
  const spaceAbove = r.top - gap - 8;
  card.style.width = `${w}px`;
  card.style.maxHeight = "";
  card.classList.add("on");
  const h = card.offsetHeight;
  let top: number;
  if (h <= spaceBelow) top = r.bottom + gap;
  else if (h <= spaceAbove) top = r.top - gap - h;
  else if (spaceBelow >= spaceAbove) {
    card.style.maxHeight = `${Math.max(140, spaceBelow)}px`;
    top = r.bottom + gap;
  } else {
    const mh = Math.max(140, spaceAbove);
    card.style.maxHeight = `${mh}px`;
    top = r.top - gap - Math.min(h, mh);
  }
  card.style.left = `${Math.max(12, Math.min(pr.left + 48, window.innerWidth - w - 12))}px`;
  card.style.top = `${top}px`;
}

function hideCard(delay: number) {
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    card?.classList.remove("on");
    if (card) card.dataset.for = "";
    document.querySelectorAll(".lens-line-on").forEach((el) => el.classList.remove("lens-line-on"));
  }, delay);
}

/* ── the per-block legend ─────────────────────────────── */

function addLegend(pre: HTMLElement, byId: Map<string, { hit: LensHit; lines: HTMLElement[] }>) {
  const wrap = document.createElement("div");
  wrap.className = "lens-legend";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "lens-legend-btn";
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = `<span class="lens-glass" aria-hidden="true"></span>Explain the Go syntax in this code <span class="lens-count">${byId.size}</span>`;
  const panel = document.createElement("div");
  panel.className = "lens-panel";
  panel.hidden = true;
  for (const { hit, lines } of byId.values()) {
    const item = document.createElement("div");
    item.className = "lens-item";
    item.tabIndex = 0;
    item.innerHTML = `<code class="lens-syntax">${esc(hit.title)}</code><span class="lens-where">line${lines.length > 1 ? "s" : ""} ${lines
      .map((l) => Array.from(l.parentElement!.children).indexOf(l) + 1)
      .join(", ")}</span><p>${esc(hit.body)}</p>${hit.diagram ? diagram(hit.diagram, hit.name ?? "") : ""}`;
    const on = (v: boolean) => lines.forEach((l) => l.classList.toggle("lens-line-on", v));
    item.addEventListener("pointerenter", () => on(true));
    item.addEventListener("pointerleave", () => on(false));
    item.addEventListener("focus", () => on(true));
    item.addEventListener("blur", () => on(false));
    panel.appendChild(item);
  }
  btn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    btn.setAttribute("aria-expanded", String(!panel.hidden));
  });
  wrap.append(btn, panel);
  // Below the code and its "show all" button, but still inside the code window.
  const anchor = pre.nextElementSibling?.classList.contains("gb-clamp-btn") ? pre.nextElementSibling : pre;
  anchor.insertAdjacentElement("afterend", wrap);
}

/* ── memory pictures ──────────────────────────────────── */

function diagram(kind: LensDiagram, rawName: string): string {
  const name = esc(rawName.length > 16 ? rawName.slice(0, 15) + "…" : rawName);
  const box = (x: number, label: string, top: string, sub: string, cls = "") =>
    `<g class="${cls}"><text x="${x + 60}" y="14" class="lens-d-cap">${top}</text>` +
    `<rect x="${x}" y="20" width="120" height="40" rx="7"/>` +
    `<text x="${x + 60}" y="45" class="lens-d-val">${label}</text>` +
    `<text x="${x + 60}" y="76" class="lens-d-sub">${sub}</text></g>`;
  const arrow = `<path class="lens-d-arrow" d="M132 40 H 196" marker-end="url(#lensHead)"/>`;
  const defs = `<defs><marker id="lensHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z"/></marker></defs>`;
  const svg = (inner: string) =>
    `<svg class="lens-diagram" viewBox="0 0 330 84" role="img" aria-label="memory diagram">${defs}${inner}</svg>`;
  switch (kind) {
    case "pointer-literal":
      return svg(
        box(6, "0xc000014090", `pointer (*${name})`, "holds an ADDRESS", "ptr") +
          arrow +
          box(204, `${name}{…}`, "the value itself", "lives at 0xc000014090", "val"),
      );
    case "address-of":
      return svg(
        box(6, "0xc000012080", `&${name}`, "a pointer to it", "ptr") + arrow + box(204, "…", name, "lives at 0xc000012080", "val"),
      );
    case "deref":
      return svg(
        box(6, "0xc000012080", name, "a pointer", "ptr") + arrow + box(204, `*${name}`, "what it points at", "read / written here", "val hot"),
      );
    case "send":
      return svg(
        `<rect x="6" y="20" width="96" height="40" rx="7" class="val"/><text x="54" y="45" class="lens-d-val">value</text>` +
          `<path class="lens-d-arrow" d="M104 40 H 170" marker-end="url(#lensHead)"/>` +
          `<rect x="174" y="18" width="150" height="44" rx="22" class="chan"/><text x="249" y="45" class="lens-d-val">${name}</text>` +
          `<text x="165" y="80" class="lens-d-sub">arrow points INTO the channel</text>`,
      );
    case "recv":
      return svg(
        `<rect x="6" y="18" width="150" height="44" rx="22" class="chan"/><text x="81" y="45" class="lens-d-val">${name}</text>` +
          `<path class="lens-d-arrow" d="M158 40 H 224" marker-end="url(#lensHead)"/>` +
          `<rect x="228" y="20" width="96" height="40" rx="7" class="val"/><text x="276" y="45" class="lens-d-val">value</text>` +
          `<text x="165" y="80" class="lens-d-sub">arrow points OUT of the channel</text>`,
      );
  }
}
