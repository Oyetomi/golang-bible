"use client";

import { useEffect, useState, useTransition } from "react";
import {
  calculateLevelInfo,
  getDefaultProfile,
  getProfile,
  PlayerProfile,
  toggleSound,
} from "@/lib/gamification";
import { playClick, playStreak } from "@/lib/sound";
import { BadgesModal } from "./BadgesModal";

interface XpToast {
  id: number;
  amount: number;
  reason: string;
}

export function GamificationHeader() {
  const [profile, setProfile] = useState<PlayerProfile>(getDefaultProfile());
  const [mounted, setMounted] = useState(false);
  const [isBadgesOpen, setIsBadgesOpen] = useState(false);
  const [xpToasts, setXpToasts] = useState<XpToast[]>([]);
  const [, startTransition] = useTransition();

  // Hydrate from localStorage once mounted
  useEffect(() => {
    setProfile(getProfile());
    setMounted(true);

    const handleProfileUpdate = (e: CustomEvent<PlayerProfile>) => {
      startTransition(() => {
        setProfile(e.detail || getProfile());
      });
    };

    const handleXpGain = (e: CustomEvent<{ amount: number; reason: string }>) => {
      const { amount, reason } = e.detail || {};
      if (amount > 0) {
        const id = Date.now() + Math.random();
        setXpToasts((prev) => [...prev.slice(-3), { id, amount, reason }]);
        setTimeout(() => {
          setXpToasts((prev) => prev.filter((t) => t.id !== id));
        }, 2200);
      }
    };

    window.addEventListener(
      "gb:gamification",
      handleProfileUpdate as EventListener
    );
    window.addEventListener("gb:xp-gain", handleXpGain as EventListener);

    return () => {
      window.removeEventListener(
        "gb:gamification",
        handleProfileUpdate as EventListener
      );
      window.removeEventListener("gb:xp-gain", handleXpGain as EventListener);
    };
  }, []);

  const levelInfo = calculateLevelInfo(profile.xp);
  const unlockedBadgesCount = Object.keys(profile.unlockedBadges || {}).length;

  const handleToggleSound = () => {
    const next = toggleSound();
    playClick();
    setProfile(getProfile());
  };

  const handleStreakClick = () => {
    playStreak();
  };

  if (!mounted) {
    // Return clean placeholder for SSR / hydration match
    return (
      <div className="gb-header-bar gb-header-placeholder">
        <div className="gb-header-inner">
          <div className="gb-level-badge">
            <span className="gb-level-num">Lv. 1</span>
            <span className="gb-level-title">Novice Gopher</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="gb-header-bar" role="region" aria-label="Player Stats">
        <div className="gb-header-inner">
          {/* Level & Title */}
          <div
            className="gb-level-pill"
            title={`Total XP: ${profile.xp.toLocaleString()} XP`}
          >
            <div className="gb-level-hexagon">
              <span className="gb-lv-text">LV</span>
              <span className="gb-lv-val">{levelInfo.level}</span>
            </div>
            <div className="gb-title-col">
              <span className="gb-player-title">{levelInfo.title}</span>
              <div className="gb-xp-meta">
                <span className="gb-xp-numbers">
                  {levelInfo.isMaxLevel ? (
                    "MAX LEVEL"
                  ) : (
                    <>
                      <strong>{levelInfo.currentXP}</strong> /{" "}
                      {levelInfo.xpNeededForNext} XP
                    </>
                  )}
                </span>
                <span className="gb-xp-pct">
                  {levelInfo.isMaxLevel ? "100%" : `${levelInfo.progressPct}%`}
                </span>
              </div>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div
            className="gb-xp-bar-container"
            title={`${levelInfo.currentXP} / ${levelInfo.xpNeededForNext} XP towards Level ${levelInfo.level + 1}`}
          >
            <div className="gb-xp-track">
              <div
                className="gb-xp-fill"
                style={{ width: `${levelInfo.progressPct}%` }}
              />
            </div>
          </div>

          {/* Floating XP Gain Toasts */}
          <div className="gb-xp-toast-anchor" aria-live="polite">
            {xpToasts.map((toast) => (
              <div key={toast.id} className="gb-xp-toast">
                <span className="gb-xp-toast-plus">+{toast.amount} XP</span>
                {toast.reason && (
                  <span className="gb-xp-toast-reason">{toast.reason}</span>
                )}
              </div>
            ))}
          </div>

          {/* Right Action Badges: Streak, Sound, Badges */}
          <div className="gb-header-actions">
            {/* Daily Streak */}
            <button
              className="gb-action-pill gb-streak-pill"
              onClick={handleStreakClick}
              title={`Daily Learning Streak: ${profile.streak} days.`}
              type="button"
            >
              <svg className="gb-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 23c6.075 0 11-4.925 11-11 0-4.045-2.185-7.581-5.46-9.516-.625-.37-.77-.962-.43-1.484.288-.444.82-.607 1.306-.402C20.697 1.574 22 3.633 22 6c0 1.105-.895 2-2 2-.553 0-1-.447-1-1 0-1.745-.98-3.26-2.427-4.027-.37-.196-.823-.058-1.026.31-.202.368-.066.83.303 1.028C17.27 5.064 18 6.452 18 8c0 3.314-2.686 6-6 6s-6-2.686-6-6c0-1.548.73-2.936 2.15-3.689.37-.198.505-.66.303-1.028-.203-.368-.656-.506-1.026-.31C5.98 3.74 5 5.255 5 7c0 .553-.447 1-1 1-1.105 0-2-.895-2-2 0-2.367 1.303-4.426 3.584-5.402.486-.205 1.018-.042 1.306.402.34.522.195 1.114-.43 1.484C3.185 4.419 1 7.955 1 12c0 6.075 4.925 11 11 11z" />
              </svg>
              <span className="gb-streak-count">{profile.streak}</span>
              <span className="gb-streak-label">day{profile.streak === 1 ? "" : "s"}</span>
            </button>

            {/* Badges Button */}
            <button
              className="gb-action-pill gb-badges-btn"
              onClick={() => {
                playClick();
                setIsBadgesOpen(true);
              }}
              title="Open Achievements Modal"
              type="button"
            >
              <svg className="gb-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="6" />
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
              </svg>
              <span className="gb-badge-count">{unlockedBadgesCount}/20</span>
              <span className="gb-badge-btn-label">Badges</span>
            </button>

            {/* Sound Toggle */}
            <button
              className={`gb-action-pill gb-sound-btn ${
                profile.soundEnabled ? "sound-on" : "sound-off"
              }`}
              onClick={handleToggleSound}
              aria-label={
                profile.soundEnabled ? "Mute audio effects" : "Enable audio effects"
              }
              title={
                profile.soundEnabled
                  ? "Sound: ON (Click to mute)"
                  : "Sound: MUTED (Click to enable)"
              }
              type="button"
            >
              {profile.soundEnabled ? (
                <svg className="gb-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              ) : (
                <svg className="gb-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
              <span className="gb-sound-label">
                {profile.soundEnabled ? "Audio" : "Muted"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Badges Modal */}
      <BadgesModal
        isOpen={isBadgesOpen}
        onClose={() => setIsBadgesOpen(false)}
        profile={profile}
      />
    </>
  );
}
