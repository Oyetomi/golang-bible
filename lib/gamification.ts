/* ─────────────────────────────────────────────────────────────
   Gamification Engine for The Go Bible
   - Persistent player profile in localStorage (SSR-safe)
   - Levels 1 to 50 with titles and XP progression
   - Daily streak tracking with 1 streak freeze support
   - Solved items tracker: QuickChecks, Exercises, Labs, Chapters
   - 20 Achievement Badges with progress tracking
   - Custom Event Dispatchers: gb:gamification, gb:confetti, gb:levelup, gb:xp-gain
   ───────────────────────────────────────────────────────────── */

export type BadgeId =
  | "first_code"
  | "quick_thinker"
  | "quiz_master"
  | "lab_novice"
  | "lab_veteran"
  | "channel_surfer"
  | "race_slayer"
  | "ddd_architect"
  | "consensus_king"
  | "zero_alloc_titan"
  | "ebpf_warlock"
  | "wasm_alchemist"
  | "streak_3"
  | "streak_7"
  | "night_owl"
  | "explorer_10"
  | "scholar_50"
  | "master_100"
  | "playground_hacker"
  | "sound_enthusiast";

export type BadgeCategory =
  | "starter"
  | "quiz"
  | "lab"
  | "mastery"
  | "streak"
  | "exploration"
  | "special";

export interface BadgeDefinition {
  id: BadgeId;
  title: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  maxProgress: number;
}

export interface BadgeProgress extends BadgeDefinition {
  unlocked: boolean;
  unlockedAt: number | null;
  currentProgress: number;
}

export interface PlayerProfile {
  xp: number;
  level: number;
  title: string;
  streak: number;
  lastActiveDate: string; // YYYY-MM-DD
  streakFreezes: number;
  lastFreezeUsedDate: string | null;
  solvedQuickChecks: string[];
  solvedExercises: string[];
  solvedLabs: string[];
  completedChapters: string[];
  codeRuns: number;
  unlockedBadges: Partial<Record<BadgeId, number>>; // id -> timestamp
  soundEnabled: boolean;
  lastLevel: number;
}

export interface LevelInfo {
  level: number;
  title: string;
  currentXP: number;
  totalXP: number;
  levelStartXP: number;
  nextLevelXP: number;
  xpNeededForNext: number;
  progressPct: number;
  isMaxLevel: boolean;
}

