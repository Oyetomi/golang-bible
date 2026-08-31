"use client";

import { useState, type ReactNode } from "react";
import { Gopher, type GopherRole } from "./Gopher";

/* ─────────────────────────────────────────────────────────────
   ELI5 & MentalModel components for Go concepts.
   Translates complex concurrency, memory management, and
   systems programming paradigms into intuitive, plain-English
   metaphors and visual analogies.
   ───────────────────────────────────────────────────────────── */

export type MentalModelPreset =
  | "goroutine"
  | "channel"
  | "mutex"
  | "pointer"
  | "slice"
  | "interface"
  | "context"
  | "waitgroup"
  | "gc"
  | "map";

interface PresetData {
  concept: string;
  metaphor: string;
  icon: string;
  role: GopherRole;
  analogy: string;
  realWorld: string;
  goCode: string;
  takeaway: string;
}

const PRESETS: Record<MentalModelPreset, PresetData> = {
  goroutine: {
    concept: "Goroutines",
    metaphor: "Coffee Baristas in a busy café",
    icon: "[GO]",
    role: "worker",
    analogy:
      "Think of OS threads as giant, expensive espresso machines, and goroutines as swift baristas. One machine can keep dozens of baristas working concurrently by switching whenever someone waits for milk to steam or water to heat.",
    realWorld:
      "A single café counter with 4 machines (CPU cores) serving 1,000 customers smoothly by pausing inactive tasks.",
    goCode:
      "go makeEspresso() starts a 2KB lightweight task scheduled cooperatively by Go's runtime scheduler (GMP).",
    takeaway:
      "Goroutines are ultra-cheap user-space threads (2KB initial stack) managed by Go's runtime, not heavy 2MB OS threads.",
  },
  channel: {
    concept: "Channels",
    metaphor: "Pneumatic Conveyor Belt with Safety Gates",
    icon: "[CHAN]",
    role: "courier",
    analogy:
      "A channel is a conveyor belt between two workers. With an unbuffered channel, the sender holds the package on the belt until the receiver physically takes it. With a buffered channel, the belt has storage buckets where items can rest.",
    realWorld:
      "Handing a baton in a relay race (unbuffered) vs dropping letters into a mailbox slot with 10 slots (buffered).",
    goCode:
      "ch <- val blocks until someone executes <-ch (unbuffered), preventing race conditions without raw locks.",
    takeaway:
      "“Do not communicate by sharing memory; instead, share memory by communicating.”",
  },
  mutex: {
    concept: "sync.Mutex",
    metaphor: "Single-Occupancy Restroom Key",
    icon: "[LOCK]",
    role: "locksmith",
    analogy:
      "There is only one physical key hanging behind the counter. To enter the restroom (critical section), you take the key. Everyone else must wait in line. When you finish, you must return the key so the next person can enter.",
    realWorld:
      "Only one person in the fitting room at a time. The next person waits outside until the door opens.",
    goCode:
      "mu.Lock() claims exclusive access; defer mu.Unlock() guarantees the key is returned even if the function panics.",
    takeaway:
      "Always lock right before reading/writing shared memory, and immediately defer mu.Unlock() to avoid deadlocks.",
  },
  pointer: {
    concept: "Pointers (*T and &x)",
    metaphor: "Live Google Doc URL vs Printed Paper Photocopy",
    icon: "[PTR]",
    role: "scholar",
    analogy:
      "Passing a value is printing a photocopy and handing it over—changes made on the copy do not affect the original. Passing a pointer is sending a Google Doc link (&doc)—everyone with the link edits the exact same live document.",
    realWorld:
      "Giving someone your street address (&house) so they can visit and paint your door, rather than building a replica house.",
    goCode:
      "&x gets the memory address (the URL); *ptr dereferences the address (views/modifies the live value at that address).",
    takeaway:
      "Use pointers to mutate the original struct or avoid copying large memory buffers.",
  },
  slice: {
    concept: "Slices vs Arrays",
    metaphor: "A Sliding Viewfinder Window on a Filmstrip",
    icon: "[SLICE]",
    role: "scientist",
    analogy:
      "An array is a fixed physical strip of film. A slice is just a lightweight 3-part viewfinder holding: a pointer to the start of the window, the length (how many frames you see), and capacity (how far the strip extends).",
    realWorld:
      "Viewing photos through a crop window: moving the crop window or resizing it doesn't duplicate the photo.",
    goCode:
      "s[1:3] creates a new window header pointing to the same backing array. append() reallocates only when capacity is exceeded.",
    takeaway:
      "Slices are 24-byte headers (ptr, len, cap) referencing backing arrays. Watch out for shared mutations!",
  },
  interface: {
    concept: "Interfaces (Duck Typing)",
    metaphor: "Standard 3-Prong Power Outlet",
    icon: "[IFACE]",
    role: "operator",
    analogy:
      "A wall socket doesn't care whether you plug in a lamp, toaster, or laptop, as long as the prongs fit the slots. In Go, you never declare 'implements Interface'—if your struct has the matching methods, it fits automatically.",
    realWorld:
      "USB-C port accepts any device that speaks the USB protocol without needing a proprietary brand badge.",
    goCode:
      "type Reader interface { Read(p []byte) (n int, err error) } is implemented implicitly by any type having that method.",
    takeaway:
      "Implicit interfaces decouple callers from concrete implementations, making Go code modular and trivially mockable.",
  },
  context: {
    concept: "context.Context",
    metaphor: "Master Stop Wire Across a Construction Site",
    icon: "[CTX]",
    role: "medic",
    analogy:
      "A context is an emergency stop wire threaded through every sub-team on a job site. When the foreman pulls the wire (or a timer goes off), the cancel signal propagates down every branch so all workers drop their tools at once.",
    realWorld:
      "Canceling an Uber ride: the dispatch system alerts the driver, the payment gateway, and the map tracker simultaneously.",
    goCode:
      "ctx, cancel := context.WithTimeout(parent, 2*time.Second); select { case <-ctx.Done(): return ctx.Err() }",
    takeaway:
      "Always pass ctx as the 1st parameter to propagate cancellation, deadlines, and trace metadata across call trees.",
  },
  waitgroup: {
    concept: "sync.WaitGroup",
    metaphor: "Bus Driver's Passenger Tally Clicker",
    icon: "[WAIT]",
    role: "captain",
    analogy:
      "The tour bus driver clicks the counter +1 for every passenger departing on an excursion. Each passenger clicks -1 when getting back on the bus. The bus will not depart until the counter reaches exactly zero.",
    realWorld:
      "A teacher counting heads after recess before locking the school doors.",
    goCode:
      "wg.Add(n) before spawning; defer wg.Done() inside each goroutine; wg.Wait() blocks until the counter hits zero.",
    takeaway:
      "Always call wg.Add() in the parent goroutine BEFORE launching worker goroutines to avoid race conditions.",
  },
  gc: {
    concept: "Concurrent Tri-Color GC",
    metaphor: "Library Re-Shelving Staff Working While Readers Read",
    icon: "[GC]",
    role: "sweeper",
    analogy:
      "Instead of kicking all readers out and locking the library doors (Stop-The-World), librarians wear white/grey/black badges to sort books quietly in the background while visitors continue reading undisturbed.",
    realWorld:
      "Street cleaners sweeping sidewalks during normal city traffic with tiny sub-millisecond pauses.",
    goCode:
      "Go GC achieves sub-millisecond pauses using concurrent mark-and-sweep with write barriers.",
    takeaway:
      "Non-generational concurrent GC + escape analysis eliminates complex memory tuning in production.",
  },
  map: {
    concept: "Hash Maps (runtime.hmap)",
    metaphor: "Numbered Mail Sorting Boxes with Overflow Bins",
    icon: "[MAP]",
    role: "librarian",
    analogy:
      "A hash map is an array of 8-slot mail cubbies (buckets). A hash function turns your key into a bucket number. If more than 8 keys land in the same bucket, an overflow bin is chained underneath.",
    realWorld:
      "A post office sorting mail into numbered neighborhood bins: instant lookup by postal code.",
    goCode:
      "m[key] hashes the key, checks the top-hash byte array (tophash), and returns pointer to value (not thread-safe).",
    takeaway:
      "Go maps are NOT concurrent-safe. Concurrent read/write will crash the runtime with fatal error.",
  },
};

