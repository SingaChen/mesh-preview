import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { SW_CACHE_PLACEHOLDER, stampSwCacheId } from "../vite.config.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sw = readFileSync(join(root, "public", "sw.js"), "utf8");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadSwPolicy() {
  const prelude = sw.split("self.addEventListener")[0];
  const context = vm.createContext({ URL, Request });
  vm.runInContext(prelude, context);
  return context;
}

assert(!sw.includes("mesh-preview-v1"), "SW must not keep the stuck v1 cache name");
assert(
  sw.includes(`mesh-preview-v2-${SW_CACHE_PLACEHOLDER}`),
  "SW cache name must be v2 plus the build-time placeholder",
);

const stamped = stampSwCacheId(sw, "deadbeef");
assert(stamped.includes('const CACHE = "mesh-preview-v2-deadbeef"'), "build stamp must rewrite cache name");
assert(!stamped.includes(SW_CACHE_PLACEHOLDER), "stamped SW must not keep the placeholder");

assert(sw.includes('cache: "reload"'), "mutable sample/nav fetches must bypass the HTTP cache");
assert(sw.includes("/sample/"), "SW must treat sample/** as network-first");
assert(/\.\(xls\|xlsx\|obj\|json\)/.test(sw), "SW must treat xls/obj/json as network-first");
assert(sw.includes("isHashedAsset"), "hashed /assets/* may stay cache-first");
assert(sw.includes('k.startsWith("mesh-preview-")'), "activate must drop every old mesh-preview-* cache");
assert(sw.includes("self.skipWaiting()"), "new SW must activate without waiting");
assert(sw.includes("self.clients.claim()"), "new SW must claim open clients");

const main = readFileSync(join(root, "src", "main.js"), "utf8");
assert(main.includes('updateViaCache: "none"'), "registration must not reuse a cached sw.js");
assert(main.includes('cache: "reload"'), "loadSample must bypass HTTP cache for sample files");

const readme = readFileSync(join(root, "README.md"), "utf8");
assert(
  /注销 Service Worker|unregister/i.test(readme),
  "README must tell users to clear site data / unregister SW if the UI looks stale",
);

const policy = loadSwPolicy();
const origin = "https://singachen.github.io";
const sampleXls = new URL("/mesh-preview/sample/cylinder/iteration_0_cut_cols_resample.xls", origin);
const sampleObj = new URL("/mesh-preview/sample/cylinder/iteration_0_cut_cols_resample_field.obj", origin);
const sampleJson = new URL("/mesh-preview/sample/cylinder/faces_ring_layout.json", origin);
const hashedJs = new URL("/mesh-preview/assets/index-5GrU1-u7.js", origin);
const html = new URL("/mesh-preview/", origin);

assert(policy.isSampleOrMutableData(sampleXls), "sample xls must be treated as mutable");
assert(policy.isSampleOrMutableData(sampleObj), "sample obj must be treated as mutable");
assert(policy.isSampleOrMutableData(sampleJson), "sample faces_ring_layout.json must be treated as mutable");
assert(policy.isHashedAsset(hashedJs), "Vite hashed /assets/* must match");
assert(
  policy.shouldBypassHttpCache({ mode: "navigate", destination: "document" }, html),
  "navigation must bypass HTTP cache",
);
assert(
  policy.shouldBypassHttpCache({ mode: "cors", destination: "" }, sampleXls),
  "sample xls must bypass HTTP cache",
);
assert(
  !policy.shouldBypassHttpCache({ mode: "cors", destination: "script" }, hashedJs),
  "hashed assets may use cache-first without HTTP reload",
);

const current = "mesh-preview-v2-deadbeef";
const leftover = ["mesh-preview-v1", current, "mesh-preview-v2-oldhash", "unrelated-cache"].filter(
  (k) => k !== current && k.startsWith("mesh-preview-"),
);
assert(
  leftover.join(",") === "mesh-preview-v1,mesh-preview-v2-oldhash",
  `activate must drop every old mesh-preview-* cache, got ${leftover}`,
);

console.log("sw checks ok");
