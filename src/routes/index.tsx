import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { resumeAudio } from "@/lib/audio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Асық Ату — Modern Arcade" },
      { name: "description", content: "A modern arcade reinterpretation of the traditional Kazakh game Асық ату — physics, skill, and streaks." },
    ],
  }),
  component: Landing,
});

function Landing() {
  useEffect(() => {
    const r = () => resumeAudio();
    window.addEventListener("pointerdown", r, { once: true });
    return () => window.removeEventListener("pointerdown", r);
  }, []);

  const particles = useMemo(
    () => Array.from({ length: 40 }).map((_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 12,
      dur: 8 + Math.random() * 14,
      drift: (Math.random() - 0.5) * 60,
      size: 1 + Math.random() * 3,
      key: i,
    })),
    [],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-arena">
      {/* Background atmospheric layers */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 80%, rgba(230,179,74,0.18), transparent 60%)",
        }} />
        {/* Procedural decorative asyks silhouette */}
        <svg className="absolute bottom-0 left-0 right-0 w-full opacity-30" viewBox="0 0 1600 400" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3a2818" />
              <stop offset="100%" stopColor="#0a0604" />
            </linearGradient>
          </defs>
          <path d="M0,400 L0,260 Q400,180 800,240 T1600,220 L1600,400 Z" fill="url(#hg)" />
        </svg>
      </div>

      {/* dust */}
      {particles.map(p => (
        <span
          key={p.key}
          className="dust-particle"
          style={{
            left: `${p.left}%`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            width: p.size,
            height: p.size,
            ["--drift" as string]: `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}

      <div className="relative z-10 min-h-screen grid grid-cols-1 md:grid-cols-[300px_1fr]">
        {/* Left vertical menu */}
        <aside className="flex flex-col justify-between p-8 md:p-10 border-r border-border/40 backdrop-blur-sm">
          <div>
            <div className="text-xs tracking-[0.4em] text-muted-foreground uppercase mb-2">Қазақша</div>
            <h1 className="display text-3xl md:text-4xl text-gold leading-none">АСЫҚ<br />АТУ</h1>
            <div className="mt-3 h-px w-12 bg-accent" />
            <p className="mt-3 text-xs text-muted-foreground tracking-widest uppercase">Bone · Skill · Streak</p>
          </div>

          <nav className="flex flex-col gap-1 my-12">
            <Link to="/game" className="btn-menu">▸ Play</Link>
            <Link to="/skins" className="btn-menu">▸ Skins</Link>
            <Link to="/settings" className="btn-menu">▸ Settings</Link>
          </nav>

          <div className="text-[10px] tracking-widest text-muted-foreground uppercase">
            <p>Inspired by traditional</p>
            <p>Kazakh knucklebone games</p>
          </div>
        </aside>

        {/* Right hero */}
        <main className="relative flex items-center justify-center p-10">
          <div className="max-w-2xl">
            <div className="text-xs tracking-[0.4em] text-accent uppercase mb-4">Arcade · Physics · 2026</div>
            <h2 className="display text-5xl md:text-7xl leading-[0.95] mb-6">
              Throw the saka.<br />
              <span className="text-gold">Break the line.</span>
            </h2>
            <p className="text-muted-foreground text-base md:text-lg max-w-md leading-relaxed mb-10">
              A modern arcade reinterpretation of the ancient Kazakh game.
              Charge your throw, master the curve, and chain perfect hits into streaks
              that bend time itself.
            </p>

            <div className="flex gap-4 items-center">
              <Link to="/game" className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground font-bold tracking-[0.3em] uppercase rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors">
                <span>Play Now</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <Link to="/skins" className="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground">Customize</Link>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-6 max-w-md">
              {[
                { k: "Shots", v: "3 types" },
                { k: "Physics", v: "Real" },
                { k: "Boss", v: "Every 4" },
              ].map(s => (
                <div key={s.k}>
                  <div className="text-[10px] tracking-widest text-muted-foreground uppercase">{s.k}</div>
                  <div className="display text-xl text-gold mt-1">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
