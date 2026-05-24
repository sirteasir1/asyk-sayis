import type { ArenaTheme, SakaSkin } from "@/lib/gameStore";

export interface SkinDef {
  id: SakaSkin;
  name: string;
  fill: string;
  highlight: string;
  shadow: string;
  glow?: string;
  unlockScore: number;
}

export const SAKA_SKINS: Record<SakaSkin, SkinDef> = {
  bone: { id: "bone", name: "Classic Bone", fill: "#e8d9b0", highlight: "#fff4d8", shadow: "#8a7340", unlockScore: 0 },
  stone: { id: "stone", name: "Black Stone", fill: "#2a2a30", highlight: "#5a5a66", shadow: "#0a0a10", unlockScore: 500 },
  gold: { id: "gold", name: "Ceremonial Gold", fill: "#e6b34a", highlight: "#fff0b0", shadow: "#7a5410", glow: "#ffd870", unlockScore: 2000 },
  neon: { id: "neon", name: "Neon Tribal", fill: "#2a1a3a", highlight: "#ff3ec9", shadow: "#0a0014", glow: "#00f0ff", unlockScore: 5000 },
};

export interface ArenaDef {
  id: ArenaTheme;
  name: string;
  groundA: string;
  groundB: string;
  accent: string;
  rim: string;
  unlockScore: number;
}

export const ARENAS: Record<ArenaTheme, ArenaDef> = {
  field: { id: "field", name: "Natural Field", groundA: "#7a6038", groundB: "#5a4628", accent: "#c89858", rim: "#3a2c18", unlockScore: 0 },
  stone: { id: "stone", name: "Stone Arena", groundA: "#4a4a52", groundB: "#2a2a32", accent: "#8a8a96", rim: "#1a1a22", unlockScore: 800 },
  gold: { id: "gold", name: "Ceremonial Gold", groundA: "#5a3a18", groundB: "#3a240c", accent: "#e6b34a", rim: "#1c1208", unlockScore: 3000 },
  neon: { id: "neon", name: "Neon Arena", groundA: "#0a0a2a", groundB: "#04041a", accent: "#00f0ff", rim: "#ff3ec9", unlockScore: 6000 },
};
