// Persistent game store using localStorage
export type SakaSkin = "bone" | "stone" | "gold" | "neon";
export type ArenaTheme = "field" | "stone" | "gold" | "neon";

export interface GameState {
  highScore: number;
  bestStreak: number;
  totalScore: number;
  unlockedSakas: SakaSkin[];
  unlockedArenas: ArenaTheme[];
  selectedSaka: SakaSkin;
  selectedArena: ArenaTheme;
  sensitivity: number; // 0.3 - 2.0
  invertAim: boolean;
  sfxVolume: number; // 0-1
  musicVolume: number; // 0-1
}

const KEY = "asyk_game_v1";

const DEFAULT: GameState = {
  highScore: 0,
  bestStreak: 0,
  totalScore: 0,
  unlockedSakas: ["bone"],
  unlockedArenas: ["field"],
  selectedSaka: "bone",
  selectedArena: "field",
  sensitivity: 1,
  invertAim: false,
  sfxVolume: 0.7,
  musicVolume: 0.4,
};

export function loadState(): GameState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function saveState(s: GameState) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function patchState(patch: Partial<GameState>): GameState {
  const next = { ...loadState(), ...patch };
  saveState(next);
  return next;
}

export function resetState() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

// Skin unlock thresholds (by totalScore)
export const SAKA_UNLOCKS: Record<SakaSkin, number> = {
  bone: 0,
  stone: 500,
  gold: 2000,
  neon: 5000,
};
export const ARENA_UNLOCKS: Record<ArenaTheme, number> = {
  field: 0,
  stone: 800,
  gold: 3000,
  neon: 6000,
};
