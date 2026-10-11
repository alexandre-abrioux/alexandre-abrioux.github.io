import { type Palette, palettes } from "../palettes";
import type { Position, Size } from "../types";
import Blob from "./Blob";
import Species from "./Species";

export default class Scene {
  private static readonly initBlobs = 10;
  private static readonly maxBlobs = 200;
  private static readonly smallScreenMaxBlobs = 80;
  private static readonly smallScreenQuery = "(max-width: 640px)";
  private static readonly initSpecies = 5;
  private static readonly duplicateInterval = 200;
  private static readonly duplicateMinFps = 50;
  private static readonly debugInterval = 500;
  private static readonly blobOpacity = 0.9;
  private static readonly maxPixelRatio = 2;
  private static readonly deviceShakeThreshold = 12;
  private static readonly deviceShakeStrength = 3;
  private static readonly deviceMotionMaxIntervalMs = 100;
  private static readonly deviceTiltStrength = 0.0005;
  private static readonly deviceTiltSmoothingMs = 100;
  private static readonly deviceTiltRestMs = 500;
  private static singleton?: Scene;

  public static get instance(): Scene {
    Scene.singleton ??= new Scene();
    return Scene.singleton;
  }

  public readonly viewport: Size = { width: 0, height: 0 };
  public pixelRatio = Scene.measurePixelRatio();

  private palette: Palette;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private species: Species[] = [];
  private blobs: Blob[] = [];
  private loopTime = 0;
  private animatedAt = 0;
  private duplicatedAt = 0;
  private pausedAt?: number = performance.now();
  private pausedDuration = 0;
  private cursor?: Position;
  private headerRepulsionPoints: Position[] = [];
  private shakeImpulse?: Position;
  private gravityDirection?: Position;
  private gravityDirectionAtRest?: Position;
  private tilt?: Position;
  private animationFrame?: number;
  private frames = 0;
  private lastDebugAt = 0;
  private fps = Infinity;
  private smallScreen = window.matchMedia(Scene.smallScreenQuery);

  private constructor() {
    this.palette = this.pickRandomPalette();
    this.canvas = document.createElement("canvas");
    this.canvas.className = "blobs";
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is not supported");
    this.context = context;
  }

  public init(): void {
    this.createCanvas();
    this.applyPaletteBackground();
    this.spawnBlobs();
    this.trackCursor();
    this.trackHeader();
    this.trackDeviceMotion();
    this.trackVisibility();
    this.trackPaletteButton();
    this.resume();
  }

  private createCanvas(): void {
    document.body.append(this.canvas);
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    window.visualViewport?.addEventListener("resize", () => this.resizeCanvas());
  }

  private spawnBlobs(): void {
    for (let i = 0; i < Scene.initSpecies; i++) {
      const species = new Species(i, this.palette);
      this.species.push(species);
    }
    for (let i = 0; i < Scene.initBlobs; i++) {
      const species = this.species[i % this.species.length];
      const blob = new Blob(species);
      this.add(blob);
    }
  }

