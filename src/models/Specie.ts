import { random } from "../helper";
import type { Palette } from "../palettes";

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export default class Specie {
  index: number;
  color!: HslColor;
  private gradient?: CanvasGradient;

  constructor(index: number, palette: Palette) {
    this.index = index;
    this.applyPalette(palette);
  }

  applyPalette(palette: Palette): void {
    this.color = {
      h: (palette.hues[this.index % palette.hues.length] + random(-6, 6) + 360) % 360,
      s: random(...palette.saturation),
      l: random(...palette.lightness),
    };
    this.gradient = undefined;
  }

  getGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
    if (this.gradient) return this.gradient;
    const { h, s, l } = this.color;
    this.gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.SQRT1_2);
    this.gradient.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, 0.15)`);
    this.gradient.addColorStop(1, `hsl(${h}, ${s}%, ${l}%)`);
    return this.gradient;
  }
}
