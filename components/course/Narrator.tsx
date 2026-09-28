import type { ReactNode } from "react";
import { Gopher } from "./Gopher";

/* Narrator — the book's instructor speaks. A caped gopher, a name tag and
   the line itself, set apart from the teaching so the voice never gets in
   the way of the facts. Moods: smug (the smile), menacing (the eyes),
   sincere (rare, and unsettling). */
export function Narrator({
  mood = "smug",
  children,
}: {
  mood?: "smug" | "menacing" | "sincere";
  children: ReactNode;
}) {
  return (
    <aside className={`nar nar-${mood}`}>
      <span className="nar-who">
        <Gopher role="supe" pose={mood === "smug" ? "happy" : "idle"} state={mood === "menacing" ? "bad" : "active"} size={56} title="your instructor" />
      </span>
      <div className="nar-body">
        <span className="nar-name">Your instructor</span>
        <div className="nar-line">{children}</div>
      </div>
    </aside>
  );
}
