import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { loadState, patchState, type SakaSkin, type ArenaTheme } from "@/lib/gameStore";
import { SAKA_SKINS, ARENAS } from "@/lib/skins";
import { playUI } from "@/lib/audio";

export const Route = createFileRoute("/skins")({
  head: () => ({ meta: [{ title: "Skins — Асық Ату" }] }),
  component: Skins,
});

function Skins() {
  const [st, setSt] = useState(loadState());

  const pickSaka = (id: SakaSkin) => {
    if (!st.unlockedSakas.includes(id)) return;
    playUI();
    setSt(patchState({ selectedSaka: id }));
  };
  const pickArena = (id: ArenaTheme) => {
    if (!st.unlockedArenas.includes(id)) return;
    playUI();
    setSt(patchState({ selectedArena: id }));
  };

  return (
    <div className="min-h-screen bg-arena p-8 md:p-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <Link to="/" className="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground">← Back</Link>
          <h1 className="display text-3xl text-gold">Skins & Arenas</h1>
          <div className="w-12" />
        </div>

        <p className="text-center text-muted-foreground mb-8 text-sm tracking-wide">
          Lifetime score: <span className="text-gold display text-lg">{st.totalScore.toLocaleString()}</span>
        </p>

        <section className="mb-12">
          <h2 className="display text-xl mb-4 tracking-widest uppercase">Saka</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.values(SAKA_SKINS).map(s => {
              const unlocked = st.unlockedSakas.includes(s.id);
              const selected = st.selectedSaka === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => pickSaka(s.id)}
                  disabled={!unlocked}
                  className={`relative p-5 rounded-lg border-2 transition-all text-left ${
                    selected ? "border-accent bg-accent/10" : "border-border bg-card/60"
                  } ${unlocked ? "hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                >
                  <div className="aspect-square rounded-md mb-3 flex items-center justify-center" style={{ background: `radial-gradient(circle, ${s.shadow}, #000)` }}>
                    <svg viewBox="-40 -40 80 80" width="80" height="80" style={{ filter: s.glow ? `drop-shadow(0 0 8px ${s.glow})` : "none" }}>
                      <path
                        d="M-20,-12 C-30,-22 -30,-28 -10,-20 C-4,-16 4,-16 10,-20 C30,-28 30,-22 20,-12 C18,0 18,0 20,12 C30,22 30,28 10,20 C4,16 -4,16 -10,20 C-30,28 -30,22 -20,12 C-22,0 -22,0 -20,-12 Z"
                        fill={s.fill}
                        stroke={s.shadow}
                        strokeWidth="2"
                      />
                      <ellipse cx="-6" cy="-8" rx="6" ry="4" fill={s.highlight} opacity="0.6" />
                    </svg>
                  </div>
                  <div className="display text-sm">{s.name}</div>
                  <div className="text-[10px] tracking-widest uppercase mt-1 text-muted-foreground">
                    {unlocked ? (selected ? "Equipped" : "Tap to equip") : `Unlock at ${s.unlockScore.toLocaleString()}`}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="display text-xl mb-4 tracking-widest uppercase">Arena</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.values(ARENAS).map(a => {
              const unlocked = st.unlockedArenas.includes(a.id);
              const selected = st.selectedArena === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => pickArena(a.id)}
                  disabled={!unlocked}
                  className={`relative p-5 rounded-lg border-2 transition-all text-left ${
                    selected ? "border-accent bg-accent/10" : "border-border bg-card/60"
                  } ${unlocked ? "hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                >
                  <div
                    className="aspect-square rounded-md mb-3 relative overflow-hidden"
                    style={{ background: `linear-gradient(180deg, ${a.groundB}, ${a.groundA})` }}
                  >
                    <div className="absolute inset-x-3 top-1/2 h-px" style={{ background: a.accent, boxShadow: `0 0 6px ${a.accent}` }} />
                    <div className="absolute inset-2 border" style={{ borderColor: a.rim, borderRadius: 4 }} />
                  </div>
                  <div className="display text-sm">{a.name}</div>
                  <div className="text-[10px] tracking-widest uppercase mt-1 text-muted-foreground">
                    {unlocked ? (selected ? "Equipped" : "Tap to equip") : `Unlock at ${a.unlockScore.toLocaleString()}`}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
