import { defineConfig } from "vite";

export default defineConfig({
  // Project GitHub Pages: https://singachen.github.io/mesh-preview/
  base: "/mesh-preview/",
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
});