export const BADGE_DEFINITIONS: Record<BadgeId, BadgeDefinition> = {
  first_code: {
    id: "first_code",
    title: "First Spark",
    description: "Ran your first Go code snippet in the sandbox",
    icon: "[RUN]",
    category: "starter",
    maxProgress: 1,
  },
  quick_thinker: {
    id: "quick_thinker",
    title: "Quick Thinker",
    description: "Answered 5 QuickChecks correctly",
    icon: "[QUIZ]",
    category: "quiz",
    maxProgress: 5,
  },
  quiz_master: {
    id: "quiz_master",
    title: "Quiz Master",
    description: "Answered 25 QuickChecks correctly",
    icon: "[MASTER]",
    category: "quiz",
    maxProgress: 25,
  },
  lab_novice: {
    id: "lab_novice",
    title: "Bug Hunter",
    description: "Captured your first Lab flag",
    icon: "[FLAG]",
    category: "lab",
    maxProgress: 1,
  },
  lab_veteran: {
    id: "lab_veteran",
    title: "CTF Champion",
    description: "Captured 10 Lab flags across chapters",
    icon: "[CTF]",
    category: "lab",
    maxProgress: 10,
  },
  channel_surfer: {
    id: "channel_surfer",
    title: "Channel Surfer",
    description: "Mastered CSP concurrency patterns and pipeline select",
    icon: "[CSP]",
    category: "mastery",
    maxProgress: 1,
  },
  race_slayer: {
    id: "race_slayer",
    title: "Race Slayer",
    description: "Defeated high-concurrency race conditions in interactive labs",
    icon: "[SYNC]",
    category: "mastery",
    maxProgress: 1,
  },
  ddd_architect: {
    id: "ddd_architect",
    title: "System Architect",
    description: "Designed Hexagonal & Domain-Driven architecture in Go",
    icon: "[ARCH]",
    category: "mastery",
    maxProgress: 1,
  },
  consensus_king: {
    id: "consensus_king",
    title: "Consensus Commander",
    description: "Mastered Raft consensus algorithms and distributed leases",
    icon: "[RAFT]",
    category: "mastery",
    maxProgress: 1,
  },
  zero_alloc_titan: {
    id: "zero_alloc_titan",
    title: "Zero-Alloc Titan",
    description: "Engineered lock-free ring buffers and zero-copy parsers",
    icon: "[ZERO]",
    category: "mastery",
    maxProgress: 1,
  },
  ebpf_warlock: {
    id: "ebpf_warlock",
    title: "Kernel Whisperer",
    description: "Wrote and attached eBPF kernel probes in Go",
    icon: "[EBPF]",
    category: "mastery",
    maxProgress: 1,
  },
  wasm_alchemist: {
    id: "wasm_alchemist",
    title: "Wasm Alchemist",
    description: "Sandboxed untrusted code in WASI / WebAssembly runtimes",
    icon: "[WASM]",
    category: "mastery",
    maxProgress: 1,
  },
  streak_3: {
    id: "streak_3",
    title: "On Fire",
    description: "Maintained a 3-day learning streak",
    icon: "[STRK-3]",
    category: "streak",
    maxProgress: 3,
  },
  streak_7: {
    id: "streak_7",
    title: "Unstoppable",
    description: "Maintained a 7-day learning streak",
    icon: "[STRK-7]",
    category: "streak",
    maxProgress: 7,
  },
  night_owl: {
    id: "night_owl",
    title: "Midnight Coder",
    description: "Completed a lesson or quiz past midnight",
    icon: "[NIGHT]",
    category: "special",
    maxProgress: 1,
  },
  explorer_10: {
    id: "explorer_10",
    title: "Explorer",
    description: "Read 10 full course chapters",
    icon: "[EXP-10]",
    category: "exploration",
    maxProgress: 10,
  },
  scholar_50: {
    id: "scholar_50",
    title: "Scholar",
    description: "Read 50 full course chapters",
    icon: "[EXP-50]",
    category: "exploration",
    maxProgress: 50,
  },
  master_100: {
    id: "master_100",
    title: "Go Master",
    description: "Completed all chapters and master labs in The Go Bible",
    icon: "[GO-100]",
    category: "exploration",
    maxProgress: 100,
  },
  playground_hacker: {
    id: "playground_hacker",
    title: "Playground Hacker",
    description: "Ran 50 Go code snippets in the interactive sandbox",
    icon: "[PLAY]",
    category: "starter",
    maxProgress: 50,
  },
  sound_enthusiast: {
    id: "sound_enthusiast",
    title: "Audiophile",
    description: "Enabled retro 8-bit chiptune sound effects",
    icon: "[AUDIO]",
    category: "special",
    maxProgress: 1,
  },
};

const STORAGE_KEY = "gb-gamification-profile";

export const TITLES_BY_LEVEL: { minLevel: number; title: string }[] = [
  { minLevel: 50, title: "Grandmaster Gopher" },
  { minLevel: 45, title: "High-Frequency Maestro" },
  { minLevel: 40, title: "Kernel Warlock" },
  { minLevel: 35, title: "Zero-Alloc Titan" },
  { minLevel: 30, title: "Distributed Systems Sage" },
  { minLevel: 25, title: "Production Architect" },
  { minLevel: 20, title: "Backend Craftsman" },
  { minLevel: 15, title: "Goroutine Whisperer" },
  { minLevel: 10, title: "Concurrency Apprentice" },
  { minLevel: 5, title: "Syntax Scout" },
  { minLevel: 1, title: "Novice Gopher" },
];

export function getTitleForLevel(level: number): string {
  for (const t of TITLES_BY_LEVEL) {
    if (level >= t.minLevel) return t.title;
  }
  return "Novice Gopher";
}

