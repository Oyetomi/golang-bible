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

interface BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PlayerProfile;
}

type FilterTab = "all" | "unlocked" | "locked";

function BadgeIcon({ id, unlocked }: { id: BadgeId; unlocked: boolean }) {
  const color = unlocked ? "#f5b13d" : "#71717a";

  switch (id) {
    case "first_code":
    case "playground_hacker":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case "quick_thinker":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      );
    case "quiz_master":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case "lab_novice":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      );
    case "lab_veteran":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H7v2h10v-2h-2c-.55 0-1-.45-1-1v-2.34" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      );
    case "channel_surfer":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 5h18" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 19H3" />
        </svg>
      );
    case "race_slayer":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      );
    case "ddd_architect":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
    case "consensus_king":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      );
    case "zero_alloc_titan":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "ebpf_warlock":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" />
          <line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" />
          <line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" />
          <line x1="20" y1="14" x2="23" y2="14" />
          <line x1="1" y1="9" x2="4" y2="9" />
          <line x1="1" y1="14" x2="4" y2="14" />
        </svg>
      );
    case "wasm_alchemist":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "streak_3":
    case "streak_7":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
      );
    case "night_owl":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case "explorer_10":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case "scholar_50":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case "master_100":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
        </svg>
      );
    case "sound_enthusiast":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    default:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="6" />
          <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
        </svg>
      );
  }
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
                    <BadgeIcon id={b.id} unlocked={b.unlocked} />
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
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline-block", marginRight: "3px", verticalAlign: "middle" }}>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Locked
                      </span>
                    )}
                  </div>
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
