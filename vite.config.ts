import { defineConfig } from "vite-plus";

export default defineConfig({
  css: {
    transformer: "lightningcss",
    lightningcss: {
      drafts: { customMedia: true },
    },
  },
  build: {
    cssMinify: "lightningcss",
  },
  fmt: {
    ignorePatterns: ["dist/**", "pnpm-lock.yaml"],
    sortImports: true,
  },
  lint: {
    ignorePatterns: ["dist/**"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  staged: {
    "*": "vp check --fix",
  },
});