/** Cumulative XP required to reach each level (1 to 50). */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > 50) level = 50;
  // Smooth curve: ~100 XP for lv 2, ~700 for lv 5, ~3,000 for lv 15, ~35,000 for lv 50
  return Math.floor(55 * Math.pow(level - 1, 1.72) + (level - 1) * 45);
}

export function calculateLevelInfo(totalXP: number): LevelInfo {
  let level = 1;
  for (let l = 1; l <= 50; l++) {
    if (totalXP >= xpRequiredForLevel(l)) {
      level = l;
    } else {
      break;
    }
  }

  const isMaxLevel = level >= 50;
  const levelStartXP = xpRequiredForLevel(level);
  const nextLevelXP = isMaxLevel ? levelStartXP : xpRequiredForLevel(level + 1);
  const currentXP = totalXP - levelStartXP;
  const xpNeededForNext = isMaxLevel ? 0 : nextLevelXP - levelStartXP;
  const progressPct = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, Math.round((currentXP / xpNeededForNext) * 100)));

  return {
    level,
    title: getTitleForLevel(level),
    currentXP,
    totalXP,
    levelStartXP,
    nextLevelXP,
    xpNeededForNext,
    progressPct,
    isMaxLevel,
  };
}

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDefaultProfile(): PlayerProfile {
  return {
    xp: 0,
    level: 1,
    title: "Novice Gopher",
    streak: 1,
    lastActiveDate: getTodayString(),
    streakFreezes: 1,
    lastFreezeUsedDate: null,
    solvedQuickChecks: [],
    solvedExercises: [],
    solvedLabs: [],
    completedChapters: [],
    codeRuns: 0,
    unlockedBadges: {},
    soundEnabled: true,
    lastLevel: 1,
  };
}

export function getProfile(): PlayerProfile {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return getDefaultProfile();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultProfile();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    const defaults = getDefaultProfile();
    // Merge defensively with defaults
    return {
      ...defaults,
      ...parsed,
      solvedQuickChecks: Array.isArray(parsed.solvedQuickChecks) ? parsed.solvedQuickChecks : [],
      solvedExercises: Array.isArray(parsed.solvedExercises) ? parsed.solvedExercises : [],
      solvedLabs: Array.isArray(parsed.solvedLabs) ? parsed.solvedLabs : [],
      completedChapters: Array.isArray(parsed.completedChapters) ? parsed.completedChapters : [],
      unlockedBadges: typeof parsed.unlockedBadges === "object" && parsed.unlockedBadges !== null ? parsed.unlockedBadges : {},
    };
  } catch (e) {
    console.warn("Failed to load gamification profile from localStorage:", e);
    return getDefaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent("gb:gamification", { detail: profile }));
  } catch (e) {
    console.warn("Failed to save gamification profile to localStorage:", e);
  }
}

/** Updates daily streak logic with 1 streak freeze safeguard. */
function updateStreakOnActivity(profile: PlayerProfile): { profile: PlayerProfile; streakIncreased: boolean; freezeUsed: boolean } {
  const today = getTodayString();
  const yesterday = getYesterdayString();
  let streakIncreased = false;
  let freezeUsed = false;

  if (!profile.lastActiveDate) {
    profile.lastActiveDate = today;
    profile.streak = 1;
    profile.streakFreezes = 1;
    return { profile, streakIncreased: true, freezeUsed: false };
  }

  if (profile.lastActiveDate === today) {
    // Already active today — nothing to increment
    return { profile, streakIncreased: false, freezeUsed: false };
  }

  if (profile.lastActiveDate === yesterday) {
    // Perfect consecutive day!
    profile.streak += 1;
    profile.lastActiveDate = today;
    streakIncreased = true;
    // Reward a streak freeze every 7 days (cap at 1)
    if (profile.streak % 7 === 0 && profile.streakFreezes < 1) {
      profile.streakFreezes = 1;
    }
  } else {
    // Check if missed exactly 1 day (lastActive was 2 days ago)
    const lastDate = new Date(profile.lastActiveDate);
    const currentDate = new Date(today);
    const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 2 && profile.streakFreezes > 0) {
      // Consume 1 streak freeze!
      profile.streakFreezes -= 1;
      profile.lastFreezeUsedDate = yesterday;
      profile.streak += 1; // preserve and advance streak
      profile.lastActiveDate = today;
      freezeUsed = true;
      streakIncreased = true;
    } else {
      // Streak broken, reset to 1
      profile.streak = 1;
      profile.lastActiveDate = today;
      profile.streakFreezes = Math.max(profile.streakFreezes, 1);
    }
  }

  return { profile, streakIncreased, freezeUsed };
}

