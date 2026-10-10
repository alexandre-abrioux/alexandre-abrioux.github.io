import { easeInOutBack, easeOutBack } from "js-easing-functions";

import { random } from "../helper";
import type { Position } from "../types";
import type Species from "./Species";

const initialGrowOvershoot = 3;
const minScale = 0.5;
const maxScale = 2;
const minSpeed = 1;
const maxSpeed = 4;
const minSize = 40;
const maxSize = 50;
const repulsionStrength = 4;
const blobRepulsionStrength = 1;
const repulsionSofteningDistance = 30;
const repulsionMaxDistance = 250;
const repulsionMaxSpeed = 0.5;
const repulsionRelaxationMs = 1000;

export default class Blob {
  public readonly species: Species;
  private createdAt: number;
  private top: number;
  private left: number;
  private mirrored: boolean;

  private initialGrowAnimationDuration: number;
  private initialSize: number = 0;
  private initialSizeTarget: number;

  private scale1: number;
  private scale2: number;
  private scale: number;
  private scaleAnimationDuration: number;
  private scaleNextUpdateAt: number = 0;

  private directionUpdateScale: boolean;
  private directionRotation: boolean;

  private rotation: number;
  private rotationAnimationDuration: number;
  private rotationPerSecond: number;

  private movementDirection: number;
  private movementSpeed: number;
  private velocityX: number;
  private velocityY: number;

  constructor(species: Species) {
    this.species = species;
    const margin = Blob.maxRadiusPercent();
    this.top = random(margin.y, 100 - margin.y);
    this.left = random(margin.x, 100 - margin.x);
    this.mirrored = Math.random() > 0.5;
    this.initialSizeTarget = random(minSize, maxSize);
    this.createdAt = performance.now();
    this.rotation = random(0, 360);
    this.scale1 = random(minScale, maxScale);
    this.scale2 = this.scale1 + random(-0.1, 0.1);
    this.scale2 = Math.min(maxScale, Math.max(minScale, this.scale2));
    this.scale = this.scale1;
    this.rotationAnimationDuration = random(8000, 15000);
    this.scaleAnimationDuration = random(800, 1500);
    this.initialGrowAnimationDuration = random(1000, 2000);
    this.directionUpdateScale = Math.random() > 0.5;
    this.directionRotation = Math.random() > 0.5;
    this.rotationPerSecond =
      ((this.directionRotation ? 1 : -1) * 360) / this.rotationAnimationDuration;
    this.movementDirection = random(0, 2 * Math.PI);
    this.movementSpeed = random(minSpeed, maxSpeed);
    this.velocityX = (Math.cos(this.movementDirection) * this.movementSpeed) / 1000;
    this.velocityY = (Math.sin(this.movementDirection) * this.movementSpeed) / 1000;
  }

  static maxRadiusPercent(): { x: number; y: number } {
    const radius = (maxSize * maxScale) / 2;
    return {
      x: (radius / window.innerWidth) * 100,
      y: (radius / window.innerHeight) * 100,
    };
  }

  draw(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number): void {
    const size = this.initialSize * this.scale;
    if (size <= 0) return;
    const angle = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(angle) * size;
    const sin = Math.sin(angle) * size;
    const x = (this.left / 100) * viewportWidth;
    const y = (this.top / 100) * viewportHeight;
    const flip = this.mirrored ? -1 : 1;
    ctx.setTransform(cos * flip, sin * flip, -sin, cos, x, y);
    ctx.drawImage(this.species.sprite.canvas, -0.5, -0.5, 1, 1);
  }

  animate(delta: number, repulsionPoints: Position[]): void {
    this.animateInitialGrowth();
    this.animateScale();
    this.animatePosition(delta);
    this.animateRotation(delta);
    for (let i = 0; i < repulsionPoints.length; i++) this.applyRepulsion(repulsionPoints[i], delta);
    this.relaxSpeed(delta);
  }

  getPosition(): Position {
    return {
      x: (this.left / 100) * window.innerWidth,
      y: (this.top / 100) * window.innerHeight,
    };
  }

  distanceSqTo(other: Blob): number {
    const a = this.getPosition();
    const b = other.getPosition();
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  }

