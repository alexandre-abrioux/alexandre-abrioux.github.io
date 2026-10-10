import { easeInOutSine } from "js-easing-functions";

import { random } from "../helper";
import type { HslColor } from "./Species";

const spriteSize = 128;

type BorderRadius = number[];

export default class SpeciesSprite {
  public readonly canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private color!: HslColor;
  private gradient?: CanvasGradient;

  private borderRadius1: BorderRadius;
  private borderRadius2: BorderRadius;
  private corners: DOMPointInit[] = [0, 1, 2, 3].map(() => ({ x: 0, y: 0 }));
  private borderRadiusDirection: boolean = false;
  private borderRadiusAnimationDuration: number;
  private borderRadiusNextUpdateAt: number = 0;

  constructor(color: HslColor) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = spriteSize;
    this.canvas.height = spriteSize;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is not supported");
    this.context = context;
    this.borderRadius1 = this.createBorderRadius();
    this.borderRadius2 = this.createBorderRadius();
    this.borderRadiusAnimationDuration = random(500, 1000);
    this.setColor(color);
  }

  setColor(color: HslColor): void {
    this.color = color;
    this.gradient = undefined;
  }

  createBorderRadius(): BorderRadius {
    const topLeftX = random(0.4, 0.75);
    const bottomLeftX = random(0.4, 0.75);
    const topLeftY = random(0.4, 0.75);
    const topRightY = random(0.4, 0.75);
    const topRightX = 1 - topLeftX;
    const bottomRightX = 1 - bottomLeftX;
    const bottomLeftY = 1 - topLeftY;
    const bottomRightY = 1 - topRightY;
    return [
      topLeftX,
      topRightX,
      bottomRightX,
      bottomLeftX,
      topLeftY,
      topRightY,
      bottomRightY,
      bottomLeftY,
    ];
  }

  getGradient(): CanvasGradient {
    if (this.gradient) return this.gradient;
    const { h, s, l } = this.color;
    this.gradient = this.context.createRadialGradient(0, 0, 0, 0, 0, Math.SQRT1_2);
    this.gradient.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, 0.15)`);
    this.gradient.addColorStop(1, `hsl(${h}, ${s}%, ${l}%)`);
    return this.gradient;
  }

  draw(): void {
    const ctx = this.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, spriteSize, spriteSize);
    ctx.setTransform(spriteSize, 0, 0, spriteSize, spriteSize / 2, spriteSize / 2);
    ctx.fillStyle = this.getGradient();
    ctx.beginPath();
    ctx.roundRect(-0.5, -0.5, 1, 1, this.corners);
    ctx.fill();
  }

  animate(): void {
    const now = performance.now();
    if (now > this.borderRadiusNextUpdateAt) {
      this.borderRadiusNextUpdateAt = now + this.borderRadiusAnimationDuration;
      this.borderRadiusDirection = !this.borderRadiusDirection;
    }
    const animationStartedAt = this.borderRadiusNextUpdateAt - this.borderRadiusAnimationDuration;
    const start = this.borderRadiusDirection ? this.borderRadius1 : this.borderRadius2;
    const target = this.borderRadiusDirection ? this.borderRadius2 : this.borderRadius1;
    const progress = easeInOutSine(
      Math.min(now - animationStartedAt, this.borderRadiusAnimationDuration),
      0,
      1,
      this.borderRadiusAnimationDuration,
    );
    for (let i = 0; i < 4; i++) {
      const corner = this.corners[i];
      corner.x = start[i] + (target[i] - start[i]) * progress;
      corner.y = start[i + 4] + (target[i + 4] - start[i + 4]) * progress;
    }
  }
}
