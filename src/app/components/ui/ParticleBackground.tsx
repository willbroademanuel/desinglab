'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';

// ─── Grid ────────────────────────────────────────────────────────────────────
const GRID_SPACING = 35;
const DOT_SIZE = 1.5;

// ─── Hover repulsion ─────────────────────────────────────────────────────────
const HOVER_RADIUS_MAX = 250;
const HOVER_RADIUS_MIN = HOVER_RADIUS_MAX * 0.35;
const HOVER_RADIUS_DEFAULT = HOVER_RADIUS_MAX;
const REPULSION_STRENGTH = 4.0;
const SCROLL_STEP = 15;

// ─── Idle drift / spring ─────────────────────────────────────────────────────
const FRICTION = 0.91;
const DRIFT_SPEED = 0.0015;
const DRIFT_AMP = 5;
const TRUST_DELAY = 4000;
const SNAP_DELAY = 2000;

// ─── Charge / hold (mousedown) ───────────────────────────────────────────────
const CHARGE_RADIUS = 190;   // px — gather radius
const CHARGE_ATTRACT = 3.5;   // attraction strength toward cursor
const CHARGE_MIN_DIST = 22;    // px — don't push closer than this to cursor
const CHARGE_SCALE_MAX = 2.8;   // dots swell to this × DOT_SIZE at full charge
const CHARGE_SCALE_RATE = 0.05;  // how fast scale builds (lerp per frame)
const CHARGE_VIBRATION = 0.55;  // jitter intensity at full charge
const CHARGE_BUILD_RATE = 0.045; // how fast chargeLevel 0→1
const CHARGE_DECAY_RATE = 0.60;  // how fast chargeLevel drops when released

// ─── Particle separation (no-overlap during charge) ──────────────────────────
const SEP_PAD = 6;     // px extra gap between dot surfaces
const SEP_STRENGTH = 2.2;   // separation force magnitude

// ─── Shockwave (invisible — scale-only wave) ──────────────────────────────────
const SW_SPEED        = 45;
const SW_THICKNESS    = 60;
const SW_SCALE_BOOST  = 3.2;
const SW_SCALE_DECAY  = 0.20;
const SW_GLOW_BOOST   = 0.65;
const SW_SCATTER_FORCE= 15;

interface Shockwave {
  x: number; y: number;
  radius: number; maxRadius: number;
}

// ─── Neural connection lines ──────────────────────────────────────────────────
const CONNECTION_DIST = 72;
const CONNECTION_GLOW = 0.08;