/** Check achievement unlock conditions against the current profile. */
export function checkAchievements(profile: PlayerProfile): BadgeId[] {
  const newlyUnlocked: BadgeId[] = [];
  const now = Date.now();

  const tryUnlock = (id: BadgeId, condition: boolean) => {
    if (condition && !profile.unlockedBadges[id]) {
      profile.unlockedBadges[id] = now;
      newlyUnlocked.push(id);
    }
  };

  // 1. first_code
  tryUnlock("first_code", profile.codeRuns >= 1);

  // 2. quick_thinker (5 quick checks)
  tryUnlock("quick_thinker", profile.solvedQuickChecks.length >= 5);

  // 3. quiz_master (25 quick checks)
  tryUnlock("quiz_master", profile.solvedQuickChecks.length >= 25);

  // 4. lab_novice (1 lab flag)
  tryUnlock("lab_novice", profile.solvedLabs.length >= 1);

  // 5. lab_veteran (10 lab flags)
  tryUnlock("lab_veteran", profile.solvedLabs.length >= 10);

  // 6. channel_surfer (concurrency chapter/lab)
  tryUnlock(
    "channel_surfer",
    profile.completedChapters.some((s) => s.includes("concurrency") || s.includes("channel") || s.includes("csp")) ||
      profile.solvedLabs.some((l) => l.toLowerCase().includes("channel") || l.toLowerCase().includes("concurrency") || l.toLowerCase().includes("pipeline"))
  );

  // 7. race_slayer (race condition solved)
  tryUnlock(
    "race_slayer",
    profile.solvedLabs.some((l) => l.toLowerCase().includes("race") || l.toLowerCase().includes("mutex") || l.toLowerCase().includes("atomic"))
  );

  // 8. ddd_architect
  tryUnlock(
    "ddd_architect",
    profile.completedChapters.some((s) => s.includes("architecture") || s.includes("ddd") || s.includes("hexagonal")) ||
      profile.solvedLabs.some((l) => l.toLowerCase().includes("architect") || l.toLowerCase().includes("hexagonal") || l.toLowerCase().includes("ddd"))
  );

  // 9. consensus_king
  tryUnlock(
    "consensus_king",
    profile.completedChapters.some((s) => s.includes("raft") || s.includes("consensus") || s.includes("replication") || s.includes("lease")) ||
      profile.solvedLabs.some((l) => l.toLowerCase().includes("raft") || l.toLowerCase().includes("consensus") || l.toLowerCase().includes("lease"))
  );

  // 10. zero_alloc_titan
  tryUnlock(
    "zero_alloc_titan",
    profile.completedChapters.some((s) => s.includes("zero-alloc") || s.includes("alloc") || s.includes("arena") || s.includes("memory")) ||
      profile.solvedLabs.some((l) => l.toLowerCase().includes("zero-alloc") || l.toLowerCase().includes("ring") || l.toLowerCase().includes("buffer"))
  );

  // 11. ebpf_warlock
  tryUnlock(
    "ebpf_warlock",
    profile.completedChapters.some((s) => s.includes("ebpf") || s.includes("kernel") || s.includes("xdp") || s.includes("kprobe")) ||
      profile.solvedLabs.some((l) => l.toLowerCase().includes("ebpf") || l.toLowerCase().includes("kprobe") || l.toLowerCase().includes("kernel"))
  );

  // 12. wasm_alchemist
  tryUnlock(
    "wasm_alchemist",
    profile.completedChapters.some((s) => s.includes("wasm") || s.includes("wasi") || s.includes("sandbox")) ||
      profile.solvedLabs.some((l) => l.toLowerCase().includes("wasm") || l.toLowerCase().includes("wasi"))
  );

  // 13. streak_3
  tryUnlock("streak_3", profile.streak >= 3);

  // 14. streak_7
  tryUnlock("streak_7", profile.streak >= 7);

  // 15. night_owl (completed past midnight 00:00 - 04:59)
  const currentHour = new Date().getHours();
  if (currentHour >= 0 && currentHour < 5) {
    if (profile.completedChapters.length > 0 || profile.solvedQuickChecks.length > 0 || profile.solvedLabs.length > 0) {
      tryUnlock("night_owl", true);
    }
  }

  // 16. explorer_10
  tryUnlock("explorer_10", profile.completedChapters.length >= 10);

  // 17. scholar_50
  tryUnlock("scholar_50", profile.completedChapters.length >= 50);

  // 18. master_100
  tryUnlock("master_100", profile.completedChapters.length >= 100);

  // 19. playground_hacker
  tryUnlock("playground_hacker", profile.codeRuns >= 50);

  // 20. sound_enthusiast
  tryUnlock("sound_enthusiast", profile.soundEnabled === true);

  return newlyUnlocked;
}