  // pushes both blobs apart, each away from the other's current position
  repelFrom(other: Blob, delta: number): void {
    const a = this.getPosition();
    const b = other.getPosition();
    this.applyRepulsion(b, delta, blobRepulsionStrength);
    other.applyRepulsion(a, delta, blobRepulsionStrength);
  }

  applyRepulsion(
    repulsionPoint: Position,
    delta: number,
    strength: number = repulsionStrength,
  ): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dx = (this.left / 100) * w - repulsionPoint.x;
    const dy = (this.top / 100) * h - repulsionPoint.y;
    const rawDistanceSq = dx * dx + dy * dy;
    if (rawDistanceSq >= repulsionMaxDistance ** 2) return;
    const distanceSq = rawDistanceSq + repulsionSofteningDistance ** 2;
    const distance = Math.sqrt(distanceSq);
    const acceleration =
      strength / distanceSq -
      strength / (repulsionMaxDistance ** 2 + repulsionSofteningDistance ** 2);
    let vx = (this.velocityX / 100) * w + (acceleration * dx * delta) / distance;
    let vy = (this.velocityY / 100) * h + (acceleration * dy * delta) / distance;
    const speed = Math.hypot(vx, vy);
    if (speed > repulsionMaxSpeed) {
      vx *= repulsionMaxSpeed / speed;
      vy *= repulsionMaxSpeed / speed;
    }
    this.velocityX = (vx / w) * 100;
    this.velocityY = (vy / h) * 100;
  }

  relaxSpeed(delta: number): void {
    const current = Math.hypot(this.velocityX, this.velocityY);
    if (current === 0) return;
    const cruising = this.movementSpeed / 1000;
    const k = 1 - Math.exp(-delta / repulsionRelaxationMs);
    const factor = (current + (cruising - current) * k) / current;
    this.velocityX *= factor;
    this.velocityY *= factor;
  }

  animatePosition(delta: number): void {
    this.left += this.velocityX * delta;
    this.top += this.velocityY * delta;
    const radius = (this.initialSize * this.scale) / 2;
    const radiusX = (radius / window.innerWidth) * 100;
    const radiusY = (radius / window.innerHeight) * 100;
    if (
      (this.left < radiusX && this.velocityX < 0) ||
      (this.left > 100 - radiusX && this.velocityX > 0)
    ) {
      this.velocityX = -this.velocityX;
    }
    if (
      (this.top < radiusY && this.velocityY < 0) ||
      (this.top > 100 - radiusY && this.velocityY > 0)
    ) {
      this.velocityY = -this.velocityY;
    }
  }

  animateInitialGrowth(): void {
    if (this.initialSize === this.initialSizeTarget) return;
    const elapsed = performance.now() - this.createdAt;
    if (elapsed >= this.initialGrowAnimationDuration) {
      this.initialSize = this.initialSizeTarget;
      return;
    }
    const size = easeOutBack(
      elapsed,
      0,
      this.initialSizeTarget,
      this.initialGrowAnimationDuration,
      initialGrowOvershoot,
    );
    this.initialSize = Math.max(0, size);
  }

  animateScale(): void {
    const now = performance.now();
    if (now > this.scaleNextUpdateAt) {
      this.scaleNextUpdateAt = now + this.scaleAnimationDuration;
      this.directionUpdateScale = !this.directionUpdateScale;
    }
    const animationStartedAt = this.scaleNextUpdateAt - this.scaleAnimationDuration;
    const start = this.directionUpdateScale ? this.scale1 : this.scale2;
    const target = this.directionUpdateScale ? this.scale2 : this.scale1;
    let scale = easeInOutBack(
      now - animationStartedAt,
      start,
      target - start,
      this.scaleAnimationDuration,
    );
    scale = Math.max(minScale, scale);
    scale = Math.min(maxScale, scale);
    this.scale = scale;
  }

  animateRotation(delta: number): void {
    this.rotation += this.rotationPerSecond * delta;
  }

  duplicate(): Blob[] | false {
    if (Math.random() > 0.03) return false;
    const children = [new Blob(this.species), new Blob(this.species)];
    const margin = Blob.maxRadiusPercent();
    children.forEach((child) => {
      child.top = this.top + random(-1, 1);
      child.left = this.left + random(-1, 1);
      child.top = Math.max(margin.y, Math.min(100 - margin.y, child.top));
      child.left = Math.max(margin.x, Math.min(100 - margin.x, child.left));
    });
    return children;
  }
}
