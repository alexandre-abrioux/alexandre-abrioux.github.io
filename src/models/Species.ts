import { random } from "../helper";
import type { Palette } from "../palettes";
import SpeciesSprite from "./SpeciesSprite";

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export default class Species {
  index: number;
  color: HslColor;
  public readonly sprite: SpeciesSprite;

  constructor(index: number, palette: Palette) {
    this.index = index;
    this.color = this.pickColor(palette);
    this.sprite = new SpeciesSprite(this.color);
  }

  applyPalette(palette: Palette): void {
    this.color = this.pickColor(palette);
    this.sprite.setColor(this.color);
  }

  private pickColor(palette: Palette): HslColor {
    return {
      h: (palette.hues[this.index % palette.hues.length] + random(-6, 6) + 360) % 360,
      s: random(...palette.saturation),
      l: random(...palette.lightness),
    };
  }
}