  private trackCursor(): void {
    const onMove = (e: PointerEvent) => {
      this.cursor = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      this.cursor = undefined;
    };
    const onRelease = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") onLeave();
    };
    window.addEventListener("pointerdown", onMove);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    document.documentElement.addEventListener("pointerleave", onLeave);
  }

  private trackDeviceMotion(): void {
    if (typeof DeviceMotionEvent === "undefined") return;
    let lastMotionAt: number | undefined;
    const onMotion = (e: DeviceMotionEvent) => {
      const elapsed = lastMotionAt === undefined ? 0 : e.timeStamp - lastMotionAt;
      lastMotionAt = e.timeStamp;
      const ms = Math.min(Math.max(elapsed, 0), Scene.deviceMotionMaxIntervalMs);
      const g = e.accelerationIncludingGravity;
      if (g?.x != null && g.y != null)
        this.updateTilt(Scene.coordinatesToScreenOrientation(g.x, g.y), ms);
      const a = e.acceleration;
      if (a?.x == null || a.y == null) return;
      if (Math.hypot(a.x, a.y) < Scene.deviceShakeThreshold) return;
      const { x, y } = Scene.coordinatesToScreenOrientation(a.x, a.y);
      const k = (-Scene.deviceShakeStrength * ms) / 1000;
      const impulse = (this.shakeImpulse ??= { x: 0, y: 0 });
      impulse.x += x * k;
      impulse.y += y * k;
    };
    window.addEventListener("devicemotion", onMotion);
  }

  private trackHeader(): void {
    const elements = document.querySelectorAll(".identity h1, .identity p, .identity a");
    if (!elements.length) return;
    const onResize = () => {
      const rects = Array.from(elements, (el) => el.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left));
      const right = Math.max(...rects.map((r) => r.right));
      const top = Math.min(...rects.map((r) => r.top));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      const y = (top + bottom) / 2;
      this.headerRepulsionPoints = [1, 3, 5].map((n) => ({
        x: left + ((right - left) * n) / 6,
        y,
      }));
    };
    onResize();
    window.addEventListener("resize", onResize);
    void document.fonts.ready.then(onResize);
  }

  private trackVisibility(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
      else this.resume();
    });
  }

  private trackPaletteButton(): void {
    document.getElementById("next-palette")?.addEventListener("click", () => this.nextPalette());
  }

  private pause(): void {
    if (this.pausedAt !== undefined) return;
    this.pausedAt = performance.now();
    this.stopLoop();
  }

  private resume(): void {
    if (this.pausedAt === undefined) return;
    this.pausedDuration += performance.now() - this.pausedAt;
    this.pausedAt = undefined;
    this.frames = 0;
    this.loop();
  }

  private nextPalette(): void {
    const index = palettes.indexOf(this.palette);
    this.palette = palettes[(index + 1) % palettes.length];
    this.applyPaletteBackground();
    for (let i = 0; i < this.species.length; i++) this.species[i].applyPalette(this.palette);
  }

  private pickRandomPalette(): Palette {
    return palettes[Math.floor(Math.random() * palettes.length)];
  }

  private applyPaletteBackground(): void {
    const style = document.documentElement.style;
    this.palette.background.forEach((color, i) => {
      style.setProperty(`--bg-${i + 1}`, color);
    });
  }

  private resizeCanvas(): void {
    this.pixelRatio = Scene.measurePixelRatio();
    Object.assign(this.viewport, Scene.measureViewport());
    const { width, height } = this.viewport;
    this.canvas.width = Math.round(width * this.pixelRatio);
    this.canvas.height = Math.round(height * this.pixelRatio);
  }

  private add(blob: Blob): void {
    this.blobs.push(blob);
  }

  private remove(blob: Blob): void {
    for (let i = 0; i < this.blobs.length; i++) {
      if (this.blobs[i] === blob) {
        this.blobs.splice(i, 1);
        break;
      }
    }
  }

  private loop(): void {
    this.animationFrame = requestAnimationFrame(this.loop.bind(this));
    this.loopTime = performance.now() - this.pausedDuration;
    this.duplicate();
    this.animate();
    this.draw();
    this.updateDebug();
  }

  private stopLoop(): void {
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
  }

  private animate(): void {
    const elapsed = this.loopTime - this.animatedAt;
    this.animatedAt = this.loopTime;
    const headerPoints = this.smallScreen.matches ? [] : this.headerRepulsionPoints;
    const repulsionPoints = this.cursor ? [...headerPoints, this.cursor] : headerPoints;
    const delta = Math.min(elapsed, 1000);
    this.repelClosestPairs(delta);
    this.applyImpulse(delta);
    for (let i = 0; i < this.species.length; i++) this.species[i].sprite.animate();
    for (let i = 0; i < this.blobs.length; i++) this.blobs[i].animate(delta, repulsionPoints);
  }

  private draw(): void {
    const ctx = this.context;
    for (let i = 0; i < this.species.length; i++) this.species[i].sprite.draw();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = Scene.blobOpacity;
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < this.blobs.length; i++) {
      this.blobs[i].draw(ctx);
    }
  }

  private updateTilt(reading: Position, ms: number): void {
    const gravityDirection = Scene.smoothTowards(
      this.gravityDirection,
      reading,
      ms,
      Scene.deviceTiltSmoothingMs,
    );
    const gravityDirectionAtRest = Scene.smoothTowards(
      this.gravityDirectionAtRest,
      gravityDirection,
      ms,
      Scene.deviceTiltRestMs,
    );
    this.gravityDirection = gravityDirection;
    this.gravityDirectionAtRest = gravityDirectionAtRest;
    this.tilt = {
      x: gravityDirectionAtRest.x - gravityDirection.x,
      y: gravityDirectionAtRest.y - gravityDirection.y,
    };
  }

  private applyImpulse(delta: number): void {
    const impulse = { x: 0, y: 0 };
    if (this.tilt) {
      impulse.x += this.tilt.x * Scene.deviceTiltStrength * delta;
      impulse.y += this.tilt.y * Scene.deviceTiltStrength * delta;
    }
    if (this.shakeImpulse) {
      impulse.x += this.shakeImpulse.x;
      impulse.y += this.shakeImpulse.y;
      this.shakeImpulse = undefined;
    }
    if (impulse.x === 0 && impulse.y === 0) return;
    for (let i = 0; i < this.blobs.length; i++) this.blobs[i].applyImpulse(impulse);
  }

  private repelClosestPairs(delta: number): void {
    const paired = new Set<Blob>();
    for (let i = 0; i < this.blobs.length; i++) {
      const blob = this.blobs[i];
      if (paired.has(blob)) continue;
      let closest: Blob | undefined;
      let closestDistanceSq = Infinity;
      for (let j = 0; j < this.blobs.length; j++) {
        const other = this.blobs[j];
        if (other.species !== blob.species) continue;
        if (other === blob || paired.has(other)) continue;
        const distanceSq = blob.distanceSqTo(other);
        if (distanceSq < closestDistanceSq) {
          closest = other;
          closestDistanceSq = distanceSq;
        }
        if (closestDistanceSq <= 10) break;
      }
      if (!closest) continue;
      paired.add(blob);
      paired.add(closest);
      blob.repelFrom(closest, delta);
    }
  }

  private static measureViewport(): Size {
    return {
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    };
  }

  private static coordinatesToScreenOrientation(x: number, y: number): Position {
    const angle = ((screen.orientation?.angle ?? 0) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { x: x * cos - y * sin, y: -(x * sin + y * cos) };
  }

  private static smoothTowards(
    from: Position | undefined,
    to: Position,
    ms: number,
    timeConstantMs: number,
  ): Position {
    if (!from) return { ...to };
    const k = 1 - Math.exp(-ms / timeConstantMs);
    return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
  }

  private static measurePixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, Scene.maxPixelRatio);
  }

  private get maxBlobs(): number {
    return this.smallScreen.matches ? Scene.smallScreenMaxBlobs : Scene.maxBlobs;
  }

  private duplicate(): void {
    const maxBlobs = this.maxBlobs;
    if (this.blobs.length >= maxBlobs) return;
    if (this.fps < Scene.duplicateMinFps) return;
    if (this.loopTime - this.duplicatedAt < Scene.duplicateInterval) return;
    this.duplicatedAt = this.loopTime;
    const blobs = this.blobs.slice();
    for (let i = 0; i < blobs.length; i++) {
      if (this.blobs.length >= maxBlobs) break;
      const children = blobs[i].duplicate();
      if (!children) continue;
      children.forEach((child) => this.add(child));
      this.remove(blobs[i]);
    }
  }

  private updateDebug(): void {
    this.frames++;
    const elapsed = this.loopTime - this.lastDebugAt;
    if (this.lastDebugAt !== 0 && elapsed < Scene.debugInterval) return;
    const fps = Math.round((this.frames * 1000) / elapsed);
    if (this.lastDebugAt !== 0) this.fps = fps;
    this.frames = 0;
    this.lastDebugAt = this.loopTime;
    const maxBlobs = this.maxBlobs;
    const max = String(maxBlobs);
    const count = String(this.blobs.length).padStart(max.length, "0");
    this.setDebugText("debug-blobs-count", `${count}/${max}`);
    this.setDebugProgress("debug-blobs", this.blobs.length, maxBlobs);
    this.setDebugText("debug-fps", fps);
  }

  private setDebugProgress(id: string, value: number, max: number): void {
    const element = document.getElementById(id);
    if (!element) return;
    element.style.setProperty("--progress", String(value / max));
    element.setAttribute("aria-valuenow", String(value));
    element.setAttribute("aria-valuemax", String(max));
  }

  private setDebugText(id: string, value: number | string): void {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  }
}
