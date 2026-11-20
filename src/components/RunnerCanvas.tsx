import React, { useEffect, useRef, useCallback } from 'react';
import { soundEngine } from '../lib/audio';
import { getRunnerById } from '../lib/storage';
import type {
  CrashSnapshot,
  GameState,
  ObstacleKind,
  RunnerId,
} from '../types/game';

interface RunnerCanvasProps {
  gameState: GameState;
  runnerId: RunnerId;
  runId: string;
  reviveSignal: number;
  revivesUsed: number;
  maxRevivesPerRun: number;
  onHudUpdate: (hud: {
    distanceMeters: number;
    score: number;
    coinsCollected: number;
    speedKmh: number;
    shieldSeconds: number;
  }) => void;
  onCollision: (snapshot: CrashSnapshot) => void;
  onTogglePause: () => void;
}

interface ObstacleEntity {
  id: number;
  kind: ObstacleKind;
  lane: number; // 0, 1, 2
  z: number; // 1.0 = horizon, 0.0 = player
  passed: boolean;
}

interface CollectibleEntity {
  id: number;
  kind: 'coin' | 'shield';
  lane: number;
  z: number;
  elevated: boolean;
  collected: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const OBSTACLE_PROPS: Record<
  ObstacleKind,
  { jumpable: boolean; slideable: boolean; label: string }
> = {
  cone: { jumpable: true, slideable: false, label: 'Traffic Cone' },
  barrier: { jumpable: true, slideable: false, label: 'Road Barrier' },
  barrel: { jumpable: true, slideable: false, label: 'Hazard Drum' },
  overhead_sign: { jumpable: false, slideable: true, label: 'Overhead Gantry' },
  delivery_van: { jumpable: false, slideable: false, label: 'Stalled Van' },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r1 = (a >> 16) & 255;
  const g1 = (a >> 8) & 255;
  const b1 = a & 255;
  const r2 = (b >> 16) & 255;
  const g2 = (b >> 8) & 255;
  const b2 = b & 255;
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const bl = Math.round(lerp(b1, b2, t));
  return `rgb(${r}, ${g}, ${bl})`;
}

export const RunnerCanvas: React.FC<RunnerCanvasProps> = ({
  gameState,
  runnerId,
  runId,
  reviveSignal,
  revivesUsed,
  maxRevivesPerRun,
  onHudUpdate,
  onCollision,
  onTogglePause,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Latest callbacks in refs to avoid resetting simulation loop
  const gameStateRef = useRef<GameState>(gameState);
  const runnerIdRef = useRef<RunnerId>(runnerId);
  const revivesUsedRef = useRef<number>(revivesUsed);
  const onHudUpdateRef = useRef(onHudUpdate);
  const onCollisionRef = useRef(onCollision);
  const onTogglePauseRef = useRef(onTogglePause);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    runnerIdRef.current = runnerId;
  }, [runnerId]);

  useEffect(() => {
    revivesUsedRef.current = revivesUsed;
  }, [revivesUsed]);

  useEffect(() => {
    onHudUpdateRef.current = onHudUpdate;
  }, [onHudUpdate]);

  useEffect(() => {
    onCollisionRef.current = onCollision;
  }, [onCollision]);

  useEffect(() => {
    onTogglePauseRef.current = onTogglePause;
  }, [onTogglePause]);

  // Mutable simulation state
  const simRef = useRef({
    targetLane: 1,
    lanePos: 1,
    jumpHeight: 0, // 0..1.35 normalized
    jumpVel: 0,
    slideTimer: 0,
    shieldTimer: 0,
    distance: 0,
    score: 0,
    coins: 0,
    speed: 0.44, // z-units per second
    roadScroll: 0,
    spawnTimer: 0.9,
    entitySeq: 1,
    obstacles: [] as ObstacleEntity[],
    collectibles: [] as CollectibleEntity[],
    particles: [] as Particle[],
    lastHudSync: 0,
    runAnimPhase: 0,
    shakeTimer: 0,
  });

  const resetSimulation = useCallback(() => {
    const s = simRef.current;
    s.targetLane = 1;
    s.lanePos = 1;
    s.jumpHeight = 0;
    s.jumpVel = 0;
    s.slideTimer = 0;
    s.shieldTimer = 0;
    s.distance = 0;
    s.score = 0;
    s.coins = 0;
    s.speed = 0.44;
    s.roadScroll = 0;
    s.spawnTimer = 0.75;
    s.obstacles = [];
    s.collectibles = [];
    s.particles = [];
    s.lastHudSync = 0;
    s.runAnimPhase = 0;
    s.shakeTimer = 0;
    onHudUpdateRef.current({
      distanceMeters: 0,
      score: 0,
      coinsCollected: 0,
      speedKmh: 38,
      shieldSeconds: 0,
    });
  }, []);

