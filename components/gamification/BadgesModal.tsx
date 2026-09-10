"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeId,
  BadgeProgress,
  getAllBadgesWithProgress,
  PlayerProfile,
} from "@/lib/gamification";
import { triggerConfetti } from "@/lib/confetti";
import { playClick, playSuccess } from "@/lib/sound";
import { Gopher, type GopherRole, type GopherPose } from "@/components/course/Gopher";

interface BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PlayerProfile;
}

type FilterTab = "all" | "unlocked" | "locked";

/** Every achievement wears one of the course's gopher roles, so the cast a
 *  reader met in the chapters is the same cast on the badge wall. Locked
 *  badges render the same gopher desaturated rather than a different mark, so
 *  you can see what you are working toward. */
const BADGE_GOPHER: Record<BadgeId, { role: GopherRole; pose: GopherPose }> = {
  first_code: { role: "hacker", pose: "happy" },
  playground_hacker: { role: "mechanic", pose: "run" },
  quick_thinker: { role: "scholar", pose: "happy" },
  quiz_master: { role: "analyst", pose: "wave" },
  lab_novice: { role: "detective", pose: "idle" },
  lab_veteran: { role: "runner", pose: "run" },
  channel_surfer: { role: "courier", pose: "carry" },
  race_slayer: { role: "locksmith", pose: "happy" },
  ddd_architect: { role: "architect", pose: "idle" },
  consensus_king: { role: "leader", pose: "wave" },
  zero_alloc_titan: { role: "alchemist", pose: "happy" },
  ebpf_warlock: { role: "kernel", pose: "idle" },
  wasm_alchemist: { role: "smith", pose: "idle" },
  streak_3: { role: "timekeeper", pose: "happy" },
  streak_7: { role: "worker", pose: "run" },
  night_owl: { role: "hacker", pose: "sleep" },
  explorer_10: { role: "pilot", pose: "run" },
  scholar_50: { role: "scribe", pose: "idle" },
  master_100: { role: "captain", pose: "wave" },
  sound_enthusiast: { role: "operator", pose: "happy" },
};

function BadgeIcon({ id, title, unlocked }: { id: BadgeId; title: string; unlocked: boolean }) {
  const cast = BADGE_GOPHER[id];
  return (
    <span className={`gb-badge-gopher ${unlocked ? "is-unlocked" : "is-locked"}`}>
      <Gopher
        role={cast.role}
        pose={cast.pose}
        state={unlocked ? "done" : "idle"}
        size={40}
        // Without this the label reads "gopher (hacker)", which tells a screen
        // reader nothing about the achievement it is sitting on.
        title={`${title} — ${unlocked ? "unlocked" : "locked"}`}
      />
    </span>
  );
}

export function BadgesModal({ isOpen, onClose, profile }: BadgesModalProps) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const allBadges = useMemo(() => {
    return getAllBadgesWithProgress(profile);
  }, [profile]);

  const unlockedCount = useMemo(() => {
    return allBadges.filter((b) => b.unlocked).length;
  }, [allBadges]);

  const totalBadges = allBadges.length;
  const completionPct = Math.round((unlockedCount / totalBadges) * 100);

  const displayedBadges = useMemo(() => {
    if (filter === "unlocked") return allBadges.filter((b) => b.unlocked);
    if (filter === "locked") return allBadges.filter((b) => !b.unlocked);
    return allBadges;
  }, [allBadges, filter]);

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCelebrate = (badge: BadgeProgress, e: React.MouseEvent) => {
    e.stopPropagation();
    playSuccess();
    const rect = e.currentTarget.getBoundingClientRect();
    triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, 60);
  };

  return (
    <div
      className="gb-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="badges-modal-title"
    >
      <div
        className="gb-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="gb-modal-header">
          <div className="gb-modal-title-wrap">
            <span className="gb-modal-trophy">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="6" />
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
              </svg>
            </span>
            <div>
              <h2 id="badges-modal-title" className="gb-modal-title">
                Curriculum Achievements
              </h2>
              <p className="gb-modal-sub">
                {unlockedCount} of {totalBadges} Unlocked ({completionPct}%)
              </p>
            </div>
          </div>
          <button
            className="gb-modal-close"
            onClick={() => {
              playClick();
              onClose();
            }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Global Progress Bar */}
        <div className="gb-modal-overall-track">
          <div
            className="gb-modal-overall-fill"
            style={{ width: `${completionPct}%` }}
          />
        </div>

        {/* Filter Tabs */}
        <div className="gb-modal-tabs" role="tablist">
          <button
            className={`gb-modal-tab ${filter === "all" ? "active" : ""}`}
            onClick={() => {
              playClick();
              setFilter("all");
            }}
            type="button"
          >
            All <span className="gb-tab-count">{totalBadges}</span>
          </button>
          <button
            className={`gb-modal-tab ${filter === "unlocked" ? "active" : ""}`}
            onClick={() => {
              playClick();
              setFilter("unlocked");
            }}
            type="button"
          >
            Unlocked <span className="gb-tab-count">{unlockedCount}</span>
          </button>
          <button
            className={`gb-modal-tab ${filter === "locked" ? "active" : ""}`}
            onClick={() => {
              playClick();
              setFilter("locked");
            }}
            type="button"
          >
            Locked <span className="gb-tab-count">{totalBadges - unlockedCount}</span>
          </button>
        </div>

        {/* Badges Grid */}
        <div className="gb-modal-grid">
          {displayedBadges.map((b) => {
            const progressRatio = Math.min(1, b.currentProgress / b.maxProgress);
            const progressPercent = Math.round(progressRatio * 100);

            return (
              <div
                key={b.id}
                className={`gb-badge-card ${b.unlocked ? "unlocked" : "locked"}`}
              >
                <div className="gb-badge-card-top">
                  <div className="gb-badge-icon-box">
                    <BadgeIcon id={b.id} title={b.title} unlocked={b.unlocked} />
                    {b.unlocked && <span className="gb-badge-check">✓</span>}
                  </div>
                  <div className="gb-badge-status-wrap">
                    {b.unlocked ? (
                      <button
                        className="gb-badge-unlocked-pill"
                        onClick={(e) => handleCelebrate(b, e)}
                        title="Click to celebrate!"
                        type="button"
                      >
                        ✓ Unlocked
                      </button>
                    ) : (
                      <span className="gb-badge-locked-pill">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline-block", marginRight: "4px", verticalAlign: "middle" }}>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Locked
                      </span>
                    )}
                  </div>
                </div>

                <div className="gb-badge-cat-tag">
                  {b.category.toUpperCase()}
                </div>

                <h3 className="gb-badge-name">{b.title}</h3>
                <p className="gb-badge-desc">{b.description}</p>

                {/* Progress bar for multi-step or locked items */}
                <div className="gb-badge-progress-wrap">
                  <div className="gb-badge-progress-text">
                    <span>{b.unlocked ? "Completed" : "Progress"}</span>
                    <span>
                      {b.currentProgress} / {b.maxProgress}
                    </span>
                  </div>
                  <div className="gb-badge-progress-track">
                    <div
                      className="gb-badge-progress-fill"
                      style={{ width: `${b.unlocked ? 100 : progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="gb-modal-footer">
          <span className="gb-modal-footer-tip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline-block", marginRight: "6px", verticalAlign: "middle" }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Complete QuickChecks, Labs, and Sandboxes to earn XP and unlock badges!
          </span>
          <button
            className="gb-modal-done-btn"
            onClick={() => {
              playClick();
              onClose();
            }}
            type="button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
