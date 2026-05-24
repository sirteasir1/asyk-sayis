import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { loadState, patchState, resetState } from "@/lib/gameStore";
import { setSfxVolume, setMusicVolume, playUI } from "@/lib/audio";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Асық Ату" }] }),
  component: Settings,
});

function Settings() {
  const [st, setSt] = useState(loadState());

  const update = (patch: Partial<typeof st>) => {
    const next = patchState(patch);
    setSt(next);
  };

  return (
    <div className="min-h-screen bg-arena p-8 md:p-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <Link to="/" className="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground">← Back</Link>
          <h1 className="display text-3xl text-gold">Settings</h1>
          <div className="w-12" />
        </div>

        <div className="space-y-8">
          <Section title="Aiming">
            <Row label={`Sensitivity (${st.sensitivity.toFixed(2)}×)`}>
              <input type="range" min={0.3} max={2} step={0.05} value={st.sensitivity}
                onChange={e => update({ sensitivity: parseFloat(e.target.value) })}
                className="w-full" />
            </Row>
            <Row label="Invert aim">
              <button
                onClick={() => { playUI(); update({ invertAim: !st.invertAim }); }}
                className={`px-4 py-1.5 text-xs tracking-widest uppercase rounded border ${st.invertAim ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
              >{st.invertAim ? "On" : "Off"}</button>
            </Row>
          </Section>

          <Section title="Audio">
            <Row label={`SFX volume (${Math.round(st.sfxVolume * 100)}%)`}>
              <input type="range" min={0} max={1} step={0.01} value={st.sfxVolume}
                onChange={e => { const v = parseFloat(e.target.value); setSfxVolume(v); update({ sfxVolume: v }); }}
                className="w-full" />
            </Row>
            <Row label={`Music volume (${Math.round(st.musicVolume * 100)}%)`}>
              <input type="range" min={0} max={1} step={0.01} value={st.musicVolume}
                onChange={e => { const v = parseFloat(e.target.value); setMusicVolume(v); update({ musicVolume: v }); }}
                className="w-full" />
            </Row>
          </Section>

          <Section title="Progression">
            <Row label="High score"><span className="display text-xl text-gold">{st.highScore.toLocaleString()}</span></Row>
            <Row label="Best streak"><span className="display text-xl text-accent">×{st.bestStreak}</span></Row>
            <Row label="Lifetime score"><span className="display text-xl">{st.totalScore.toLocaleString()}</span></Row>
            <div className="pt-3">
              <button
                onClick={() => {
                  if (confirm("Reset all progress, skins, and settings?")) {
                    resetState();
                    setSt(loadState());
                  }
                }}
                className="px-4 py-2 text-xs tracking-widest uppercase rounded border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >Reset progress</button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card/60 backdrop-blur-sm border border-border rounded-lg p-6">
      <h2 className="display text-xl text-gold mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 items-center min-h-[2.5rem]">
      <label className="text-xs tracking-widest uppercase text-muted-foreground">{label}</label>
      <div className="min-w-[200px]">{children}</div>
    </div>
  );
}
