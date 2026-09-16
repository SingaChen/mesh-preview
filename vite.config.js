import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vite";

export const SW_CACHE_PLACEHOLDER = "__SW_CACHE_ID__";

export function stampSwCacheId(source, id) {
  const token = `mesh-preview-v2-${SW_CACHE_PLACEHOLDER}`;
  if (!source.includes(token)) {
    throw new Error("sw.js must keep the mesh-preview-v2-__SW_CACHE_ID__ cache name");
  }
  return source.replace(token, `mesh-preview-v2-${id}`);
}

function hashDistTree(dir, hash) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      hashDistTree(path, hash);
      continue;
    }
    hash.update(name);
    hash.update(readFileSync(path));
  }
}

function swCacheVersionPlugin() {
  let outDir = "dist";
  return {
    name: "sw-cache-version",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const swPath = join(outDir, "sw.js");
      if (!existsSync(swPath)) return;
      const source = readFileSync(swPath, "utf8");
      const hash = createHash("sha256");
      hash.update(source);
      hashDistTree(outDir, hash);
      const stamped = stampSwCacheId(source, hash.digest("hex").slice(0, 8));
      writeFileSync(swPath, stamped);
    },
  };
}

export default defineConfig({
  // Project GitHub Pages: https://singachen.github.io/mesh-preview/
  base: "/mesh-preview/",
  plugins: [swCacheVersionPlugin()],
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
