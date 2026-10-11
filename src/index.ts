import "@fontsource/fredoka/400.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "./index.css";
import Scene from "./models/Scene";

const banner = String.raw`▗▄▄▖ ▗▖    ▗▄▖ ▗▄▄▖ 
▐▌ ▐▌▐▌   ▐▌ ▐▌▐▌ ▐▌
▐▛▀▚▖▐▌   ▐▌ ▐▌▐▛▀▚▖
▐▙▄▞▘▐▙▄▄▖▝▚▄▞▘▐▙▄▞▘
`;

const init = () => {
  console.log(banner);
  Scene.instance.init();
};

window.onload = init;
