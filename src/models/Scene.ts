import { type Palette, palettes } from "../palettes";
import type { Position } from "../types";
import Blob from "./Blob";
import Species from "./Species";

export default class Scene {
  private static readonly initBlobs = 10;
  private static readonly maxBlobs = 200;
  private static readonly smallScreenMaxBlobs = 50;
  private static readonly smallScreenQuery = "(max-width: 640px)";
  private static readonly initSpecies = 5;
  private static readonly duplicateInterval = 200;
  private static readonly debugInterval = 500;
  private static readonly blobOpacity = 0.9;

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
  private animationFrame?: number;
  private frames = 0;
  private lastDebugAt = 0;
  private smallScreen = window.matchMedia(Scene.smallScreenQuery);

  constructor() {
    this.palette = this.pickRandomPalette();
    this.canvas = document.createElement("canvas");
    this.canvas.className = "blobs";
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is not supported");
    this.context = context;
  }

  public createObjects(): void {
    document.body.append(this.canvas);
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    this.applyPaletteBackground();
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

  public trackCursor(): void {
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

  public trackHeader(): void {
    const header = document.querySelector(".identity h1");
    if (!header) return;
    const onResize = () => {
      const rect = header.getBoundingClientRect();
      const y = rect.top + rect.height / 2;
      this.headerRepulsionPoints = [1, 3, 5].map((n) => ({
        x: rect.left + (rect.width * n) / 6,
        y,
      }));
    };
    onResize();
    window.addEventListener("resize", onResize);
    document.fonts.ready.then(onResize);
  }

  public pause(): void {
    if (this.pausedAt !== undefined) return;
    this.pausedAt = performance.now();
    this.stopLoop();
  }

  public resume(): void {
    if (this.pausedAt === undefined) return;
    this.pausedDuration += performance.now() - this.pausedAt;
    this.pausedAt = undefined;
    this.frames = 0;
    this.loop();
  }

  public nextPalette(): void {
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
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
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
    for (let i = 0; i < this.species.length; i++) this.species[i].sprite.animate();
    for (let i = 0; i < this.blobs.length; i++) this.blobs[i].animate(delta, repulsionPoints);
  }

  private draw(): void {
    const ctx = this.context;
    const width = window.innerWidth;
    const height = window.innerHeight;
    for (let i = 0; i < this.species.length; i++) this.species[i].sprite.draw();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = Scene.blobOpacity;
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < this.blobs.length; i++) {
      this.blobs[i].draw(ctx, width, height);
    }
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

  private get maxBlobs(): number {
    return this.smallScreen.matches ? Scene.smallScreenMaxBlobs : Scene.maxBlobs;
  }

  private duplicate(): void {
    const maxBlobs = this.maxBlobs;
    if (this.blobs.length >= maxBlobs) return;
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
