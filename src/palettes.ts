export interface Palette {
  name: string;
  background: [string, string, string];
  hues: number[];
  saturation: [number, number];
  lightness: [number, number];
}

export const palettes: Palette[] = [
  {
    name: "Neon Night",
    background: ["#1a1040", "#0a0618", "#05030d"],
    hues: [334, 186, 82, 29, 267],
    saturation: [90, 100],
    lightness: [55, 62],
  },
  {
    name: "Sunset",
    background: ["#3a1030", "#1c0818", "#0d0410"],
    hues: [12, 325, 45, 280, 350],
    saturation: [85, 100],
    lightness: [58, 65],
  },
  {
    name: "Deep Sea",
    background: ["#0a2a3a", "#051520", "#020a10"],
    hues: [168, 195, 130, 220, 255],
    saturation: [80, 100],
    lightness: [50, 60],
  },
  {
    name: "Candy",
    background: ["#2a1a3a", "#140c20", "#08050f"],
    hues: [320, 160, 55, 200, 275],
    saturation: [85, 100],
    lightness: [65, 72],
  },
];
