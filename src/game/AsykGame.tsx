import { useEffect, useRef, useState, useCallback } from "react";
import { loadState, patchState, type GameState } from "@/lib/gameStore";
import { ARENAS, SAKA_SKINS } from "@/lib/skins";
import {
  playImpact, playThrow, playPerfect, playStreak, playMiss, playCharge,
  startMusic, stopMusic, setSfxVolume, setMusicVolume, resumeAudio,
} from "@/lib/audio";

// --- types ---
type ShotType = "normal" | "heavy" | "curve";
type Vec = { x: number; y: number };

interface Asyk {
  id: number;
  pos: Vec;
  vel: Vec;
  angle: number;
  spin: number;
  radius: number;
  mass: number;
  alive: boolean;
  hit: boolean;
  fadeOut: number;
}
interface Saka {
  pos: Vec;
  vel: Vec;
  z: number;        // height for arc
  vz: number;
  angle: number;
  spin: number;
  active: boolean;
  curve: number;    // lateral drift
  weight: number;
  trail: { x: number; y: number; a: number }[];
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
interface FloatText { x: number; y: number; vy: number; life: number; max: number; text: string; color: string; size: number; }

const W = 900;
const H = 640;
const PLAYER_Y = H - 70;
const PLAYER_X = W / 2;
const GROUND_TOP = 120;

// --- helpers ---
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const dist2 = (a: Vec, b: Vec) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };

// Patterns spawn asyks. roundIdx 0-based.
function spawnPattern(roundIdx: number, isBoss: boolean): Asyk[] {
  const count = 7;
  const asyks: Asyk[] = [];
  const baseR = 18;
  const cy = GROUND_TOP + 80 + (roundIdx % 3) * 20;
  let positions: Vec[] = [];

  if (isBoss) {
    // Boss: circular formation with a central reinforced target
    const cx = W / 2;
    const ringR = 90;
    for (let i = 0; i < count - 1; i++) {
      const a = (i / (count - 1)) * Math.PI * 2;
      positions.push({ x: cx + Math.cos(a) * ringR, y: cy + 40 + Math.sin(a) * ringR * 0.6 });
    }
    positions.push({ x: cx, y: cy + 40 }); // boss center
  } else {
    const variant = roundIdx % 5;
    if (variant === 0) {
      // straight line
      const span = 520;
      for (let i = 0; i < count; i++) positions.push({ x: W / 2 - span / 2 + (span * i) / (count - 1), y: cy });
    } else if (variant === 1) {
      // arc
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1) - 0.5;
        positions.push({ x: W / 2 + t * 540, y: cy + Math.abs(t) * 90 });
      }
    } else if (variant === 2) {
      // staggered
      for (let i = 0; i < count; i++) positions.push({ x: 120 + (i * (W - 240)) / (count - 1), y: cy + (i % 2 === 0 ? 0 : 60) });
    } else if (variant === 3) {
      // clustered center
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1) - 0.5;
        positions.push({ x: W / 2 + t * 280, y: cy + Math.abs(t) * 60 });
      }
    } else {
      // split
      for (let i = 0; i < count; i++) {
        const side = i < count / 2 ? -1 : 1;
        const local = i < count / 2 ? i : i - Math.floor(count / 2);
        positions.push({ x: W / 2 + side * (140 + local * 70), y: cy + (i % 2) * 30 });
      }
    }
  }

  positions.forEach((p, i) => {
    const boss = isBoss && i === positions.length - 1;
    asyks.push({
      id: Math.random(),
      pos: { ...p },
      vel: { x: 0, y: 0 },
      angle: Math.random() * Math.PI * 2,
      spin: 0,
      radius: boss ? baseR * 1.5 : baseR,
      mass: boss ? 3.5 : 1,
      alive: true,
      hit: false,
      fadeOut: 0,
    });
  });
  return asyks;
}

const OBJECTIVE_POOL = [
  { id: "chain3", text: "Hit 3 in one throw", check: (h: number) => h >= 3, bonus: 300 },
  { id: "nomiss", text: "No miss this round", check: (_: number, miss: boolean) => !miss, bonus: 400 },
  { id: "centerfirst", text: "Hit center first", checkCenter: true, bonus: 250 },
  { id: "perfect", text: "Land a perfect hit", checkPerfect: true, bonus: 350 },
];

