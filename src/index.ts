import "@fontsource/fredoka/400.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "./index.css";
import Scene from "./models/Scene";

const scene = new Scene();

const banner = String.raw`▗▄▄▖ ▗▖    ▗▄▖ ▗▄▄▖ 
▐▌ ▐▌▐▌   ▐▌ ▐▌▐▌ ▐▌
▐▛▀▚▖▐▌   ▐▌ ▐▌▐▛▀▚▖
▐▙▄▞▘▐▙▄▄▖▝▚▄▞▘▐▙▄▞▘
`;

const init = () => {
  console.log(banner);
  scene.createObjects();
  scene.trackCursor();
  scene.trackHeader();
  scene.resume();
  document.getElementById("next-palette")?.addEventListener("click", () => scene.nextPalette());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) scene.pause();
    else scene.resume();
  });
};

window.onload = init;
