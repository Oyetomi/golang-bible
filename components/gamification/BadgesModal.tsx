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
          >
            All <span className="gb-tab-count">{totalBadges}</span>
          </button>
          <button
            className={`gb-modal-tab ${filter === "unlocked" ? "active" : ""}`}
            onClick={() => {
              playClick();
              setFilter("unlocked");
            }}
          >
            Unlocked <span className="gb-tab-count">{unlockedCount}</span>
          </button>
          <button
            className={`gb-modal-tab ${filter === "locked" ? "active" : ""}`}
            onClick={() => {
              playClick();
              setFilter("locked");
            }}
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
                    <span className="gb-badge-emoji">{b.icon}</span>
                    {b.unlocked && <span className="gb-badge-check">✓</span>}
                  </div>
                  <div className="gb-badge-status-wrap">
                    {b.unlocked ? (
                      <button
                        className="gb-badge-unlocked-pill"
                        onClick={(e) => handleCelebrate(b, e)}
                        title="Click to celebrate!"
                      >
                        ✓ Unlocked 🎉
                      </button>
                    ) : (
                      <span className="gb-badge-locked-pill">🔒 Locked</span>
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
          <span>
            💡 Complete QuickChecks, Labs, and Sandboxes to earn XP and unlock badges!
          </span>
          <button
            className="gb-modal-done-btn"
            onClick={() => {
              playClick();
              onClose();
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
