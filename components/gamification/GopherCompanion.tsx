"use client";

import { useEffect, useRef, useState } from "react";
import { Gopher, GopherPose, GopherRole } from "@/components/course/Gopher";
import { playClick, playStreak, playSuccess } from "@/lib/sound";
import { triggerConfetti } from "@/lib/confetti";
import { BadgeDefinition } from "@/lib/gamification";

const GO_WISDOM_TIPS = [
  "Do not communicate by sharing memory; instead, share memory by communicating.",
  "Channels orchestrate; sync.Mutex serializes.",
  "Clear is better than clever. Keep your functions short and explicit.",
  "Always pass context.Context as the first argument in I/O operations.",
  "A receive on a closed channel produces the zero value without blocking.",
  "sync.Once guarantees thread-safe one-time initialization with zero lock contention on hot paths.",
  "In Go, interfaces are satisfied implicitly — you don't declare 'implements'.",
  "Use errgroup.WithContext to bound concurrent tasks and propagate errors safely.",
  "Zero-allocation tip: Reslice existing backing arrays instead of reallocating in tight loops.",
  "Avoid naked returns in non-trivial functions to keep code readable.",
  "goroutines cost only ~2KB to start — millions can run concurrently on modern hardware.",
  "A nil channel blocks forever on send and receive. Useful in multi-way select disabling!",
  "Always close channels from the sender side, never from the receiver side.",
  "Use sync.Pool to reduce garbage collection pause times for high-throughput allocs.",
  "atomic.Int64 gives lock-free increment operations with hardware CPU primitives.",
];

export function GopherCompanion() {
  const [tipIndex, setTipIndex] = useState(0);
  const [speech, setSpeech] = useState<string>(GO_WISDOM_TIPS[0]);
  const [speechVisible, setSpeechVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [pose, setPose] = useState<GopherPose>("idle");
  const [role, setRole] = useState<GopherRole>("scientist");

  const bubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTemporarySpeech = (text: string, newPose: GopherPose = "happy", durationMs: number = 5000) => {
    setSpeech(text);
    setSpeechVisible(true);
    setPose(newPose);

    if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
    bubbleTimeoutRef.current = setTimeout(() => {
      setSpeechVisible(false);
      setPose("idle");
    }, durationMs);
  };

  useEffect(() => {
    // Listen to gamification events
    const handleXpGain = (e: CustomEvent<{ amount: number; reason: string }>) => {
      const { amount, reason } = e.detail || {};
      const phrases = [
        `+${amount} XP: ${reason || "mastering Go"}`,
        `+${amount} XP earned. Keep advancing through the curriculum.`,
        `Concept verified. +${amount} XP added to your profile.`,
      ];
      showTemporarySpeech(phrases[Math.floor(Math.random() * phrases.length)], "happy", 4000);
    };

    const handleLevelUp = (e: CustomEvent<{ level: number; title: string }>) => {
      const { level, title } = e.detail || {};
      showTemporarySpeech(
        `LEVEL UP: You reached Level ${level} (${title}).`,
        "happy",
        6000
      );
      setRole("leader");
    };

    const handleBadgeUnlock = (e: CustomEvent<BadgeDefinition>) => {
      const badge = e.detail;
      showTemporarySpeech(
        `Achievement Unlocked: [${badge.title}] — ${badge.description}`,
        "wave",
        6000
      );
    };

    window.addEventListener("gb:xp-gain", handleXpGain as EventListener);
    window.addEventListener("gb:levelup", handleLevelUp as EventListener);
    window.addEventListener("gb:badge-unlock", handleBadgeUnlock as EventListener);

    return () => {
      window.removeEventListener("gb:xp-gain", handleXpGain as EventListener);
      window.removeEventListener("gb:levelup", handleLevelUp as EventListener);
      window.removeEventListener("gb:badge-unlock", handleBadgeUnlock as EventListener);
      if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
    };
  }, []);

  const handleGopherClick = () => {
    playClick();
    const nextIdx = (tipIndex + 1) % GO_WISDOM_TIPS.length;
    setTipIndex(nextIdx);

    const rolesList: GopherRole[] = ["scientist", "architect", "leader", "kernel", "runner", "locksmith"];
    setRole(rolesList[nextIdx % rolesList.length]);

    showTemporarySpeech(GO_WISDOM_TIPS[nextIdx], "wave", 6000);
  };

  const handleCheer = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSuccess();
    triggerConfetti(window.innerWidth - 120, window.innerHeight - 100, 50);
    showTemporarySpeech("Let's build clean, high-concurrency Go systems.", "happy", 4000);
  };

  if (minimized) {
    return (
      <div className="gb-companion-minimized" onClick={() => setMinimized(false)}>
        <button className="gb-companion-restore-btn" title="Open Gopher Companion">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <aside className="gb-companion-widget" aria-label="Gopher Companion">
      {/* Speech Bubble */}
      {speechVisible && (
        <div className="gb-speech-bubble" role="status">
          <button
            className="gb-speech-close"
            onClick={() => setSpeechVisible(false)}
            aria-label="Dismiss tip"
          >
            ✕
          </button>
          <div className="gb-speech-content">
            <span className="gb-speech-kicker">Gopher Wisdom</span>
            <p className="gb-speech-text">{speech}</p>
          </div>
          <div className="gb-speech-actions">
            <button className="gb-speech-next-btn" onClick={handleGopherClick}>
              Next tip
            </button>
            <button className="gb-speech-cheer-btn" onClick={handleCheer}>
              Cheer
            </button>
          </div>
          <div className="gb-speech-arrow" />
        </div>
      )}

      {/* Mascot Box */}
      <div className="gb-gopher-avatar-box">
        <button
          className="gb-companion-minimize-btn"
          onClick={() => setMinimized(true)}
          title="Minimize Gopher"
          aria-label="Minimize companion"
        >
          _
        </button>
        <button
          className="gb-gopher-char-btn"
          onClick={handleGopherClick}
          title="Click Gopher for Go tips & wisdom"
          aria-label="Click for Go tip"
        >
          <Gopher
            pose={pose}
            role={role}
            size={52}
            title="The Go Bible Companion"
          />
        </button>
      </div>
    </aside>
  );
}
