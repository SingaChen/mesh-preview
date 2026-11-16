/**
 * Screenshot the live knitting-code tables.
 * Run against `npm run dev` (default http://127.0.0.1:5173).
 * Requires the `playwright` package and a Chromium browser:
 *   npx playwright install chromium
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.env.KNIT_PREVIEW_URL || "http://127.0.0.1:5173";
const outDir = process.env.KNIT_SHOT_DIR || "/opt/cursor/artifacts/knitcode";

const sheets = [
  { id: "dense-standrad-cylinder", short: null, wide: null },
  { id: "decrease-cylinder", short: 40, wide: null },
  { id: "increase-cylinder", short: 41, wide: 36 },
  { id: "thin-cylinder", short: 39, wide: 81 },
  { id: "fat-cylinder", short: 43, wide: 38 },
  { id: "dense-increase-cylinder", short: 47, wide: 38 },
  { id: "dense-thin-cylinder", short: 45, wide: 147 },
  { id: "dense-fat-cylinder", short: 45, wide: 36 },
  { id: "dense-decrease-cylinder", short: 43, wide: null },
];

function shot(id, name) {
  return join(outDir, `${id}-${name}.png`);
}

async function scrollKnit(page, rowIndex, align) {
  await page.evaluate(
    ({ rowIndex, align }) => {
      const scroller = document.querySelector("#knit-scroll");
      const rowButton = scroller?.querySelector(`button.knit-cell[data-row-index="${rowIndex}"]`);
      const row = rowButton?.closest("tr");
      if (!scroller || !row) throw new Error(`missing knit row ${rowIndex}`);
      // thead itself is not sticky; the header cells are. Measure those.
      const header = scroller.querySelector("thead th");
      const headerBottom = header ? header.getBoundingClientRect().bottom : scroller.getBoundingClientRect().top;
      scroller.scrollTop += row.getBoundingClientRect().top - (headerBottom + 6);
      const cells = [...row.querySelectorAll("button.knit-cell")];
      const desc = row.querySelector(".desc");
      const descRight = desc.getBoundingClientRect().right;
      let target = cells.find((cell) => cell.dataset.needle === "0") || cells[0];
      if (align === "turn") {
        target = cells.find((cell) => cell.dataset.code === "11" || cell.dataset.code === "12") || target;
      } else if (align === "right13") {
        const frames = cells.filter((cell) => cell.dataset.code === "13");
        target = frames[frames.length - 1] || target;
      } else if (align === "span") {
        const frames = cells.filter((cell) => cell.dataset.code === "13");
        target = frames[0] || target;
      }
      scroller.scrollLeft += target.getBoundingClientRect().left - descRight - 40;
    },
    { rowIndex, align },
  );
}

async function shootScroll(page, file) {
  const pane = page.locator("#knit-scroll");
  await pane.screenshot({ path: file });
}

async function chipState(page) {
  return page.evaluate(() => {
    const chip = document.querySelector("#stitch-pick");
    const pressed = [...document.querySelectorAll(".knit-cell[aria-pressed='true']")].map((cell) => ({
      row: cell.dataset.rowIndex,
      code: cell.dataset.code,
      needle: cell.dataset.needle || "",
      face: cell.dataset.face || "",
      opening: cell.dataset.opening || "",
    }));
    return {
      hidden: chip ? chip.hidden : true,
      text: document.querySelector("#stitch-pick-text")?.textContent || "",
      pressed,
    };
  });
}

const report = [];
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.setDefaultTimeout(90000);

try {
  for (const spec of sheets) {
    const item = { id: spec.id, shots: [], checks: {} };
    report.push(item);
    await page.goto(`${base}/?sheet=${spec.id}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const button = document.querySelector("#map-mode-knit");
      return button && !button.disabled;
    });
    await page.click("#map-mode-knit");
    await page.waitForSelector("#knit-scroll button.knit-cell[data-row-index='34']");
    await page.waitForTimeout(250);

    await scrollKnit(page, 35, "span");
    const junction = shot(spec.id, "junction");
    await shootScroll(page, junction);
    item.shots.push(junction);

    if (spec.short != null) {
      await scrollKnit(page, spec.short, "turn");
      const file = shot(spec.id, "short");
      await shootScroll(page, file);
      item.shots.push(file);
    }
    if (spec.wide != null) {
      await scrollKnit(page, spec.wide, "right13");
      const file = shot(spec.id, "wide");
      await shootScroll(page, file);
      item.shots.push(file);
    }

    const knitCell = page.locator("#knit-scroll button.knit-cell[data-row-index='34'][data-needle='0'][data-code='1']");
    await knitCell.click();
    await page.waitForFunction(() => document.querySelector("#stitch-pick") && !document.querySelector("#stitch-pick").hidden);
    const knitShot = shot(spec.id, "click-knit");
    await page.screenshot({ path: knitShot });
    item.shots.push(knitShot);
    item.checks.knit = await chipState(page);

    const frame = page.locator("#knit-scroll button.knit-cell[data-row-index='34'][data-code='13']").first();
    await frame.click();
    await page.waitForFunction(() => document.querySelector("#stitch-pick")?.hidden === true);
    const frameShot = shot(spec.id, "click-13");
    await page.screenshot({ path: frameShot });
    item.shots.push(frameShot);
    item.checks.frame = await chipState(page);

    const opening = page.locator("#knit-scroll button.knit-cell[data-opening='true'][data-code='1']").first();
    await opening.click();
    await page.waitForFunction(() => document.querySelector("#stitch-pick")?.hidden === true);
    const openingShot = shot(spec.id, "click-opening");
    await page.screenshot({ path: openingShot });
    item.shots.push(openingShot);
    item.checks.opening = await chipState(page);

    const knitOk = item.checks.knit.hidden === false && item.checks.knit.pressed.some((cell) => cell.face !== "");
    const frameOk = item.checks.frame.hidden === true && item.checks.frame.pressed.every((cell) => cell.face === "");
    const openingOk = item.checks.opening.hidden === true && item.checks.opening.pressed.every((cell) => cell.face === "");
    if (!knitOk || !frameOk || !openingOk) {
      throw new Error(`${spec.id} highlight check failed ${JSON.stringify(item.checks)}`);
    }
    console.log(spec.id, item.shots.length, "shots", item.checks.knit.text);
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
