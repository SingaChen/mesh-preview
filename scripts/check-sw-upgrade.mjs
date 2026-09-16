import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".obj": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xls": "application/vnd.ms-excel",
  ".png": "image/png",
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const HARNESS = `<!doctype html>
<meta charset="utf-8" />
<title>sw-upgrade</title>
<pre id="out">running</pre>
<script>
(async () => {
  const out = document.getElementById("out");
  const report = (data) => {
    window.__SW_UPGRADE_RESULT__ = data;
    out.textContent = JSON.stringify(data, null, 2);
  };
  try {
    const stale = new Response("STALE_COLS_84", { headers: { "content-type": "text/plain" } });
    const old = await caches.open("mesh-preview-v1");
    await old.put("/mesh-preview/sample/cylinder/iteration_0_cut_cols_resample.xls", stale.clone());
    await old.put("/mesh-preview/sample/manifest.json", new Response('{"stale":84}', { headers: { "content-type": "application/json" } }));
    const keysBefore = await caches.keys();
    const reg = await navigator.serviceWorker.register("/mesh-preview/sw.js", { updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    await reg.update();
    if (navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
        setTimeout(resolve, 1500);
      });
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    const keysAfter = await caches.keys();
    const xls = await fetch("/mesh-preview/sample/cylinder/iteration_0_cut_cols_resample.xls");
    const xlsText = await xls.text();
    const manifest = await fetch("/mesh-preview/sample/manifest.json");
    const manifestJson = await manifest.json();
    report({
      keysBefore,
      keysAfter,
      v1Gone: !keysAfter.includes("mesh-preview-v1"),
      v2Present: keysAfter.some((k) => k.startsWith("mesh-preview-v2-") && k !== "mesh-preview-v2-__SW_CACHE_ID__"),
      xlsFresh: !xlsText.includes("STALE_COLS_84") && xls.ok && xlsText.length > 100,
      manifestFresh: manifestJson.name === "Single_Cylinder_Test" && manifestJson.stale !== 84,
    });
  } catch (err) {
    report({ error: String(err && err.stack ? err.stack : err) });
  }
})();
</script>
`;

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      let rel = url.pathname;
      if (rel.startsWith("/mesh-preview/")) rel = rel.slice("/mesh-preview".length);
      if (rel === "/" || rel === "") rel = "/index.html";
      const file = join(dist, rel);
      if (!file.startsWith(dist) || !existsSync(file)) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
      createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

async function waitForJson(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function cdp(wsUrl, method, params = {}) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  const send = (m, p) =>
    new Promise((resolve, reject) => {
      const next = ++id;
      pending.set(next, { resolve, reject });
      ws.send(JSON.stringify({ id: next, method: m, params: p }));
    });
  if (method) {
    const result = await send(method, params);
    ws.close();
    return { result, send, ws };
  }
  return { send, ws };
}

async function runChrome(harnessUrl) {
  const profile = mkdtempSync(join(tmpdir(), "mesh-sw-"));
  const chrome = spawn(
    "google-chrome",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "--remote-debugging-address=127.0.0.1",
      harnessUrl,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  let devtoolsUrl = "";
  chrome.stderr.on("data", (buf) => {
    stderr += buf.toString();
    const m = stderr.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) devtoolsUrl = m[1];
  });
  const started = Date.now();
  while (!devtoolsUrl && Date.now() - started < 8000) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!devtoolsUrl) {
    chrome.kill("SIGKILL");
    throw new Error(`chrome had no DevTools URL\n${stderr}`);
  }
  const version = await waitForJson(new URL("/json/version", devtoolsUrl.replace(/\/devtools\/.*$/, "")).href.replace("ws:", "http:").replace(/^http:\/\/.*$/, () => {
    const u = new URL(devtoolsUrl);
    return `http://${u.host}/json/version`;
  }));
  const list = await waitForJson(`http://${new URL(devtoolsUrl).host}/json/list`);
  const page = list.find((t) => t.type === "page") || list[0];
  const { send, ws } = await cdp(page.webSocketDebuggerUrl || version.webSocketDebuggerUrl);
  await send("Runtime.enable", {});
  let result;
  for (let i = 0; i < 40; i++) {
    const ev = await send("Runtime.evaluate", {
      expression: "window.__SW_UPGRADE_RESULT__",
      returnByValue: true,
    });
    if (ev.result?.value) {
      result = ev.result.value;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  ws.close();
  chrome.kill("SIGKILL");
  return result;
}

if (!existsSync(join(dist, "sw.js"))) {
  throw new Error("dist/sw.js missing — run npm run build first");
}
writeFileSync(join(dist, "sw-upgrade-harness.html"), HARNESS);

const server = await startStaticServer();
const { port } = server.address();
const harnessUrl = `http://127.0.0.1:${port}/mesh-preview/sw-upgrade-harness.html`;
let result;
try {
  result = await runChrome(harnessUrl);
} finally {
  server.close();
}

assert(result, "chrome harness produced no result");
assert(!result.error, result.error || "harness error");
assert(result.v1Gone, `old mesh-preview-v1 cache must be deleted, keys=${JSON.stringify(result.keysAfter)}`);
assert(result.v2Present, `new mesh-preview-v2-* cache must exist, keys=${JSON.stringify(result.keysAfter)}`);
assert(result.xlsFresh, "xls must come from the network (42-column sample), not STALE_COLS_84");
assert(result.manifestFresh, "sample manifest must come from the network, not the v1 stub");
console.log("sw upgrade checks ok", result);