/** Get list of all badges with progress and unlock state. */
export function getAllBadgesWithProgress(profile: PlayerProfile): BadgeProgress[] {
  return (Object.keys(BADGE_DEFINITIONS) as BadgeId[]).map((id) => {
    const def = BADGE_DEFINITIONS[id];
    const unlocked = !!profile.unlockedBadges[id];
    const unlockedAt = profile.unlockedBadges[id] ?? null;

    let currentProgress = 0;
    switch (id) {
      case "first_code":
        currentProgress = Math.min(def.maxProgress, profile.codeRuns);
        break;
      case "playground_hacker":
        currentProgress = Math.min(def.maxProgress, profile.codeRuns);
        break;
      case "quick_thinker":
      case "quiz_master":
        currentProgress = Math.min(def.maxProgress, profile.solvedQuickChecks.length);
        break;
      case "lab_novice":
      case "lab_veteran":
        currentProgress = Math.min(def.maxProgress, profile.solvedLabs.length);
        break;
      case "streak_3":
      case "streak_7":
        currentProgress = Math.min(def.maxProgress, profile.streak);
        break;
      case "explorer_10":
      case "scholar_50":
      case "master_100":
        currentProgress = Math.min(def.maxProgress, profile.completedChapters.length);
        break;
      default:
        currentProgress = unlocked ? def.maxProgress : 0;
    }

    return {
      ...def,
      unlocked,
      unlockedAt,
      currentProgress,
    };
  });
}

/** Dispatches gamification events and triggers sound/confetti if enabled. */
function processProfileUpdate(
  profile: PlayerProfile,
  gainedXP: number = 0,
  reason: string = ""
): { profile: PlayerProfile; leveledUp: boolean; newBadges: BadgeId[] } {
  const oldLevel = profile.lastLevel || profile.level;
  const levelInfo = calculateLevelInfo(profile.xp);
  const leveledUp = levelInfo.level > oldLevel;

  profile.level = levelInfo.level;
  profile.title = levelInfo.title;
  profile.lastLevel = levelInfo.level;

  // Check achievements
  const newBadges = checkAchievements(profile);

  // Save to storage (triggers gb:gamification event)
  saveProfile(profile);

  // Dispatch individual custom events if in browser
  if (typeof window !== "undefined") {
    if (gainedXP > 0) {
      window.dispatchEvent(
        new CustomEvent("gb:xp-gain", {
          detail: { amount: gainedXP, reason, totalXP: profile.xp },
        })
      );
    }

    if (leveledUp) {
      window.dispatchEvent(
        new CustomEvent("gb:levelup", {
          detail: {
            level: levelInfo.level,
            title: levelInfo.title,
            oldLevel,
          },
        })
      );
      window.dispatchEvent(new CustomEvent("gb:confetti", { detail: { count: 120 } }));
    }

    if (newBadges.length > 0) {
      newBadges.forEach((bId) => {
        window.dispatchEvent(
          new CustomEvent("gb:badge-unlock", {
            detail: BADGE_DEFINITIONS[bId],
          })
        );
      });
      window.dispatchEvent(new CustomEvent("gb:confetti", { detail: { count: 80 } }));
    }
  }

  return { profile, leveledUp, newBadges };
}