  // Reset when runId changes (new run started)
  useEffect(() => {
    resetSimulation();
  }, [runId, resetSimulation]);

  // Revive rescue when reviveSignal increments
  useEffect(() => {
    if (reviveSignal <= 0) return;
    const s = simRef.current;
    // Clear immediate hazards in front of runner so revive is always fair
    s.obstacles = s.obstacles.filter((o) => o.z > 0.42);
    s.shieldTimer = 2.6;
    s.jumpHeight = 0;
    s.jumpVel = 0;
    s.slideTimer = 0;
    s.shakeTimer = 0;
    soundEngine.playRevive();
  }, [reviveSignal]);

  // Input action helpers
  const moveLeft = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    const s = simRef.current;
    if (s.targetLane > 0) {
      s.targetLane -= 1;
      soundEngine.playLaneSwitch();
    }
  }, []);

  const moveRight = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    const s = simRef.current;
    if (s.targetLane < 2) {
      s.targetLane += 1;
      soundEngine.playLaneSwitch();
    }
  }, []);

  const triggerJump = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    const s = simRef.current;
    if (s.jumpHeight <= 0.02) {
      s.jumpVel = 3.55;
      s.slideTimer = 0;
      soundEngine.playJump();
    }
  }, []);

  const triggerSlide = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    const s = simRef.current;
    if (s.jumpHeight > 0.05) {
      // Fast drop in midair
      s.jumpVel = -4.8;
    } else {
      s.slideTimer = 0.62;
      soundEngine.playSlide();
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        moveLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        moveRight();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
        if (gameStateRef.current === 'PLAYING') {
          e.preventDefault();
          triggerJump();
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        if (gameStateRef.current === 'PLAYING') {
          e.preventDefault();
          triggerSlide();
        }
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (gameStateRef.current === 'PLAYING' || gameStateRef.current === 'PAUSED') {
          e.preventDefault();
          onTogglePauseRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveLeft, moveRight, triggerJump, triggerSlide]);

  // Touch swipe controls on canvas
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    const threshold = 26;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) moveLeft();
      else moveRight();
    } else {
      if (dy < 0) triggerJump();
      else triggerSlide();
    }
    touchStartRef.current = null;
  };

  // Main animation & simulation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(320, Math.floor(rect.width * dpr));
      canvas.height = Math.max(360, Math.floor(rect.height * dpr));
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const spawnWave = () => {
      const s = simRef.current;
      const roll = Math.random();
      const pickKind = (): ObstacleKind => {
        const r = Math.random();
        if (r < 0.24) return 'cone';
        if (r < 0.48) return 'barrier';
        if (r < 0.68) return 'overhead_sign';
        if (r < 0.85) return 'barrel';
        return 'delivery_van';
      };

      const occupiedLanes = new Set<number>();

      if (roll < 0.52) {
        // Single obstacle in 1 lane + coin line in another
        const lane = Math.floor(Math.random() * 3);
        const kind = pickKind();
        s.obstacles.push({
          id: s.entitySeq++,
          kind,
          lane,
          z: 1.04,
          passed: false,
        });
        occupiedLanes.add(lane);
      } else if (roll < 0.88) {
        // Two lanes have obstacles, at least 1 lane completely open
        const safeLane = Math.floor(Math.random() * 3);
        for (let lane = 0; lane < 3; lane++) {
          if (lane === safeLane) continue;
          const kind = pickKind();
          s.obstacles.push({
            id: s.entitySeq++,
            kind,
            lane,
            z: 1.04 + (Math.random() * 0.04 - 0.02),
            passed: false,
          });
          occupiedLanes.add(lane);
        }
      } else {
        // All 3 lanes have jumpable or slideable obstacles (never all vans)
        const jumpableKinds: ObstacleKind[] = ['cone', 'barrier', 'barrel', 'overhead_sign'];
        for (let lane = 0; lane < 3; lane++) {
          const kind = jumpableKinds[Math.floor(Math.random() * jumpableKinds.length)];
          s.obstacles.push({
            id: s.entitySeq++,
            kind,
            lane,
            z: 1.04,
            passed: false,
          });
          occupiedLanes.add(lane);
        }
      }

      // Spawn coins or occasional shield in a safe lane
      const freeLanes = [0, 1, 2].filter((l) => !occupiedLanes.has(l));
      const coinLane =
        freeLanes.length > 0
          ? freeLanes[Math.floor(Math.random() * freeLanes.length)]
          : Math.floor(Math.random() * 3);
      const elevated = freeLanes.length === 0;

      if (Math.random() < 0.075 && s.shieldTimer <= 0) {
        s.collectibles.push({
          id: s.entitySeq++,
          kind: 'shield',
          lane: coinLane,
          z: 1.06,
          elevated: false,
          collected: false,
        });
      } else if (Math.random() < 0.72) {
        for (let i = 0; i < 3; i++) {
          s.collectibles.push({
            id: s.entitySeq++,
            kind: 'coin',
            lane: coinLane,
            z: 1.04 + i * 0.055,
            elevated,
            collected: false,
          });
        }
      }
    };

    const spawnImpactParticles = (x: number, y: number, color: string, count = 16) => {
      const s = simRef.current;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const spd = 80 + Math.random() * 220;
        s.particles.push({
          x,
          y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 60,
          life: 0.45 + Math.random() * 0.35,
          maxLife: 0.8,
          color,
          size: 3 + Math.random() * 4,
        });
      }
    };

    const project = (z: number, w: number, h: number) => {
      const horizonY = h * 0.24;
      const playerY = h * 0.86;
      const tFar = 1 / (1 + 1.0 * 5.6);
      const t = 1 / (1 + z * 5.6);
      const u = (t - tFar) / (1 - tFar);
      const y = horizonY + u * (playerY - horizonY);
      const roadHalfAtPlayer = Math.min(w * 0.41, h * 0.46);
      return { y, scale: t, roadHalfAtPlayer };
    };

    const renderScene = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const s = simRef.current;
      const state = gameStateRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Update simulation only while actively playing (or gentle idle road roll on title)
      if (state === 'TITLE_MENU') {
        s.roadScroll = (s.roadScroll + dt * 0.35) % 1;
        s.runAnimPhase += dt * 7;
      } else if (state === 'PLAYING') {
        // Gradual speed progression
        s.speed = Math.min(0.92, 0.44 + s.distance * 0.00032);
        const metersDelta = s.speed * 42 * dt;
        s.distance += metersDelta;
        s.score += metersDelta * 10;
        s.roadScroll = (s.roadScroll + s.speed * 2.4 * dt) % 1;
        s.runAnimPhase += dt * (9 + s.speed * 10);

        // Smooth lane transition
        s.lanePos += (s.targetLane - s.lanePos) * Math.min(1, dt * 16);

        // Jump physics
        if (s.jumpHeight > 0 || s.jumpVel !== 0) {
          s.jumpHeight += s.jumpVel * dt;
          s.jumpVel -= 11.2 * dt;
          if (s.jumpHeight <= 0) {
            s.jumpHeight = 0;
            s.jumpVel = 0;
          }
        }

        if (s.slideTimer > 0) {
          s.slideTimer = Math.max(0, s.slideTimer - dt);
        }
        if (s.shieldTimer > 0) {
          s.shieldTimer = Math.max(0, s.shieldTimer - dt);
        }
        if (s.shakeTimer > 0) {
          s.shakeTimer = Math.max(0, s.shakeTimer - dt);
        }

        // Spawn obstacles
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
          spawnWave();
          const minInterval = 0.56;
          const maxInterval = Math.max(0.75, 1.32 - (s.speed - 0.44) * 1.1);
          s.spawnTimer = lerp(minInterval, maxInterval, Math.random());
        }

        // Move obstacles & check collisions
        for (const obs of s.obstacles) {
          obs.z -= s.speed * dt;

          if (!obs.passed && obs.z < -0.04) {
            obs.passed = true;
            s.score += 15;
          }

          if (obs.z <= 0.045 && obs.z >= -0.025) {
            const laneDiff = Math.abs(s.lanePos - obs.lane);
            if (laneDiff < 0.42) {
              const props = OBSTACLE_PROPS[obs.kind];
              const clearedJump = props.jumpable && s.jumpHeight > 0.36;
              const clearedSlide = props.slideable && s.slideTimer > 0.04;

              if (!clearedJump && !clearedSlide) {
                if (s.shieldTimer > 0) {
                  // Shield absorbs hit safely
                  obs.z = -0.3;
                  s.shieldTimer = Math.max(0.25, s.shieldTimer - 1.1);
                  const { y, roadHalfAtPlayer } = project(0, w, h);
                  const laneX = w / 2 + (s.lanePos - 1) * (roadHalfAtPlayer * 0.62);
                  spawnImpactParticles(laneX, y - 35 * dpr, '#10B981', 14);
                  soundEngine.playShield();
                } else {
                  // Obstacle hit -> trigger Continue popup!
                  s.shakeTimer = 0.25;
                  const { y, roadHalfAtPlayer } = project(0, w, h);
                  const laneX = w / 2 + (s.lanePos - 1) * (roadHalfAtPlayer * 0.62);
                  spawnImpactParticles(laneX, y - 30 * dpr, '#F59E0B', 20);
                  soundEngine.playCrash();
                  onHudUpdateRef.current({
                    distanceMeters: Math.floor(s.distance),
                    score: Math.floor(s.score),
                    coinsCollected: s.coins,
                    speedKmh: Math.round(s.speed * 115),
                    shieldSeconds: Number(s.shieldTimer.toFixed(1)),
                  });
                  onCollisionRef.current({
                    distanceMeters: Math.floor(s.distance),
                    score: Math.floor(s.score),
                    coinsCollected: s.coins,
                    revivesUsed: revivesUsedRef.current,
                    maxRevivesPerRun,
                    obstacleHit: obs.kind,
                  });
                  break;
                }
              }
            }
          }
        }
        s.obstacles = s.obstacles.filter((o) => o.z > -0.18);

        // Move collectibles
        for (const item of s.collectibles) {
          item.z -= s.speed * dt;
          if (!item.collected && item.z <= 0.06 && item.z >= -0.04) {
            const laneDiff = Math.abs(s.lanePos - item.lane);
            const heightOk = !item.elevated || s.jumpHeight > 0.22;
            if (laneDiff < 0.48 && heightOk) {
              item.collected = true;
              const { y, roadHalfAtPlayer } = project(0, w, h);
              const laneX = w / 2 + (item.lane - 1) * (roadHalfAtPlayer * 0.62);
              if (item.kind === 'coin') {
                s.coins += 1;
                s.score += 25;
                spawnImpactParticles(laneX, y - 40 * dpr, '#FBBF24', 8);
                soundEngine.playCoin();
              } else {
                s.shieldTimer = 6.0;
                s.score += 50;
                spawnImpactParticles(laneX, y - 40 * dpr, '#10B981', 12);
                soundEngine.playShield();
              }
            }
          }
        }
        s.collectibles = s.collectibles.filter((c) => !c.collected && c.z > -0.15);

        // Sync HUD every ~80ms
        if (now - s.lastHudSync > 80) {
          s.lastHudSync = now;
          onHudUpdateRef.current({
            distanceMeters: Math.floor(s.distance),
            score: Math.floor(s.score),
            coinsCollected: s.coins,
            speedKmh: Math.round(s.speed * 115),
            shieldSeconds: Number(s.shieldTimer.toFixed(1)),
          });
        }
      }

      // Particles update even during collision freeze briefly
      for (const p of s.particles) {
        p.x += p.vx * dt * dpr;
        p.y += p.vy * dt * dpr;
        p.vy += 420 * dt * dpr;
        p.life -= dt;
      }
      s.particles = s.particles.filter((p) => p.life > 0);

      // --- DRAW SCENE ---
      ctx.save();
      if (s.shakeTimer > 0 && state === 'COLLISION_CONTINUE') {
        const mag = 5 * dpr;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      // Biome cycle every 450m
      const cycle = (s.distance % 1200) / 1200;
      let skyTop = '#0F172A';
      let skyBottom = '#1E293B';
      let groundColor = '#111827';
      let roadColor = '#1E2430';
      if (cycle < 0.35) {
        // Crisp dawn highway
        skyTop = '#0F172A';
        skyBottom = '#334155';
        groundColor = '#13201B';
        roadColor = '#1F2937';
      } else if (cycle < 0.7) {
        // Golden sunset expressway
        const t = Math.min(1, (cycle - 0.35) / 0.15);
        skyTop = lerpColor('#0F172A', '#1E1B4B', t);
        skyBottom = lerpColor('#334155', '#9A3412', t);
        groundColor = '#1C1917';
        roadColor = '#27272A';
      } else {
        // Midnight expressway
        const t = Math.min(1, (cycle - 0.7) / 0.15);
        skyTop = lerpColor('#1E1B4B', '#020617', t);
        skyBottom = lerpColor('#9A3412', '#0F172A', t);
        groundColor = '#090D16';
        roadColor = '#111827';
      }

      const horizonY = h * 0.24;

      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, skyTop);
      skyGrad.addColorStop(1, skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY + 2);

      // Subtle horizon sun/moon disc & skyline silhouette
      ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
      ctx.beginPath();
      ctx.arc(w * 0.5, horizonY - 12 * dpr, 48 * dpr, Math.PI, 0);
      ctx.fill();

      // Distant city silhouette
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      const bWidths = [42, 28, 56, 34, 62, 30, 48, 38, 52, 44, 32];
      let bx = (w * 0.5) - 260 * dpr;
      for (let i = 0; i < bWidths.length; i++) {
        const bw = bWidths[i] * dpr;
        const bh = (18 + ((i * 23) % 34)) * dpr;
        ctx.fillRect(bx, horizonY - bh, bw - 3 * dpr, bh);
        bx += bw;
      }

      // Ground plane below horizon
      ctx.fillStyle = groundColor;
      ctx.fillRect(0, horizonY, w, h - horizonY);

      // Road trapezoid
      const nearProj = project(0, w, h);
      const farProj = project(1.0, w, h);
      const nearHalf = nearProj.roadHalfAtPlayer * 1.12;
      const farHalf = nearProj.roadHalfAtPlayer * farProj.scale * 1.12;

      // Road shoulders
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(w / 2 - farHalf - 10 * dpr * farProj.scale, horizonY);
      ctx.lineTo(w / 2 + farHalf + 10 * dpr * farProj.scale, horizonY);
      ctx.lineTo(w / 2 + nearHalf + 22 * dpr, h);
      ctx.lineTo(w / 2 - nearHalf - 22 * dpr, h);
      ctx.closePath();
      ctx.fill();

      // Road asphalt surface
      ctx.fillStyle = roadColor;
      ctx.beginPath();
      ctx.moveTo(w / 2 - farHalf, horizonY);
      ctx.lineTo(w / 2 + farHalf, horizonY);
      ctx.lineTo(w / 2 + nearHalf, h);
      ctx.lineTo(w / 2 - nearHalf, h);
      ctx.closePath();
      ctx.fill();

      // Shoulder yellow/white edge lines
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      ctx.moveTo(w / 2 - farHalf * 0.94, horizonY);
      ctx.lineTo(w / 2 - nearHalf * 0.94, h);
      ctx.moveTo(w / 2 + farHalf * 0.94, horizonY);
      ctx.lineTo(w / 2 + nearHalf * 0.94, h);
      ctx.stroke();

      // Dashed lane dividers (3 lanes -> 2 inner dividers)
      const numDashes = 12;
      for (let i = 0; i < numDashes; i++) {
        const zStart = (i / numDashes + (1 - s.roadScroll) / numDashes) % 1;
        const zEnd = Math.min(1, zStart + 0.045);
        if (zEnd <= zStart) continue;
        const p1 = project(zStart, w, h);
        const p2 = project(zEnd, w, h);
        const laneOffset1 = p1.roadHalfAtPlayer * p1.scale * 0.34;
        const laneOffset2 = p2.roadHalfAtPlayer * p2.scale * 0.34;

        ctx.strokeStyle = 'rgba(248, 250, 252, 0.62)';
        ctx.lineWidth = Math.max(1.5, 4 * dpr * p1.scale);
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(w / 2 + side * laneOffset1, p1.y);
          ctx.lineTo(w / 2 + side * laneOffset2, p2.y);
          ctx.stroke();
        }
      }

      // Roadside guardrail posts & street lamps for speed sensation
      for (let i = 0; i < 8; i++) {
        const z = (i / 8 + (1 - s.roadScroll) / 8) % 1;
        const p = project(z, w, h);
        const postXOffset = p.roadHalfAtPlayer * p.scale * 1.24;
        const postH = 44 * dpr * p.scale;
        const postW = 4 * dpr * p.scale;
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.fillRect(w / 2 - postXOffset - postW / 2, p.y - postH, postW, postH);
        ctx.fillRect(w / 2 + postXOffset - postW / 2, p.y - postH, postW, postH);

        // Amber reflector on post
        ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.fillRect(
          w / 2 - postXOffset - postW * 0.6,
          p.y - postH * 0.72,
          postW * 1.2,
          postH * 0.16
        );
        ctx.fillRect(
          w / 2 + postXOffset - postW * 0.6,
          p.y - postH * 0.72,
          postW * 1.2,
          postH * 0.16
        );
      }

      // Draw Collectibles & Obstacles sorted far-to-near
      type DrawItem =
        | { type: 'obs'; z: number; item: ObstacleEntity }
        | { type: 'col'; z: number; item: CollectibleEntity };

      const drawList: DrawItem[] = [
        ...s.obstacles.map((item) => ({ type: 'obs' as const, z: item.z, item })),
        ...s.collectibles.map((item) => ({ type: 'col' as const, z: item.z, item })),
      ].sort((a, b) => b.z - a.z);

      for (const entry of drawList) {
        if (entry.z > 1.02 || entry.z < -0.08) continue;
        const p = project(entry.z, w, h);
        const laneSpacing = p.roadHalfAtPlayer * p.scale * 0.62;
        const cx = w / 2 + (entry.item.lane - 1) * laneSpacing;
        const sc = p.scale * dpr;

        if (entry.type === 'col') {
          const col = entry.item;
          const elev = col.elevated ? 54 * sc : 22 * sc;
          const bob = Math.sin(now * 0.008 + col.id) * 4 * sc;
          // Shadow
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.ellipse(cx, p.y, 12 * sc, 4 * sc, 0, 0, Math.PI * 2);
          ctx.fill();

          if (col.kind === 'coin') {
            ctx.fillStyle = '#F59E0B';
            ctx.beginPath();
            ctx.arc(cx, p.y - elev + bob, 14 * sc, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FEF3C7';
            ctx.lineWidth = 2.5 * sc;
            ctx.stroke();
            ctx.fillStyle = '#FEF3C7';
            ctx.fillRect(cx - 2 * sc, p.y - elev + bob - 6 * sc, 4 * sc, 12 * sc);
          } else {
            // Shield pickup
            ctx.fillStyle = '#10B981';
            ctx.beginPath();
            ctx.arc(cx, p.y - elev + bob, 16 * sc, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ECFDF5';
            ctx.lineWidth = 2.5 * sc;
            ctx.stroke();
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `700 ${Math.max(8, Math.round(13 * sc))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('S', cx, p.y - elev + bob + 1 * sc);
          }
        } else {
          const obs = entry.item;
          // Ground shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
          ctx.beginPath();
          ctx.ellipse(cx, p.y, 28 * sc, 8 * sc, 0, 0, Math.PI * 2);
          ctx.fill();

          if (obs.kind === 'cone') {
            // Traffic cone
            ctx.fillStyle = '#EA580C';
            ctx.beginPath();
            ctx.moveTo(cx - 18 * sc, p.y);
            ctx.lineTo(cx - 5 * sc, p.y - 44 * sc);
            ctx.lineTo(cx + 5 * sc, p.y - 44 * sc);
            ctx.lineTo(cx + 18 * sc, p.y);
            ctx.closePath();
            ctx.fill();
            // White reflective stripe
            ctx.fillStyle = '#F8FAFC';
            ctx.beginPath();
            ctx.moveTo(cx - 11 * sc, p.y - 16 * sc);
            ctx.lineTo(cx - 8 * sc, p.y - 28 * sc);
            ctx.lineTo(cx + 8 * sc, p.y - 28 * sc);
            ctx.lineTo(cx + 11 * sc, p.y - 16 * sc);
            ctx.closePath();
            ctx.fill();
            // Base plate
            ctx.fillStyle = '#1E293B';
            ctx.fillRect(cx - 21 * sc, p.y - 5 * sc, 42 * sc, 6 * sc);
          } else if (obs.kind === 'barrier') {
            // Construction barrier (jumpable)
            ctx.fillStyle = '#475569';
            ctx.fillRect(cx - 32 * sc, p.y - 38 * sc, 6 * sc, 38 * sc);
            ctx.fillRect(cx + 26 * sc, p.y - 38 * sc, 6 * sc, 38 * sc);
            ctx.fillStyle = '#F59E0B';
            ctx.fillRect(cx - 38 * sc, p.y - 40 * sc, 76 * sc, 18 * sc);
            // Diagonal hazard stripes
            ctx.fillStyle = '#0F172A';
            for (let k = -26; k <= 20; k += 18) {
              ctx.beginPath();
              ctx.moveTo(cx + k * sc, p.y - 40 * sc);
              ctx.lineTo(cx + (k + 8) * sc, p.y - 40 * sc);
              ctx.lineTo(cx + (k + 2) * sc, p.y - 22 * sc);
              ctx.lineTo(cx + (k - 6) * sc, p.y - 22 * sc);
              ctx.closePath();
              ctx.fill();
            }
          } else if (obs.kind === 'barrel') {
            // Hazard drum
            ctx.fillStyle = '#DC2626';
            ctx.fillRect(cx - 22 * sc, p.y - 46 * sc, 44 * sc, 46 * sc);
            ctx.fillStyle = '#F8FAFC';
            ctx.fillRect(cx - 22 * sc, p.y - 28 * sc, 44 * sc, 9 * sc);
            ctx.fillStyle = '#7F1D1D';
            ctx.beginPath();
            ctx.ellipse(cx, p.y - 46 * sc, 22 * sc, 6 * sc, 0, 0, Math.PI * 2);
            ctx.fill();
          } else if (obs.kind === 'overhead_sign') {
            // Overhead gantry sign: high bar, clear gap underneath for sliding!
            ctx.fillStyle = '#64748B';
            ctx.fillRect(cx - 42 * sc, p.y - 96 * sc, 7 * sc, 96 * sc);
            ctx.fillRect(cx + 35 * sc, p.y - 96 * sc, 7 * sc, 96 * sc);
            // Sign board suspended high (bottom at -42*sc -> slide under!)
            ctx.fillStyle = '#0284C7';
            ctx.fillRect(cx - 44 * sc, p.y - 94 * sc, 88 * sc, 46 * sc);
            ctx.strokeStyle = '#E0F2FE';
            ctx.lineWidth = 2.5 * sc;
            ctx.strokeRect(cx - 41 * sc, p.y - 91 * sc, 82 * sc, 40 * sc);
            // Down-arrow / DUCK cue
            ctx.fillStyle = '#FEF08A';
            ctx.font = `800 ${Math.max(8, Math.round(13 * sc))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('DUCK', cx, p.y - 71 * sc);
          } else if (obs.kind === 'delivery_van') {
            // Tall delivery van: must switch lane
            const vw = 72 * sc;
            const vh = 82 * sc;
            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(cx - vw / 2, p.y - vh, vw, vh - 12 * sc);
            // Rear doors & bumper
            ctx.strokeStyle = '#94A3B8';
            ctx.lineWidth = 2 * sc;
            ctx.beginPath();
            ctx.moveTo(cx, p.y - vh + 4 * sc);
            ctx.lineTo(cx, p.y - 16 * sc);
            ctx.stroke();
            // Dark bumper & wheels
            ctx.fillStyle = '#1E293B';
            ctx.fillRect(cx - vw / 2 - 2 * sc, p.y - 16 * sc, vw + 4 * sc, 8 * sc);
            ctx.fillStyle = '#090D16';
            ctx.fillRect(cx - vw / 2 + 4 * sc, p.y - 10 * sc, 14 * sc, 10 * sc);
            ctx.fillRect(cx + vw / 2 - 18 * sc, p.y - 10 * sc, 14 * sc, 10 * sc);
            // Red tail lights
            ctx.fillStyle = '#EF4444';
            ctx.fillRect(cx - vw / 2 + 5 * sc, p.y - 26 * sc, 11 * sc, 7 * sc);
            ctx.fillRect(cx + vw / 2 - 16 * sc, p.y - 26 * sc, 11 * sc, 7 * sc);
            // Amber roof beacon
            ctx.fillStyle = '#F59E0B';
            ctx.fillRect(cx - 10 * sc, p.y - vh - 5 * sc, 20 * sc, 5 * sc);
          }
        }
      }

      // --- DRAW RUNNER ---
      const runnerDef = getRunnerById(runnerIdRef.current);
      const pRunner = project(0, w, h);
      const runnerLaneSpacing = pRunner.roadHalfAtPlayer * 0.62;
      const rx = w / 2 + (s.lanePos - 1) * runnerLaneSpacing;
      const ryGround = pRunner.y;
      const jumpPx = s.jumpHeight * 88 * dpr;
      const ry = ryGround - jumpPx;
      const isSliding = s.slideTimer > 0 && s.jumpHeight <= 0.05;
      const tilt = (s.targetLane - s.lanePos) * 0.22;

      // Runner shadow
      const shadowScale = Math.max(0.45, 1 - s.jumpHeight * 0.45);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(rx, ryGround + 2 * dpr, 24 * dpr * shadowScale, 8 * dpr * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Active Shield Aura
      if (s.shieldTimer > 0) {
        const blink = s.shieldTimer > 0.9 || Math.floor(now / 120) % 2 === 0;
        if (blink) {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
          ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
          ctx.lineWidth = 3 * dpr;
          ctx.beginPath();
          ctx.arc(rx, ry - 32 * dpr, 42 * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(tilt);
      if (isSliding) {
        ctx.scale(1.18, 0.54);
      }

      const stride = Math.sin(s.runAnimPhase) * 9 * dpr;

      if (runnerIdRef.current === 'scooter') {
        // Turbo Scooter sprite
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(0, -10 * dpr, 10 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = runnerDef.accentColor;
        ctx.fillRect(-16 * dpr, -36 * dpr, 32 * dpr, 24 * dpr);
        // Rider helmet & jacket
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-12 * dpr, -62 * dpr, 24 * dpr, 26 * dpr);
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(0, -72 * dpr, 12 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-8 * dpr, -75 * dpr, 16 * dpr, 6 * dpr);
        // Taillight glow
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-12 * dpr, -26 * dpr, 24 * dpr, 5 * dpr);
      } else if (runnerIdRef.current === 'courier_bot') {
        // Autonomous Delivery Bot
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-20 * dpr, -16 * dpr, 8 * dpr, 16 * dpr);
        ctx.fillRect(12 * dpr, -16 * dpr, 8 * dpr, 16 * dpr);
        // Cargo chassis
        ctx.fillStyle = runnerDef.accentColor;
        ctx.fillRect(-18 * dpr, -52 * dpr, 36 * dpr, 38 * dpr);
        // Visor head
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-13 * dpr, -72 * dpr, 26 * dpr, 18 * dpr);
        ctx.fillStyle = '#34D399';
        ctx.fillRect(-9 * dpr, -66 * dpr, 18 * dpr, 6 * dpr);
      } else if (runnerIdRef.current === 'street_fox') {
        // Nimble Red Fox runner
        // Tail
        ctx.fillStyle = '#EA580C';
        ctx.beginPath();
        ctx.ellipse(-10 * dpr, -24 * dpr + stride * 0.4, 10 * dpr, 18 * dpr, -0.4, 0, Math.PI * 2);
        ctx.fill();
        // Legs
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-11 * dpr, -20 * dpr + stride * 0.5, 7 * dpr, 20 * dpr);
        ctx.fillRect(4 * dpr, -20 * dpr - stride * 0.5, 7 * dpr, 20 * dpr);
        // Jacket torso
        ctx.fillStyle = '#EA580C';
        ctx.fillRect(-13 * dpr, -52 * dpr, 26 * dpr, 32 * dpr);
        // Ears + head
        ctx.beginPath();
        ctx.moveTo(-12 * dpr, -68 * dpr);
        ctx.lineTo(-14 * dpr, -86 * dpr);
        ctx.lineTo(-2 * dpr, -74 * dpr);
        ctx.moveTo(12 * dpr, -68 * dpr);
        ctx.lineTo(14 * dpr, -86 * dpr);
        ctx.lineTo(2 * dpr, -74 * dpr);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -64 * dpr, 13 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF3C7';
        ctx.beginPath();
        ctx.arc(0, -60 * dpr, 7 * dpr, 0, Math.PI);
        ctx.fill();
      } else {
        // Default: Street Sprinter
        // Running legs
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-11 * dpr, -22 * dpr + stride * 0.6, 8 * dpr, 22 * dpr);
        ctx.fillRect(3 * dpr, -22 * dpr - stride * 0.6, 8 * dpr, 22 * dpr);
        // Sneakers
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(-12 * dpr, -6 * dpr + stride * 0.6, 10 * dpr, 6 * dpr);
        ctx.fillRect(2 * dpr, -6 * dpr - stride * 0.6, 10 * dpr, 6 * dpr);
        // Runner jacket
        ctx.fillStyle = runnerDef.accentColor;
        ctx.fillRect(-14 * dpr, -54 * dpr, 28 * dpr, 33 * dpr);
        // High-vis stripe on back
        ctx.fillStyle = '#FEF3C7';
        ctx.fillRect(-14 * dpr, -42 * dpr, 28 * dpr, 5 * dpr);
        // Swinging arms
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-20 * dpr, -50 * dpr - stride * 0.4, 6 * dpr, 22 * dpr);
        ctx.fillRect(14 * dpr, -50 * dpr + stride * 0.4, 6 * dpr, 22 * dpr);
        // Head / Cap
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(0, -66 * dpr, 11 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(0, -69 * dpr, 11 * dpr, Math.PI, 0);
        ctx.fill();
      }
      ctx.restore();

      // Draw Particles
      for (const p of s.particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - (p.size * dpr) / 2, p.y - (p.size * dpr) / 2, p.size * dpr, p.size * dpr);
      }
      ctx.globalAlpha = 1;

      ctx.restore();
      animId = requestAnimationFrame(renderScene);
    };

    animId = requestAnimationFrame(renderScene);
    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, [maxRevivesPerRun]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      className="relative w-full h-full select-none overflow-hidden touch-none bg-slate-950"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Touch / quick-tap lane & action controls for mobile & mouse accessibility during active play */}
      {gameState === 'PLAYING' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-between px-4 md:hidden">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={moveLeft}
              aria-label="Move Left"
              className="h-12 w-12 rounded-lg bg-slate-900/75 border border-slate-700/80 text-slate-100 font-semibold active:scale-95 transition-transform"
            >
              ←
            </button>
            <button
              type="button"
              onClick={moveRight}
              aria-label="Move Right"
              className="h-12 w-12 rounded-lg bg-slate-900/75 border border-slate-700/80 text-slate-100 font-semibold active:scale-95 transition-transform"
            >
              →
            </button>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={triggerSlide}
              aria-label="Slide"
              className="h-12 px-4 rounded-lg bg-slate-900/75 border border-slate-700/80 text-slate-100 text-xs font-semibold active:scale-95 transition-transform"
            >
              Duck
            </button>
            <button
              type="button"
              onClick={triggerJump}
              aria-label="Jump"
              className="h-12 px-4 rounded-lg bg-amber-500/90 text-slate-950 text-xs font-bold active:scale-95 transition-transform"
            >
              Jump
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