export function AsykGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(loadState());
  const [, force] = useState(0);
  const rerender = useCallback(() => force(x => x + 1), []);

  // UI-visible state mirrors
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(1);
  const [shotsLeft, setShotsLeft] = useState(3);
  const [shotType, setShotType] = useState<ShotType>("normal");
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [objective, setObjective] = useState<{ text: string; bonus: number } | null>(null);
  const [showRoundBanner, setShowRoundBanner] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  // Game world refs (so render loop doesn't re-create)
  const world = useRef({
    asyks: [] as Asyk[],
    saka: null as Saka | null,
    particles: [] as Particle[],
    floats: [] as FloatText[],
    aim: { x: PLAYER_X, y: PLAYER_Y - 200 },
    rawAim: { x: PLAYER_X, y: PLAYER_Y - 200 },
    mouseDown: false,
    chargeStart: 0,
    shake: 0,
    flash: 0,
    slowmo: 0,
    round: 1,
    isBoss: false,
    shotsLeft: 3,
    shotType: "normal" as ShotType,
    streak: 0,
    score: 0,
    hitsThisThrow: 0,
    hitCenterFirst: false,
    perfectThisThrow: false,
    missedAnyThisRound: false,
    objective: null as null | { id: string; text: string; bonus: number; checkCenter?: boolean; checkPerfect?: boolean; check?: (h: number, miss: boolean) => boolean; achieved: boolean },
    centerAsykId: null as number | null,
    lastTime: 0,
    gameOver: false,
    paused: false,
  });

  // Apply persisted volumes
  useEffect(() => {
    setSfxVolume(stateRef.current.sfxVolume);
    setMusicVolume(stateRef.current.musicVolume);
  }, []);

  // Start music
  useEffect(() => {
    const start = () => { resumeAudio(); startMusic(); window.removeEventListener("pointerdown", start); };
    window.addEventListener("pointerdown", start);
    return () => { stopMusic(); window.removeEventListener("pointerdown", start); };
  }, []);

  // Round setup
  const startRound = useCallback((r: number) => {
    const w = world.current;
    w.round = r;
    w.isBoss = r % 4 === 0;
    w.asyks = spawnPattern(r - 1, w.isBoss);
    w.shotsLeft = 3;
    w.hitsThisThrow = 0;
    w.hitCenterFirst = false;
    w.missedAnyThisRound = false;
    // mark center asyk (closest to center X)
    let centerId: number | null = null;
    let best = Infinity;
    w.asyks.forEach(a => {
      const d = Math.abs(a.pos.x - W / 2);
      if (d < best) { best = d; centerId = a.id; }
    });
    w.centerAsykId = centerId;
    // pick objective
    const o = OBJECTIVE_POOL[Math.floor(Math.random() * OBJECTIVE_POOL.length)];
    w.objective = { ...o, achieved: false };
    setObjective({ text: o.text, bonus: o.bonus });
    setShotsLeft(3);
    setRound(r);
    setShowRoundBanner(w.isBoss ? `BOSS ROUND ${r}` : `ROUND ${r}`);
    setTimeout(() => setShowRoundBanner(null), 1600);
  }, []);

  // First round
  useEffect(() => {
    startRound(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pointer handlers
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const getMouse = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = W / rect.width, sy = H / rect.height;
      return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
    };
    const onMove = (e: PointerEvent) => {
      const w = world.current;
      const m = getMouse(e);
      // sensitivity adjusts how far from player the aim point moves
      const sens = stateRef.current.sensitivity;
      const dx = (m.x - PLAYER_X) * sens;
      const dy = (m.y - PLAYER_Y) * sens;
      const inv = stateRef.current.invertAim ? -1 : 1;
      w.rawAim = { x: PLAYER_X + dx * inv, y: PLAYER_Y + dy * inv };
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const w = world.current;
      if (w.gameOver || w.paused || w.saka?.active) return;
      if (w.shotsLeft <= 0) return;
      w.mouseDown = true;
      w.chargeStart = performance.now();
      setCharging(true);
      playCharge();
    };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const w = world.current;
      if (!w.mouseDown) return;
      w.mouseDown = false;
      setCharging(false);
      throwSaka();
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard for shot type
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") { setShotType("normal"); world.current.shotType = "normal"; }
      if (e.key === "2") { setShotType("heavy"); world.current.shotType = "heavy"; }
      if (e.key === "3") { setShotType("curve"); world.current.shotType = "curve"; }
      if (e.key === "Escape") { setPaused(p => { world.current.paused = !p; return !p; }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const throwSaka = () => {
    const w = world.current;
    const charge = Math.min(1, (performance.now() - w.chargeStart) / 1500);
    const dx = w.aim.x - PLAYER_X;
    const dy = w.aim.y - PLAYER_Y;
    const len = Math.hypot(dx, dy) || 1;
    const baseSpeed = 6 + charge * 14;
    const type = w.shotType;
    let speed = baseSpeed;
    let weight = 1;
    let curve = 0;
    if (type === "heavy") { speed *= 0.85; weight = 2.2; }
    if (type === "curve") { speed *= 1.0; weight = 0.85; curve = (Math.random() < 0.5 ? -1 : 1) * 0.05; }

    const vx = (dx / len) * speed;
    const vy = (dy / len) * speed;
    const vz = 4 + charge * 6;

    w.saka = {
      pos: { x: PLAYER_X, y: PLAYER_Y },
      vel: { x: vx, y: vy },
      z: 0, vz,
      angle: Math.atan2(vy, vx),
      spin: 0.3 + charge * 0.4,
      active: true,
      curve,
      weight,
      trail: [],
    };
    w.hitsThisThrow = 0;
    w.perfectThisThrow = false;
    w.shotsLeft -= 1;
    setShotsLeft(w.shotsLeft);
    playThrow();
  };

  // Burst particles
  const burst = (x: number, y: number, color: string, n = 16, speed = 4) => {
    const w = world.current;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * speed + 1;
      w.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0, max: 30 + Math.random() * 20,
        color, size: 2 + Math.random() * 3,
      });
    }
  };

  const float = (x: number, y: number, text: string, color: string, size = 24) => {
    world.current.floats.push({ x, y, vy: -1.2, life: 0, max: 70, text, color, size });
  };

  // Handle asyk knocked out
  const knockOut = (a: Asyk) => {
    const w = world.current;
    const isCenter = a.id === w.centerAsykId;
    w.hitsThisThrow += 1;
    if (w.hitsThisThrow === 1 && isCenter) w.hitCenterFirst = true;

    // Check perfect: hit asyk near its own center
    // (already accounted in collision)
    let base = 100;
    if (a.mass > 2) base = 300; // boss component
    const mult = 1 + w.streak * 0.15;
    const chainBonus = w.hitsThisThrow >= 2 ? (w.hitsThisThrow - 1) * 50 : 0;
    const gained = Math.round((base + chainBonus) * mult);
    w.score += gained;
    setScore(w.score);
    float(a.pos.x, a.pos.y - 20, `+${gained}`, "#ffd870", 20);
    burst(a.pos.x, a.pos.y, "#e8c878", 18, 5);
    playImpact(Math.min(1.5, a.mass));
    w.shake = Math.max(w.shake, 8 + a.mass * 2);
    w.flash = 0.4;
  };

  // RAF loop
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0;

    const loop = (t: number) => {
      const w = world.current;
      const dt = Math.min(33, t - (w.lastTime || t)) / 16.67; // normalize to ~60fps frames
      w.lastTime = t;

      if (!w.paused && !w.gameOver) update(dt);
      render(ctx);
      raf = requestAnimationFrame(loop);
    };

    const update = (dt: number) => {
      const w = world.current;
      const slow = w.slowmo > 0 ? 0.25 : 1;
      const f = dt * slow;
      if (w.slowmo > 0) w.slowmo -= dt;

      // aim smoothing
      w.aim.x = lerp(w.aim.x, w.rawAim.x, 0.25);
      w.aim.y = lerp(w.aim.y, w.rawAim.y, 0.25);

      // charge meter
      if (w.mouseDown) {
        const c = Math.min(1, (performance.now() - w.chargeStart) / 1500);
        setPower(c);
      } else if (!w.saka?.active) {
        setPower(0);
      }

      // saka physics
      const s = w.saka;
      if (s && s.active) {
        // record trail
        s.trail.push({ x: s.pos.x, y: s.pos.y, a: 1 });
        if (s.trail.length > 14) s.trail.shift();
        s.trail.forEach(p => p.a *= 0.9);

        // arc via z
        s.vz -= 0.55 * f; // gravity on height
        s.z += s.vz * f;
        if (s.z < 0) s.z = 0;

        // horizontal motion (top-down) with light friction once landed
        // before landing, no friction; after landing, gentle friction
        const friction = s.z <= 0 ? 0.985 : 0.999;
        s.vel.x *= Math.pow(friction, f);
        s.vel.y *= Math.pow(friction, f);
        // curve shot lateral drift
        if (s.curve !== 0) {
          // perpendicular to velocity
          const vlen = Math.hypot(s.vel.x, s.vel.y) || 1;
          const px = -s.vel.y / vlen, py = s.vel.x / vlen;
          s.vel.x += px * s.curve * f;
          s.vel.y += py * s.curve * f;
        }
        s.pos.x += s.vel.x * f;
        s.pos.y += s.vel.y * f;
        s.spin += s.vel.x * 0.02 * f;
        s.angle = Math.atan2(s.vel.y, s.vel.x);

        // collide with asyks (only when z near ground, simulating side-arm flick that lands)
        if (s.z < 14) {
          for (const a of w.asyks) {
            if (!a.alive) continue;
            const d2 = dist2(s.pos, a.pos);
            const r = a.radius + 14;
            if (d2 < r * r) {
              const d = Math.sqrt(d2) || 1;
              const nx = (a.pos.x - s.pos.x) / d;
              const ny = (a.pos.y - s.pos.y) / d;
              // transfer momentum
              const power = Math.hypot(s.vel.x, s.vel.y) * s.weight;
              const transfer = power / a.mass;
              a.vel.x += nx * transfer * 0.9;
              a.vel.y += ny * transfer * 0.9;
              a.spin = (Math.random() - 0.5) * 0.6;
              // saka loses energy and slightly bounces
              s.vel.x -= nx * transfer * 0.3 * a.mass;
              s.vel.y -= ny * transfer * 0.3 * a.mass;
              // perfect: hit dead-center
              const centerDist = Math.sqrt(d2);
              if (centerDist < a.radius * 0.45 && !w.perfectThisThrow) {
                w.perfectThisThrow = true;
                w.slowmo = 18;
                w.flash = 0.8;
                playPerfect();
                float(a.pos.x, a.pos.y - 50, "PERFECT!", "#fff4a0", 32);
                w.score += 250;
                setScore(w.score);
              }
              a.alive = false;
              a.hit = true;
              a.fadeOut = 1;
              knockOut(a);
            }
          }
        }

        // out of bounds → end throw
        const outOfBounds = s.pos.x < -40 || s.pos.x > W + 40 || s.pos.y < GROUND_TOP - 80 || s.pos.y > H + 40;
        const stopped = Math.hypot(s.vel.x, s.vel.y) < 0.3 && s.z <= 0;
        if (outOfBounds || stopped) endThrow();
      }

      // asyks chain physics
      for (const a of w.asyks) {
        if (!a.alive) {
          if (a.fadeOut > 0) {
            a.pos.x += a.vel.x * f;
            a.pos.y += a.vel.y * f;
            a.vel.x *= 0.95; a.vel.y *= 0.95;
            a.angle += a.spin * f;
            a.fadeOut -= 0.02 * f;
          }
          continue;
        }
        a.pos.x += a.vel.x * f;
        a.pos.y += a.vel.y * f;
        a.vel.x *= 0.92; a.vel.y *= 0.92;
        a.angle += a.spin * f;
        a.spin *= 0.94;

        // asyk-asyk collision
        for (const b of w.asyks) {
          if (b === a || !b.alive) continue;
          const d2 = dist2(a.pos, b.pos);
          const r = a.radius + b.radius;
          if (d2 < r * r) {
            const d = Math.sqrt(d2) || 1;
            const nx = (b.pos.x - a.pos.x) / d, ny = (b.pos.y - a.pos.y) / d;
            const overlap = r - d;
            a.pos.x -= nx * overlap * 0.5;
            a.pos.y -= ny * overlap * 0.5;
            b.pos.x += nx * overlap * 0.5;
            b.pos.y += ny * overlap * 0.5;
            // transfer
            const rvx = b.vel.x - a.vel.x, rvy = b.vel.y - a.vel.y;
            const speed = rvx * nx + rvy * ny;
            if (speed < 0) {
              const imp = (-1.6 * speed) / (1 / a.mass + 1 / b.mass);
              a.vel.x -= (imp * nx) / a.mass;
              a.vel.y -= (imp * ny) / a.mass;
              b.vel.x += (imp * nx) / b.mass;
              b.vel.y += (imp * ny) / b.mass;
              // If moving fast enough, count chain hit
              if (Math.abs(speed) > 2.4 && b.alive) {
                b.alive = false;
                b.hit = true;
                b.fadeOut = 1;
                knockOut(b);
              }
            }
          }
        }
        // check if knocked out of arena
        if (a.pos.y < GROUND_TOP - 30 || a.pos.x < 30 || a.pos.x > W - 30 || a.pos.y > H - 30) {
          if (a.alive) { a.alive = false; a.hit = true; a.fadeOut = 1; knockOut(a); }
        }
      }

      // particles
      w.particles.forEach(p => {
        p.x += p.vx * f; p.y += p.vy * f;
        p.vy += 0.15 * f; p.vx *= 0.98; p.vy *= 0.99;
        p.life += f;
      });
      w.particles = w.particles.filter(p => p.life < p.max);
      // floats
      w.floats.forEach(fl => { fl.y += fl.vy * f; fl.life += f; });
      w.floats = w.floats.filter(fl => fl.life < fl.max);

      // shake / flash decay
      w.shake *= Math.pow(0.85, f);
      w.flash *= Math.pow(0.88, f);
    };

    const endThrow = () => {
      const w = world.current;
      if (!w.saka) return;
      w.saka.active = false;
      const hits = w.hitsThisThrow;
      if (hits === 0) {
        w.streak = 0;
        setStreak(0);
        w.missedAnyThisRound = true;
        playMiss();
        float(PLAYER_X, PLAYER_Y - 30, "MISS", "#ff6464", 26);
      } else {
        w.streak += 1;
        setStreak(w.streak);
        if (w.streak >= 2) {
          playStreak(Math.min(5, w.streak));
          float(W / 2, 200, `x${hits} • STREAK ${w.streak}`, "#ff9f3a", 28);
        }
      }

      // Round end?
      const remaining = w.asyks.filter(a => a.alive).length;
      const outOfShots = w.shotsLeft <= 0;
      setTimeout(() => {
        if (remaining === 0 || outOfShots) endRound(remaining === 0);
      }, 700);
    };

    const endRound = (clear: boolean) => {
      const w = world.current;
      // objective evaluation
      if (w.objective && !w.objective.achieved) {
        const o = w.objective;
        let ok = false;
        if (o.checkCenter) ok = w.hitCenterFirst;
        else if (o.checkPerfect) ok = w.perfectThisThrow || false; // approximation
        else if (o.check) ok = o.check(w.hitsThisThrow, w.missedAnyThisRound);
        if (ok) {
          o.achieved = true;
          w.score += o.bonus;
          setScore(w.score);
          float(W / 2, 240, `${o.text} +${o.bonus}`, "#73ffb8", 24);
        }
      }
      if (clear) {
        w.score += 500;
        setScore(w.score);
        float(W / 2, 200, `CLEAR! +500`, "#ffd870", 32);
        setTimeout(() => startRound(w.round + 1), 1100);
      } else {
        // not cleared = game over
        finishGame();
      }
    };

    const finishGame = () => {
      const w = world.current;
      w.gameOver = true;
      setGameOver(true);
      const st = loadState();
      const newTotal = st.totalScore + w.score;
      const high = Math.max(st.highScore, w.score);
      const bestStreak = Math.max(st.bestStreak, w.streak);
      // Unlocks
      const unlockedSakas = [...st.unlockedSakas];
      (["stone", "gold", "neon"] as const).forEach(k => {
        if (newTotal >= SAKA_SKINS[k].unlockScore && !unlockedSakas.includes(k)) unlockedSakas.push(k);
      });
      const unlockedArenas = [...st.unlockedArenas];
      (["stone", "gold", "neon"] as const).forEach(k => {
        if (newTotal >= ARENAS[k].unlockScore && !unlockedArenas.includes(k)) unlockedArenas.push(k);
      });
      patchState({
        highScore: high, totalScore: newTotal, bestStreak,
        unlockedSakas, unlockedArenas,
      });
      stateRef.current = loadState();
      rerender();
    };

    // --- RENDER ---
    const render = (ctx: CanvasRenderingContext2D) => {
      const w = world.current;
      const arena = ARENAS[stateRef.current.selectedArena];
      const saka = SAKA_SKINS[stateRef.current.selectedSaka];

      ctx.save();
      // shake
      if (w.shake > 0.1) {
        ctx.translate((Math.random() - 0.5) * w.shake, (Math.random() - 0.5) * w.shake);
      }
      // sky/background
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#1a1208");
      sky.addColorStop(1, "#06040a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // arena floor (perspective trapezoid)
      ctx.beginPath();
      ctx.moveTo(60, GROUND_TOP);
      ctx.lineTo(W - 60, GROUND_TOP);
      ctx.lineTo(W - 20, H - 20);
      ctx.lineTo(20, H - 20);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, GROUND_TOP, 0, H);
      g.addColorStop(0, arena.groundB);
      g.addColorStop(1, arena.groundA);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = arena.rim;
      ctx.lineWidth = 4;
      ctx.stroke();

      // ornament rim band
      ctx.save();
      ctx.strokeStyle = arena.accent;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(80, GROUND_TOP + 14);
      ctx.lineTo(W - 80, GROUND_TOP + 14);
      ctx.stroke();
      ctx.restore();

      // trajectory preview (when aiming and not in flight)
      if (!w.saka?.active && !w.gameOver) {
        drawTrajectory(ctx, w, saka.highlight);
      }

      // shadows under asyks
      for (const a of w.asyks) {
        ctx.beginPath();
        ctx.ellipse(a.pos.x, a.pos.y + a.radius * 0.7, a.radius * 0.9, a.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fill();
      }

      // asyks
      for (const a of w.asyks) {
        ctx.save();
        ctx.translate(a.pos.x, a.pos.y);
        ctx.rotate(a.angle);
        ctx.globalAlpha = a.alive ? 1 : Math.max(0, a.fadeOut);
        drawAsyk(ctx, a.radius, a.id === w.centerAsykId && a.alive, w.isBoss && a.mass > 2);
        ctx.restore();
      }

      // saka shadow + saka
      if (w.saka) {
        const s = w.saka;
        // trail
        s.trail.forEach((p, i) => {
          ctx.beginPath();
          ctx.fillStyle = `rgba(255,220,140,${p.a * 0.25})`;
          ctx.arc(p.x, p.y, 10 - i * 0.3, 0, Math.PI * 2);
          ctx.fill();
        });
        // shadow scales with z
        const shadowR = 14 - clamp(s.z * 0.15, 0, 10);
        ctx.beginPath();
        ctx.ellipse(s.pos.x, s.pos.y + 8, shadowR, shadowR * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fill();

        ctx.save();
        ctx.translate(s.pos.x, s.pos.y - s.z);
        ctx.rotate(s.angle + s.spin * 5);
        drawSaka(ctx, saka);
        ctx.restore();
      }

      // particles
      for (const p of w.particles) {
        const a = 1 - p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // player base + aiming reticle
      drawPlayer(ctx, w, saka);

      // floats
      for (const fl of w.floats) {
        const a = 1 - fl.life / fl.max;
        ctx.globalAlpha = a;
        ctx.font = `900 ${fl.size}px Cinzel, serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = fl.color;
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 4;
        ctx.strokeText(fl.text, fl.x, fl.y);
        ctx.fillText(fl.text, fl.x, fl.y);
        ctx.globalAlpha = 1;
      }

      // flash
      if (w.flash > 0.01) {
        ctx.fillStyle = `rgba(255,240,180,${w.flash * 0.4})`;
        ctx.fillRect(0, 0, W, H);
      }

      // slowmo vignette
      if (w.slowmo > 0) {
        const grd = ctx.createRadialGradient(W/2, H/2, 100, W/2, H/2, 500);
        grd.addColorStop(0, "rgba(0,0,0,0)");
        grd.addColorStop(1, "rgba(0,0,0,0.5)");
        ctx.fillStyle = grd;
        ctx.fillRect(0,0,W,H);
      }

      ctx.restore();

      // banner
      if (showRoundBanner) {
        ctx.save();
        ctx.font = "900 56px Cinzel, serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, H/2 - 60, W, 120);
        ctx.fillStyle = "#ffd870";
        ctx.fillText(showRoundBanner, W/2, H/2 + 15);
        ctx.restore();
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRoundBanner]);

  // helpers for drawing
  const drawTrajectory = (ctx: CanvasRenderingContext2D, w: typeof world.current, color: string) => {
    const dx = w.aim.x - PLAYER_X;
    const dy = w.aim.y - PLAYER_Y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;
    const charge = w.mouseDown ? Math.min(1, (performance.now() - w.chargeStart) / 1500) : 0.5;
    const baseSpeed = 6 + charge * 14;
    let speed = baseSpeed;
    if (w.shotType === "heavy") speed *= 0.85;
    let vx = nx * speed, vy = ny * speed, vz = 4 + charge * 6;
    let x = PLAYER_X, y = PLAYER_Y, z = 0;
    ctx.save();
    for (let i = 0; i < 32; i++) {
      vz -= 0.55;
      z += vz;
      if (z < 0) z = 0;
      x += vx; y += vy;
      const a = (1 - i / 32) * 0.7;
      ctx.fillStyle = color;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x, y - z, 3 - i * 0.05, 0, Math.PI * 2);
      ctx.fill();
      if (x < 0 || x > W || y < 0 || y > H) break;
    }
    ctx.restore();

    // reticle at aim
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(w.aim.x, w.aim.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w.aim.x - 20, w.aim.y);
    ctx.lineTo(w.aim.x - 8, w.aim.y);
    ctx.moveTo(w.aim.x + 8, w.aim.y);
    ctx.lineTo(w.aim.x + 20, w.aim.y);
    ctx.moveTo(w.aim.x, w.aim.y - 20);
    ctx.lineTo(w.aim.x, w.aim.y - 8);
    ctx.moveTo(w.aim.x, w.aim.y + 8);
    ctx.lineTo(w.aim.x, w.aim.y + 20);
    ctx.stroke();
    ctx.restore();
  };

  const drawAsyk = (ctx: CanvasRenderingContext2D, r: number, isCenter: boolean, isBoss: boolean) => {
    // Stylized bone-like asyk: peanut-shape silhouette + ornament
    const w = r * 1.7, h = r * 2.1;
    ctx.save();
    // base body
    ctx.fillStyle = isBoss ? "#5a2a1a" : "#e8d2a0";
    ctx.strokeStyle = "#3a2410";
    ctx.lineWidth = 2;
    roundedAsyk(ctx, w, h);
    ctx.fill();
    ctx.stroke();
    // highlight
    ctx.beginPath();
    ctx.ellipse(-w*0.2, -h*0.3, w*0.25, h*0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,250,220,0.6)";
    ctx.fill();
    // center marker
    if (isCenter) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(230,179,74,0.9)";
      ctx.fill();
      ctx.strokeStyle = "#5a3a10";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (isBoss) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = "#ff9f3a";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  };

  const roundedAsyk = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Knucklebone peanut shape
    ctx.beginPath();
    ctx.moveTo(-w/2, -h*0.3);
    ctx.bezierCurveTo(-w*0.7, -h*0.55, -w*0.7, -h*0.7, -w*0.25, -h*0.5);
    ctx.bezierCurveTo(-w*0.1, -h*0.4, w*0.1, -h*0.4, w*0.25, -h*0.5);
    ctx.bezierCurveTo(w*0.7, -h*0.7, w*0.7, -h*0.55, w/2, -h*0.3);
    ctx.bezierCurveTo(w*0.45, 0, w*0.45, 0, w/2, h*0.3);
    ctx.bezierCurveTo(w*0.7, h*0.55, w*0.7, h*0.7, w*0.25, h*0.5);
    ctx.bezierCurveTo(w*0.1, h*0.4, -w*0.1, h*0.4, -w*0.25, h*0.5);
    ctx.bezierCurveTo(-w*0.7, h*0.7, -w*0.7, h*0.55, -w/2, h*0.3);
    ctx.bezierCurveTo(-w*0.45, 0, -w*0.45, 0, -w/2, -h*0.3);
    ctx.closePath();
  };

  const drawSaka = (ctx: CanvasRenderingContext2D, def: typeof SAKA_SKINS[keyof typeof SAKA_SKINS]) => {
    if (def.glow) {
      ctx.shadowColor = def.glow;
      ctx.shadowBlur = 20;
    }
    ctx.fillStyle = def.fill;
    ctx.strokeStyle = def.shadow;
    ctx.lineWidth = 2;
    roundedAsyk(ctx, 24, 30);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // highlight
    ctx.beginPath();
    ctx.ellipse(-5, -8, 7, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = def.highlight;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const drawPlayer = (ctx: CanvasRenderingContext2D, w: typeof world.current, saka: typeof SAKA_SKINS[keyof typeof SAKA_SKINS]) => {
    // shadow
    ctx.beginPath();
    ctx.ellipse(PLAYER_X, PLAYER_Y + 12, 36, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    // hand circle holding saka
    ctx.beginPath();
    ctx.arc(PLAYER_X, PLAYER_Y, 28, 0, Math.PI * 2);
    ctx.fillStyle = "#3a2818";
    ctx.fill();
    ctx.strokeStyle = "#1a1008";
    ctx.lineWidth = 2;
    ctx.stroke();
    // saka in hand (if not active)
    if (!w.saka?.active) {
      ctx.save();
      ctx.translate(PLAYER_X, PLAYER_Y);
      const dx = w.aim.x - PLAYER_X, dy = w.aim.y - PLAYER_Y;
      ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2);
      drawSaka(ctx, saka);
      ctx.restore();
    }
  };

  // UI
  const st = stateRef.current;
  const isInvalid = false; void isInvalid;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <div className="relative" style={{ width: "min(100%, 1100px)" }}>
        {/* HUD top */}
        <div className="flex items-center justify-between mb-3 px-2">
          <button onClick={onExit} className="px-3 py-1.5 text-xs tracking-widest font-bold uppercase border border-border rounded hover:bg-secondary">← Exit</button>
          <div className="flex gap-6 text-sm font-mono">
            <div><span className="text-muted-foreground">SCORE </span><span className="text-gold display text-lg">{score.toLocaleString()}</span></div>
            <div><span className="text-muted-foreground">STREAK </span><span className="text-accent display text-lg">×{streak}</span></div>
            <div><span className="text-muted-foreground">ROUND </span><span className="display text-lg">{round}</span></div>
            <div><span className="text-muted-foreground">SHOTS </span><span className="display text-lg">{shotsLeft}</span></div>
          </div>
          <button onClick={() => { setPaused(p => { world.current.paused = !p; return !p; }); }} className="px-3 py-1.5 text-xs tracking-widest font-bold uppercase border border-border rounded hover:bg-secondary">{paused ? "Resume" : "Pause"}</button>
        </div>

        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ width: "100%", aspectRatio: `${W}/${H}`, cursor: charging ? "grabbing" : "crosshair", borderRadius: 12, border: "1px solid var(--color-border)", touchAction: "none" }}
        />

        {/* Bottom HUD: shot types + power + objective */}
        <div className="mt-3 grid grid-cols-3 gap-3 items-center">
          <div className="flex gap-2">
            {(["normal", "heavy", "curve"] as const).map((t, i) => (
              <button
                key={t}
                onClick={() => { setShotType(t); world.current.shotType = t; }}
                className={`flex-1 px-2 py-2 text-[10px] tracking-widest font-bold uppercase rounded border transition ${shotType === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}
              >
                <div>{t}</div>
                <div className="text-[9px] opacity-60 mt-0.5">[{i + 1}]</div>
              </button>
            ))}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 text-center">Power</div>
            <div className="h-3 bg-secondary rounded overflow-hidden border border-border">
              <div className="h-full transition-[width]" style={{
                width: `${power * 100}%`,
                background: `linear-gradient(90deg, #73ffb8, #ffd870 50%, #ff5a3a)`,
              }} />
            </div>
          </div>
          <div className="text-right">
            {objective && (
              <div className="text-xs">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Objective</div>
                <div className="text-accent font-bold">{objective.text} <span className="text-muted-foreground">+{objective.bonus}</span></div>
              </div>
            )}
          </div>
        </div>

        {paused && !gameOver && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-xl">
            <div className="text-center">
              <h2 className="display text-4xl text-gold mb-4">PAUSED</h2>
              <button onClick={() => { setPaused(false); world.current.paused = false; }} className="px-6 py-3 bg-primary text-primary-foreground font-bold tracking-widest uppercase rounded">Resume</button>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 bg-background/90 flex items-center justify-center z-10 rounded-xl">
            <div className="text-center max-w-md">
              <h2 className="display text-5xl text-gold mb-2">GAME OVER</h2>
              <p className="text-muted-foreground mb-6 tracking-wide">You reached round {round}</p>
              <div className="grid grid-cols-2 gap-4 mb-6 text-left">
                <div className="bg-card border border-border p-4 rounded">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Score</div>
                  <div className="display text-3xl text-gold">{score.toLocaleString()}</div>
                </div>
                <div className="bg-card border border-border p-4 rounded">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Best Streak</div>
                  <div className="display text-3xl text-accent">×{streak}</div>
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <button onClick={() => window.location.reload()} className="px-6 py-3 bg-primary text-primary-foreground font-bold tracking-widest uppercase rounded">Play Again</button>
                <button onClick={onExit} className="px-6 py-3 border border-border font-bold tracking-widest uppercase rounded hover:bg-secondary">Menu</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 text-[10px] tracking-widest uppercase text-muted-foreground">
        Move mouse to aim · Hold to charge · Release to throw · [1][2][3] shot type · [Esc] pause
      </div>
    </div>
  );
}
