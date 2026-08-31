/* ─────────────────────────────────────────────────────────────
   Zero-Dependency Canvas Confetti Particle Cannon
   - Spawns 80+ colorful particles: squares, circles, ribbons
   - Authentic Go brand palette: Go cyan #00ADD8, Gold #F59E0B,
     Emerald #10B981, Purple #8B5CF6, Coral #F43F5E, Amber #FBBF24
   - Physics: gravity, air drag, 3D spin/tumble, horizontal wobble
   - Fades smoothly over ~2.5s with zero idle CPU overhead
   - Auto-listens to gb:confetti custom event
   ───────────────────────────────────────────────────────────── */

export type ConfettiShape = "rect" | "circle" | "ribbon";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  shape: ConfettiShape;
  color: string;
  rotation: number;
  rotationSpeed: number;
  tilt: number;
  tiltSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  opacity: number;
  life: number;
  maxLife: number;
}

const COLORS = [
  "#00ADD8", // Go Cyan
  "#F59E0B", // Gold
  "#10B981", // Emerald
  "#8B5CF6", // Purple
  "#F43F5E", // Coral
  "#FBBF24", // Amber
  "#38BDF8", // Sky blue
  "#E0E7FF", // Soft pearl
];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let animationId: number | null = null;
let particles: Particle[] = [];

function ensureCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  if (!canvas) {
    const existing = document.getElementById("gb-confetti-canvas") as HTMLCanvasElement;
    if (existing) {
      canvas = existing;
    } else {
      canvas = document.createElement("canvas");
      canvas.id = "gb-confetti-canvas";
      canvas.style.position = "fixed";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "99999";
      document.body.appendChild(canvas);
    }
  }

  if (canvas && !ctx) {
    ctx = canvas.getContext("2d");
  }

  if (canvas && ctx) {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { canvas, ctx };
  }

  return null;
}

function updateAndDrawParticles(): void {
  const elements = ensureCanvas();
  if (!elements) return;
  const { ctx: c, canvas: can } = elements;

  const w = window.innerWidth;
  const h = window.innerHeight;

  c.clearRect(0, 0, w, h);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    // Advance physics
    p.life += 1;
    p.x += p.vx + Math.sin(p.wobble) * 1.5;
    p.y += p.vy;
    p.vy += 0.32; // gravity
    p.vx *= 0.982; // air drag
    p.vy *= 0.982;
    p.rotation += p.rotationSpeed;
    p.tilt += p.tiltSpeed;
    p.wobble += p.wobbleSpeed;

    // Fade out smoothly over life
    const lifeRatio = p.life / p.maxLife;
    p.opacity = Math.max(0, 1 - Math.pow(lifeRatio, 1.8));

    if (p.life >= p.maxLife || p.opacity <= 0.01 || p.y > h + 50) {
      particles.splice(i, 1);
      continue;
    }

    // Render particle with 3D projection
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.rotation);
    // 3D tilt flip effect via scale
    c.scale(Math.cos(p.tilt), 1);
    c.globalAlpha = p.opacity;
    c.fillStyle = p.color;

    if (p.shape === "circle") {
      c.beginPath();
      c.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      c.fill();
    } else if (p.shape === "ribbon") {
      c.fillRect(-p.size * 0.4, -p.size * 1.2, p.size * 0.8, p.size * 2.4);
    } else {
      // Default square / rectangle
      c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    }

    c.restore();
  }

  if (particles.length > 0) {
    animationId = requestAnimationFrame(updateAndDrawParticles);
  } else {
    c.clearRect(0, 0, w, h);
    animationId = null;
  }
}

/**
 * Triggers a burst of 80+ colorful confetti particles from an origin point.
 * @param x Origin horizontal coordinate (defaults to 50% screen width)
 * @param y Origin vertical coordinate (defaults to 40% screen height)
 * @param count Number of particles (defaults to 90)
 */
export function triggerConfetti(x?: number, y?: number, count: number = 90): void {
  if (typeof window === "undefined") return;

  const originX = x ?? window.innerWidth / 2;
  const originY = y ?? window.innerHeight * 0.42;

  const shapes: ConfettiShape[] = ["rect", "circle", "ribbon", "rect"];

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * Math.random()) - Math.PI / 2; // radial burst
    const speed = 7 + Math.random() * 12;
    const spread = (Math.random() - 0.5) * 1.2;

    const vx = Math.cos(angle + spread) * speed * (0.6 + Math.random() * 0.8);
    const vy = Math.sin(angle) * speed * (0.8 + Math.random() * 0.7) - 3.5;

    particles.push({
      x: originX + (Math.random() - 0.5) * 20,
      y: originY + (Math.random() - 0.5) * 20,
      vx,
      vy,
      size: 7 + Math.random() * 8,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.25,
      tilt: Math.random() * Math.PI,
      tiltSpeed: 0.08 + Math.random() * 0.12,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.08 + Math.random() * 0.1,
      opacity: 1,
      life: 0,
      maxLife: 110 + Math.floor(Math.random() * 45), // ~2.5s at 60fps
    });
  }

  if (!animationId) {
    animationId = requestAnimationFrame(updateAndDrawParticles);
  }
}

// Automatically bind window event listener in browser environment
if (typeof window !== "undefined") {
  window.addEventListener("gb:confetti", ((e: CustomEvent<{ x?: number; y?: number; count?: number }>) => {
    const { x, y, count } = e.detail || {};
    triggerConfetti(x, y, count ?? 90);
  }) as EventListener);
}