// ─── Velocity trail ───────────────────────────────────────────────────────────
const TRAIL_SPEED_MIN = 1.2;
const TRAIL_MAX_OPACITY = 0.4;

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const dotColorRef = useRef('rgba(212,175,55,0.4)');
  const hoverRadiusRef = useRef(HOVER_RADIUS_DEFAULT);

  useEffect(() => {
    dotColorRef.current = resolvedTheme === 'light'
      ? 'rgba(212,175,55,0.85)'
      : 'rgba(212,175,55,0.4)';
  }, [resolvedTheme]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -SCROLL_STEP : SCROLL_STEP;
    hoverRadiusRef.current = Math.min(
      HOVER_RADIUS_MAX,
      Math.max(HOVER_RADIUS_MIN, hoverRadiusRef.current + delta),
    );
  }, []);

  useEffect(() => {
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];
    let shockwaves: Shockwave[] = [];
    let lastMouseMoveTime = Date.now();
    let isRepelling = true;
    let isMouseDown = false;

    const mouse = { x: -1000, y: -1000 };

    // ── Particle ────────────────────────────────────────────────────────────
    class Particle {
      x: number; y: number;
      baseX: number; baseY: number;
      vx: number; vy: number;
      prevX: number; prevY: number;
      phaseX: number; phaseY: number;
      glow: number;
      scale: number;
      chargeLevel: number; // 0–1, builds while held in radius

      constructor(x: number, y: number) {
        this.x = this.baseX = this.prevX = x;
        this.y = this.baseY = this.prevY = y;
        this.vx = this.vy = 0;
        this.phaseX = Math.random() * Math.PI * 2;
        this.phaseY = Math.random() * Math.PI * 2;
        this.glow = 0;
        this.scale = 1;
        this.chargeLevel = 0;
      }

      update(time: number, repelling: boolean, trustDuration: number) {
        this.prevX = this.x;
        this.prevY = this.y;

        // 1 ─ Idle drift target
        const targetX = this.baseX + Math.sin(time * DRIFT_SPEED + this.phaseX) * DRIFT_AMP;
        const targetY = this.baseY + Math.cos(time * DRIFT_SPEED + this.phaseY) * DRIFT_AMP;

        // 2 ─ Spring back toward target
        let k = 0.002;
        if (!repelling) {
          k = trustDuration < SNAP_DELAY
            ? 0.0005 + 0.015 * Math.pow(trustDuration / SNAP_DELAY, 3)
            : 0.08;
        }
        this.vx += (targetX - this.x) * k;
        this.vy += (targetY - this.y) * k;

        // 3 ─ Hover repulsion (suppressed while pressing)
        if (!isMouseDown && mouse.x !== -1000) {
          const r = hoverRadiusRef.current;
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (repelling && d < r && d > 0) {
            const force = Math.pow((r - d) / r, 2);
            this.vx += (dx / d) * force * REPULSION_STRENGTH;
            this.vy += (dy / d) * force * REPULSION_STRENGTH;
            this.glow = Math.min(1, this.glow + force * 0.2);
          }
        }

        // 4 ─ Charge while mousedown held
        if (isMouseDown && mouse.x !== -1000) {
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CHARGE_RADIUS) {
            // Build charge
            this.chargeLevel = Math.min(1, this.chargeLevel + CHARGE_BUILD_RATE);

            // Attract toward cursor, but honour min distance
            if (dist > CHARGE_MIN_DIST && dist > 0) {
              const t = (CHARGE_RADIUS - dist) / CHARGE_RADIUS;
              const force = Math.pow(t, 1.4);
              this.vx -= (dx / dist) * force * CHARGE_ATTRACT;
              this.vy -= (dy / dist) * force * CHARGE_ATTRACT;
            }

            // Vibration jitter — trembling under tension
            const jitter = this.chargeLevel * CHARGE_VIBRATION;
            this.vx += (Math.random() - 0.5) * jitter;
            this.vy += (Math.random() - 0.5) * jitter;

            // Swell scale toward charge max
            const targetScale = 1 + this.chargeLevel * (CHARGE_SCALE_MAX - 1);
            this.scale += (targetScale - this.scale) * CHARGE_SCALE_RATE;

            // Glow proportional to charge
            this.glow = Math.min(1, this.chargeLevel * 0.85);
          } else {
            // Outside radius — decay charge
            this.chargeLevel = Math.max(0, this.chargeLevel - CHARGE_DECAY_RATE);
          }
        } else {
          // Mouse not held — decay charge back to zero
          this.chargeLevel = Math.max(0, this.chargeLevel - CHARGE_DECAY_RATE);
        }

        // 5 ─ Invisible shockwave: scale-only bob + scatter
        for (const sw of shockwaves) {
          const dx = this.x - sw.x;
          const dy = this.y - sw.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const distFromFront = Math.abs(dist - sw.radius);
          if (distFromFront < SW_THICKNESS) {
            const sigma   = SW_THICKNESS * 0.35;
            const falloff = Math.exp(-(distFromFront ** 2) / (2 * sigma ** 2));
            const swScale = 1 + falloff * (SW_SCALE_BOOST - 1);
            if (swScale > this.scale) this.scale = swScale;
            this.glow = Math.min(1, this.glow + falloff * SW_GLOW_BOOST);
            
            // Randomize velocity when touched by the wave
            this.vx += (Math.random() - 0.5) * falloff * SW_SCATTER_FORCE;
            this.vy += (Math.random() - 0.5) * falloff * SW_SCATTER_FORCE;
          }
        }

        // 6 ─ Decay scale toward 1 (when no charge or wave)
        if (this.chargeLevel === 0 && this.scale > 1) {
          this.scale += (1 - this.scale) * (1 - SW_SCALE_DECAY);
          if (this.scale < 1.005) this.scale = 1;
        }

        // 7 ─ Decay glow
        if (this.glow > 0 && this.chargeLevel === 0) {
          this.glow *= 0.97;
          if (this.glow < 0.01) this.glow = 0;
        }

        // 8 ─ Integrate
        this.vx *= FRICTION;
        this.vy *= FRICTION;
        this.x += this.vx;
        this.y += this.vy;
      }

      draw() {
        if (!ctx) return;

        // Velocity trail
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > TRAIL_SPEED_MIN) {
          const alpha = Math.min(speed / 18, 1) * TRAIL_MAX_OPACITY;
          ctx.beginPath();
          ctx.moveTo(this.prevX, this.prevY);
          ctx.lineTo(this.x, this.y);
          ctx.strokeStyle = `rgba(212,175,55,${alpha})`;
          ctx.lineWidth = DOT_SIZE;
          ctx.stroke();
        }

        const r = DOT_SIZE * this.scale;

        // Glow halo
        if (this.glow > 0 || this.scale > 1.05) {
          const activity = Math.max(this.glow, (this.scale - 1) * 0.3);
          const glowR = r + activity * 8;
          const glowA = activity * 0.5;
          ctx.beginPath();
          ctx.arc(this.x, this.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212,175,55,${glowA})`;
          ctx.fill();
        }

        // Core dot
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fillStyle = dotColorRef.current;
        ctx.fill();
      }
    }

    // ── Particle separation — prevent overlap during charge ─────────────────
    // Only runs on charged particles for performance
    const applyParticleSeparation = () => {
      const charged = particles.filter(p => p.chargeLevel > 0.05);
      for (let i = 0; i < charged.length; i++) {
        for (let j = i + 1; j < charged.length; j++) {
          const pi = charged[i];
          const pj = charged[j];
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Min clearance = sum of their current visual radii + padding
          const minDist = (pi.scale + pj.scale) * DOT_SIZE + SEP_PAD;
          if (dist < minDist && dist > 0) {
            const push = ((minDist - dist) / minDist) * SEP_STRENGTH;
            pi.vx += (dx / dist) * push;
            pi.vy += (dy / dist) * push;
            pj.vx -= (dx / dist) * push;
            pj.vy -= (dy / dist) * push;
          }
        }
      }
    };

    // ── Neural connection lines ──────────────────────────────────────────────
    const drawConnections = () => {
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        const pi = particles[i];
        if (pi.glow < CONNECTION_GLOW && pi.scale < 1.05) continue;
        for (let j = i + 1; j < particles.length; j++) {
          const pj = particles[j];
          if (pj.glow < CONNECTION_GLOW && pj.scale < 1.05) continue;
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          if (Math.abs(dx) > CONNECTION_DIST || Math.abs(dy) > CONNECTION_DIST) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > CONNECTION_DIST) continue;
          const activity = (pi.glow + pj.glow) / 2 + ((pi.scale + pj.scale) / 2 - 1) * 0.3;
          const alpha = activity * (1 - dist / CONNECTION_DIST) * 0.5;
          ctx.beginPath();
          ctx.moveTo(pi.x, pi.y);
          ctx.lineTo(pj.x, pj.y);
          ctx.strokeStyle = `rgba(212,175,55,${alpha})`;
          ctx.stroke();
        }
      }
    };

    // ── Grid init ────────────────────────────────────────────────────────────
    const initParticles = () => {
      particles = [];
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);

      const W = window.innerWidth, H = window.innerHeight;
      const cols = Math.floor(W / GRID_SPACING);
      const rows = Math.floor(H / GRID_SPACING);
      const ox = (W - cols * GRID_SPACING) / 2;
      const oy = (H - rows * GRID_SPACING) / 2;

      for (let y = 0; y <= rows; y++)
        for (let x = 0; x <= cols; x++)
          particles.push(new Particle(ox + x * GRID_SPACING, oy + y * GRID_SPACING));
    };

    // ── Render loop ──────────────────────────────────────────────────────────
    const animate = (time: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // Advance & cull shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        shockwaves[i].radius += SW_SPEED;
        if (shockwaves[i].radius > shockwaves[i].maxRadius) shockwaves.splice(i, 1);
      }

      if (isMouseDown) {
        lastMouseMoveTime = Date.now();
      }

      const elapsed = Date.now() - lastMouseMoveTime;
      isRepelling = elapsed < TRUST_DELAY;
      const trustDuration = isRepelling ? 0 : elapsed - TRUST_DELAY;

      // Separation pass first (adjusts velocities before integration)
      if (isMouseDown) applyParticleSeparation();

      drawConnections();

      for (const p of particles) {
        p.update(time, isRepelling, trustDuration);
        p.draw();
      }

      animId = requestAnimationFrame(animate);
    };

    // ── Event handlers ───────────────────────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      lastMouseMoveTime = Date.now();
    };
    const onMouseLeave = () => { mouse.x = -1000; mouse.y = -1000; };
    const onMouseDown = () => { isMouseDown = true; };
    const onMouseUp = (e: MouseEvent) => {
      isMouseDown = false;
      const corners = [
        Math.hypot(e.clientX, e.clientY),
        Math.hypot(window.innerWidth - e.clientX, e.clientY),
        Math.hypot(e.clientX, window.innerHeight - e.clientY),
        Math.hypot(window.innerWidth - e.clientX, window.innerHeight - e.clientY),
      ];
      shockwaves.push({
        x: e.clientX,
        y: e.clientY,
        radius: 0,
        maxRadius: Math.max(...corners) + SW_THICKNESS,
      });
    };

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth >= 768) initParticles();
        else { particles = []; ctx.clearRect(0, 0, canvas.width, canvas.height); }
      }, 200);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseout', onMouseLeave);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);

    initParticles();
    requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseout', onMouseLeave);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 hidden md:block pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