/** Add XP with reason, calculates levelup, streak, badges and saves profile. */
export function addXP(
  amount: number,
  reason: string = "Course Activity"
): { profile: PlayerProfile; leveledUp: boolean; newBadges: BadgeId[] } {
  const profile = getProfile();
  updateStreakOnActivity(profile);
  profile.xp += Math.max(0, amount);
  return processProfileUpdate(profile, amount, reason);
}

/** Record a solved QuickCheck question. */
export function recordQuickCheck(id: string): void {
  const profile = getProfile();
  updateStreakOnActivity(profile);

  if (!profile.solvedQuickChecks.includes(id)) {
    profile.solvedQuickChecks.push(id);
    profile.xp += 15; // 15 XP per quickcheck
    processProfileUpdate(profile, 15, "Answered QuickCheck");
  }
}

/** Record a completed exercise. */
export function recordExercise(id: string): void {
  const profile = getProfile();
  updateStreakOnActivity(profile);

  if (!profile.solvedExercises.includes(id)) {
    profile.solvedExercises.push(id);
    profile.xp += 25; // 25 XP per exercise
    processProfileUpdate(profile, 25, "Completed Exercise");
  }
}

/** Record a captured lab flag. */
export function recordLab(chapter: string, flag?: string): void {
  const profile = getProfile();
  updateStreakOnActivity(profile);

  const labKey = flag ? `${chapter}:${flag}` : chapter;
  if (!profile.solvedLabs.includes(labKey)) {
    profile.solvedLabs.push(labKey);
    profile.xp += 50; // 50 XP per lab flag
    processProfileUpdate(profile, 50, `Captured Lab Flag in ${chapter}`);
  }
}

/** Record a completed / fully read chapter. */
export function recordChapter(slug: string): void {
  const profile = getProfile();
  updateStreakOnActivity(profile);

  if (!profile.completedChapters.includes(slug)) {
    profile.completedChapters.push(slug);
    profile.xp += 40; // 40 XP per chapter
    processProfileUpdate(profile, 40, `Finished Chapter: ${slug}`);
  }
}

/** Record a code execution in Go Playground. */
export function recordCodeRun(): void {
  const profile = getProfile();
  updateStreakOnActivity(profile);
  profile.codeRuns += 1;
  // 5 XP on first run or every 5 runs
  const awardXP = profile.codeRuns === 1 ? 20 : profile.codeRuns % 5 === 0 ? 10 : 0;
  if (awardXP > 0) {
    profile.xp += awardXP;
    processProfileUpdate(profile, awardXP, "Ran Go Sandbox Code");
  } else {
    processProfileUpdate(profile, 0, "");
  }
}

/** Toggle 8-bit sound effects on/off. */
export function toggleSound(): boolean {
  const profile = getProfile();
  profile.soundEnabled = !profile.soundEnabled;
  if (profile.soundEnabled) {
    checkAchievements(profile);
  }
  saveProfile(profile);
  return profile.soundEnabled;
}

/** Manually unlock a badge if requirements are met. */
export function unlockBadge(id: BadgeId): boolean {
  const profile = getProfile();
  if (profile.unlockedBadges[id]) return false;
  profile.unlockedBadges[id] = Date.now();
  processProfileUpdate(profile, 30, `Unlocked Badge: ${BADGE_DEFINITIONS[id]?.title || id}`);
  return true;
}