export function ELI5({
  title = "Explain Like I'm 5",
  concept,
  analogy,
  tag = "ELI5",
  icon = "💡",
  role,
  defaultOpen = true,
  children,
}: {
  title?: string;
  concept?: string;
  analogy?: string;
  tag?: string;
  icon?: string;
  role?: GopherRole;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`eli5-card ${isOpen ? "is-open" : "is-closed"}`}>
      <button
        type="button"
        className="eli5-head"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className="eli5-icon-wrap" aria-hidden>
          {role ? (
            <Gopher role={role} pose="happy" size={28} />
          ) : (
            <span className="eli5-icon">{icon}</span>
          )}
        </span>
        <div className="eli5-meta">
          <div className="eli5-tag-row">
            <span className="eli5-tag">{tag}</span>
            {concept && <span className="eli5-concept">{concept}</span>}
          </div>
          <span className="eli5-title">{title}</span>
        </div>
        <span className="eli5-toggle" aria-hidden>
          <svg
            className={`eli5-chevron ${isOpen ? "open" : ""}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="eli5-body">
          {analogy && (
            <div className="eli5-analogy">
              <span className="eli5-analogy-badge">In a nutshell</span>
              <p className="eli5-analogy-p">{analogy}</p>
            </div>
          )}
          <div className="eli5-content">{children}</div>
        </div>
      )}
    </div>
  );
}

export function MentalModel({
  preset,
  title,
  concept,
  metaphor,
  analogy,
  realWorld,
  goCode,
  takeaway,
  icon,
  role,
  children,
}: {
  preset?: MentalModelPreset;
  title?: string;
  concept?: string;
  metaphor?: string;
  analogy?: string;
  realWorld?: string;
  goCode?: string;
  takeaway?: string;
  icon?: string;
  role?: GopherRole;
  children?: ReactNode;
}) {
  const data = preset ? PRESETS[preset] : undefined;

  const displayTitle =
    title ?? (data ? `${data.concept}: ${data.metaphor}` : "Mental Model");
  const displayConcept = concept ?? data?.concept ?? "Go Concept";
  const displayMetaphor = metaphor ?? data?.metaphor;
  const displayAnalogy = analogy ?? data?.analogy;
  const displayRealWorld = realWorld ?? data?.realWorld;
  const displayGoCode = goCode ?? data?.goCode;
  const displayTakeaway = takeaway ?? data?.takeaway;
  const displayIcon = icon ?? data?.icon ?? "🧠";
  const displayRole = role ?? data?.role;

  return (
    <section className="mm-card">
      <div className="mm-head">
        <div className="mm-icon-box">
          {displayRole ? (
            <Gopher role={displayRole} pose="happy" size={36} />
          ) : (
            <span className="mm-icon" aria-hidden>
              {displayIcon}
            </span>
          )}
        </div>
        <div className="mm-head-text">
          <div className="mm-tags">
            <span className="mm-badge">Mental Model</span>
            <span className="mm-concept-tag">{displayConcept}</span>
          </div>
          <h3 className="mm-title">{displayTitle}</h3>
        </div>
      </div>

      {displayAnalogy && (
        <div className="mm-analogy">
          <div className="mm-analogy-label">
            <span className="mm-analogy-bulb">💡</span>
            <span>Real-World Metaphor:</span>
            {displayMetaphor && <strong>{displayMetaphor}</strong>}
          </div>
          <p className="mm-analogy-text">{displayAnalogy}</p>
        </div>
      )}

      {(displayRealWorld || displayGoCode) && (
        <div className="mm-split">
          {displayRealWorld && (
            <div className="mm-pane mm-realworld">
              <div className="mm-pane-head">
                <span className="mm-pane-tag mm-tag-world">Everyday Life</span>
              </div>
              <p className="mm-pane-text">{displayRealWorld}</p>
            </div>
          )}
          {displayGoCode && (
            <div className="mm-pane mm-gocode">
              <div className="mm-pane-head">
                <span className="mm-pane-tag mm-tag-code">
                  Under the Hood in Go
                </span>
              </div>
              <p className="mm-pane-text">{displayGoCode}</p>
            </div>
          )}
        </div>
      )}

      {children && <div className="mm-body">{children}</div>}

      {displayTakeaway && (
        <div className="mm-takeaway">
          <span className="mm-takeaway-star">★</span>
          <div className="mm-takeaway-content">
            <strong className="mm-takeaway-label">Key Intuition: </strong>
            <span>{displayTakeaway}</span>
          </div>
        </div>
      )}
    </section>
  );
}
