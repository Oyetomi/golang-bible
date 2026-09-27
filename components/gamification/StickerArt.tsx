"use client";

import { useId, type ReactElement } from "react";
import type { Motif, Rarity, Sticker } from "@/lib/stickers";

/* Die-cut sticker illustrations, all SVG so they stay crisp at any size and
   share one style: a gradient body, a white die-cut edge, a bold white motif
   and a gloss. Shape follows rarity (round → scalloped → starburst), and the
   top two rarities carry a moving holographic foil. */

const C = 60; // centre of the 120×120 artboard

function polar(r: number, a: number): [number, number] {
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function scallopPath(r = 46, bumps = 12, depth = 5) {
  let d = "";
  const steps = bumps * 16;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const [x, y] = polar(r + depth * Math.cos(a * bumps), a);
    d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

function burstPath(outer = 53, inner = 43, points = 12) {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const [x, y] = polar(i % 2 ? inner : outer, a);
    d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

const SHAPES: Record<Rarity, ReactElement> = {
  common: <circle cx={C} cy={C} r={49} />,
  rare: <path d={scallopPath()} />,
  legendary: <path d={burstPath()} />,
  iconic: <path d={burstPath(54, 45, 16)} />,
};

type MotifProps = { w: string; d: string };

/* Motifs are drawn on a 48×48 grid. `w` is the white, `d` the detail colour. */
const MOTIFS: Record<Motif, (p: MotifProps) => ReactElement> = {
  spark: ({ w }) => (
    <>
      <path fill={w} d="M22 4c1.6 11 8.4 17.8 19.5 19.5C30.4 25.2 23.6 32 22 43 20.4 32 13.6 25.2 2.5 23.5 13.6 21.8 20.4 15 22 4z" />
      <path fill={w} d="M39 3c.6 4 3 6.4 7 7-4 .6-6.4 3-7 7-.6-4-3-6.4-7-7 4-.6 6.4-3 7-7z" />
    </>
  ),
  bolt: ({ w }) => <path fill={w} d="M28 3L9 27h13l-4 18 21-26H26z" />,
  cap: ({ w, d }) => (
    <>
      <path fill={w} d="M24 8L2 18l22 10 22-10z" />
      <path fill={w} d="M11 23v9c0 4 6 7 13 7s13-3 13-7v-9l-13 6z" />
      <path fill={d} opacity=".35" d="M11 23l13 6 13-6v3l-13 6-13-6z" />
      <path stroke={w} strokeWidth="2.5" strokeLinecap="round" d="M42 20v12" />
      <circle cx="42" cy="34" r="2.6" fill={w} />
    </>
  ),
  bug: ({ w, d }) => (
    <>
      <circle cx="24" cy="11" r="6.5" fill={d} />
      <ellipse cx="24" cy="28" rx="15" ry="15.5" fill={w} />
      <path stroke={d} strokeWidth="2.4" d="M24 13v30" />
      <circle cx="17" cy="23" r="3.2" fill={d} />
      <circle cx="31" cy="23" r="3.2" fill={d} />
      <circle cx="16" cy="33" r="2.6" fill={d} />
      <circle cx="32" cy="33" r="2.6" fill={d} />
      <path stroke={d} strokeWidth="2" strokeLinecap="round" d="M20 6l-3-3M28 6l3-3" />
    </>
  ),
  flag: ({ w, d }) => (
    <>
      <path stroke={w} strokeWidth="4" strokeLinecap="round" d="M10 5v39" />
      <path fill={w} d="M12 6c8-4 14 4 22 0s8-2 8-2v20s-2-2-8 1-14-4-22 0z" />
      <path fill={d} opacity=".45" d="M19 9h6v6h-6zM31 8h5v6h-5zM25 15h6v6h-6zM19 21h6v4.5h-6z" />
    </>
  ),
  pipe: ({ w, d }) => (
    <>
      <rect x="3" y="17" width="42" height="14" rx="7" fill={w} />
      <circle cx="13" cy="24" r="4" fill={d} />
      <circle cx="24" cy="24" r="4" fill={d} opacity=".7" />
      <circle cx="35" cy="24" r="4" fill={d} opacity=".45" />
      <path fill={w} d="M36 6l10 8-10 8zM12 26l-10 8 10 8z" opacity=".95" />
    </>
  ),
  checker: ({ w, d }) => (
    <>
      <rect x="6" y="6" width="36" height="36" rx="5" fill={w} />
      <path fill={d} d="M6 11a5 5 0 0 1 5-5h4v9H6zM24 6h9v9h-9zM15 15h9v9h-9zM33 15h9v9h-9zM6 24h9v9H6zM24 24h9v9h-9zM15 33h9v9h-9zM33 33h9v4a5 5 0 0 1-5 5h-4z" />
    </>
  ),
  hexagon: ({ w, d }) => (
    <>
      <path fill={w} d="M24 3l18.2 10.5v21L24 45 5.8 34.5v-21z" />
      <path fill={d} opacity=".85" d="M24 15l7.8 4.5v9L24 33l-7.8-4.5v-9z" />
      <path stroke={d} strokeWidth="2" opacity=".4" d="M24 3v12M42.2 13.5l-10.4 6M42.2 34.5l-10.4-6M24 45V33M5.8 34.5l10.4-6M5.8 13.5l10.4 6" />
    </>
  ),
  crown: ({ w, d }) => (
    <>
      <path fill={w} d="M5 36L8 13l9 10 7-15 7 15 9-10 3 23z" />
      <rect x="5" y="36" width="38" height="6" rx="2" fill={w} />
      <circle cx="24" cy="28" r="3" fill={d} />
      <circle cx="14" cy="30" r="2.2" fill={d} opacity=".7" />
      <circle cx="34" cy="30" r="2.2" fill={d} opacity=".7" />
    </>
  ),
  zero: ({ w, d }) => (
    <>
      <ellipse cx="24" cy="24" rx="15" ry="20" fill="none" stroke={w} strokeWidth="7" />
      <path stroke={d} strokeWidth="3.5" strokeLinecap="round" d="M15 36L33 12" />
      <path stroke={w} strokeWidth="2.5" strokeLinecap="round" d="M42 6l3-3M44 12h3" />
    </>
  ),
  chip: ({ w, d }) => (
    <>
      <path stroke={w} strokeWidth="3" strokeLinecap="round" d="M16 3v6M24 3v6M32 3v6M16 39v6M24 39v6M32 39v6M3 16h6M3 24h6M3 32h6M39 16h6M39 24h6M39 32h6" />
      <rect x="9" y="9" width="30" height="30" rx="5" fill={w} />
      <path fill="none" stroke={d} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M17 19l-4 5 4 5M31 19l4 5-4 5M26 17l-4 14" />
    </>
  ),
  flask: ({ w, d }) => (
    <>
      <path fill={w} d="M17 4h14v3h-2v10l12 20c2 3.5-.5 7-4.5 7h-25C7.5 44 5 40.5 7 37l12-20V7h-2z" />
      <path fill={d} opacity=".55" d="M12.5 30h23l4 7c1 1.8-.3 3.5-2.3 3.5H10.8c-2 0-3.3-1.7-2.3-3.5z" />
      <circle cx="20" cy="35" r="2" fill={w} />
      <circle cx="28" cy="33" r="1.4" fill={w} />
    </>
  ),
  flame: ({ w, d }) => (
    <>
      <path fill={w} d="M24 3c3 8 13 13 13 25 0 9-6 16-13 16S11 37 11 28c0-6 3-9 5-11 0 4 2 7 4 7 0-9 1-15 4-21z" />
      <path fill={d} opacity=".6" d="M24 25c2 4 6 6 6 11 0 4-3 6.5-6 6.5s-6-2.5-6-6.5c0-3 2-4 3-5 .3 2 1 3 2 3 0-3 .3-6 1-9z" />
    </>
  ),
  rocket: ({ w, d }) => (
    <>
      <path fill={w} d="M24 2c8 6 11 15 11 24v8H13v-8c0-9 3-18 11-24z" />
      <circle cx="24" cy="18" r="4.5" fill={d} />
      <path fill={w} d="M13 24l-7 9v6l7-3zM35 24l7 9v6l-7-3z" />
      <path fill={d} opacity=".7" d="M18 34h12l-2 6-4 6-4-6z" />
    </>
  ),
  moon: ({ w, d }) => (
    <>
      <path fill={w} d="M30 6a18 18 0 1 0 12 30A15 15 0 0 1 30 6z" />
      <circle cx="17" cy="27" r="3" fill={d} opacity=".35" />
      <circle cx="24" cy="36" r="2" fill={d} opacity=".35" />
      <path fill={w} d="M38 4c.5 3 2 4.5 5 5-3 .5-4.5 2-5 5-.5-3-2-4.5-5-5 3-.5 4.5-2 5-5z" />
    </>
  ),
  compass: ({ w, d }) => (
    <>
      <circle cx="24" cy="24" r="20" fill={w} />
      <circle cx="24" cy="24" r="15" fill="none" stroke={d} strokeWidth="1.5" opacity=".35" />
      <path fill={d} d="M24 9l5 15h-10z" />
      <path fill={d} opacity=".4" d="M24 39l-5-15h10z" />
      <circle cx="24" cy="24" r="2.5" fill={w} />
    </>
  ),
  book: ({ w, d }) => (
    <>
      <path fill={w} d="M3 11c7-3 14-3 21 1 7-4 14-4 21-1v29c-7-3-14-3-21 1-7-4-14-4-21-1z" />
      <path stroke={d} strokeWidth="2.2" d="M24 12v29" />
      <path stroke={d} strokeWidth="1.8" strokeLinecap="round" opacity=".4" d="M8 18c4-1.2 8-1.2 12 0M8 24c4-1.2 8-1.2 12 0M8 30c4-1.2 8-1.2 12 0M28 18c4-1.2 8-1.2 12 0M28 24c4-1.2 8-1.2 12 0M28 30c4-1.2 8-1.2 12 0" />
    </>
  ),
  gopher: ({ w, d }) => (
    <>
      <circle cx="10" cy="9" r="5" fill={w} />
      <circle cx="38" cy="9" r="5" fill={w} />
      <path fill={w} d="M6 46c0-26 4-38 18-38s18 12 18 38z" />
      <circle cx="17" cy="21" r="6.5" fill={d} opacity=".18" />
      <circle cx="31" cy="21" r="6.5" fill={d} opacity=".18" />
      <circle cx="18.5" cy="21.5" r="3.2" fill={d} />
      <circle cx="32.5" cy="21.5" r="3.2" fill={d} />
      <ellipse cx="24" cy="30" rx="4.5" ry="3" fill={d} opacity=".3" />
      <ellipse cx="24" cy="28.6" rx="1.8" ry="1.3" fill={d} />
      <path fill={d} opacity=".5" d="M22.3 32.5h1.5v3h-1.5zM24.2 32.5h1.5v3h-1.5z" />
    </>
  ),
  prompt: ({ w, d }) => (
    <>
      <rect x="3" y="7" width="42" height="34" rx="6" fill={w} />
      <path fill={d} opacity=".25" d="M3 13a6 6 0 0 1 6-6h30a6 6 0 0 1 6 6v1H3z" />
      <path fill="none" stroke={d} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" d="M11 21l7 5.5-7 5.5" />
      <path stroke={d} strokeWidth="3.6" strokeLinecap="round" d="M22 33h12" />
    </>
  ),
  headphones: ({ w, d }) => (
    <>
      <path fill="none" stroke={w} strokeWidth="5" strokeLinecap="round" d="M8 30v-6a16 16 0 0 1 32 0v6" />
      <rect x="4" y="27" width="11" height="17" rx="4" fill={w} />
      <rect x="33" y="27" width="11" height="17" rx="4" fill={w} />
      <path stroke={d} strokeWidth="2" strokeLinecap="round" opacity=".45" d="M9.5 32v7M38.5 32v7" />
    </>
  ),
};

export function StickerArt({
  sticker,
  locked = false,
  size,
  className = "",
  title,
}: {
  sticker: Sticker;
  locked?: boolean;
  size?: number;
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const shape = SHAPES[sticker.rarity];
  const Motif = MOTIFS[sticker.motif];
  const shiny = !locked && (sticker.rarity === "legendary" || sticker.rarity === "iconic");

  return (
    <span
      className={`sticker ${locked ? "locked" : ""} ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <svg className="sticker-svg" viewBox="0 0 120 120" role="img" aria-label={title}>
        <defs>
          <linearGradient id={`g-${uid}`} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor={sticker.from} />
            <stop offset="1" stopColor={sticker.to} />
          </linearGradient>
          <radialGradient id={`h-${uid}`} cx="0.3" cy="0.2" r="0.7">
            <stop offset="0" stopColor="#fff" stopOpacity=".55" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`f-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7de3ff" stopOpacity="0" />
            <stop offset="0.35" stopColor="#ffe28a" stopOpacity=".9" />
            <stop offset="0.5" stopColor="#9ef0ff" stopOpacity=".95" />
            <stop offset="0.65" stopColor="#c9a2ff" stopOpacity=".9" />
            <stop offset="1" stopColor="#7de3ff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`c-${uid}`}>{shape}</clipPath>
        </defs>

        {/* die-cut edge */}
        <g
          fill={locked ? "var(--sticker-slot)" : "#fff"}
          stroke={locked ? "var(--sticker-slot-line)" : "#fff"}
          strokeWidth={locked ? 2 : 12}
          strokeLinejoin="round"
          strokeDasharray={locked ? "5 5" : undefined}
        >
          {shape}
        </g>

        {/* body */}
        {!locked && <g fill={`url(#g-${uid})`}>{shape}</g>}

        {/* motif */}
        <g transform="translate(33 31) scale(1.13)" opacity={locked ? 0.4 : 1}>
          <Motif
            w={locked ? "var(--sticker-ghost)" : "#fff"}
            d={locked ? "var(--sticker-ghost)" : sticker.to}
          />
        </g>

        {/* gloss + foil */}
        {!locked && (
          <g clipPath={`url(#c-${uid})`}>
            <rect x="0" y="0" width="120" height="120" fill={`url(#h-${uid})`} />
            {shiny && (
              <rect className="sticker-foil" x="-30" y="-20" width="80" height="160" fill={`url(#f-${uid})`} />
            )}
          </g>
        )}
      </svg>
    </span>
  );
}
