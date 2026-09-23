// TODO-006 検証: ヘッダの文字を大きくした変更が、どの画面でも1行に収まるか実測する。
// 実行: node archives/agents/TODO-006/measure.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const URL = "http://localhost:4321/ytInvaders/";
const OUT_DIR = process.env.HOME + "/tmp/playwright-mcp";
fs.mkdirSync(OUT_DIR, { recursive: true });

const conditions = [
  { name: "1280x800-mouse", viewport: { width: 1280, height: 800 } },
  { name: "1280x600-mouse", viewport: { width: 1280, height: 600 } },
  {
    name: "360x740-touch",
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  },
  {
    name: "320x568-touch",
    viewport: { width: 320, height: 568 },
    hasTouch: true,
    isMobile: true,
  },
];

// 変更前の式: clamp(0.65rem, 2.8vw, 0.95rem)（1rem = 16px と仮定）
function oldFontPx(viewportWidthPx) {
  const rem = 16;
  const vw = viewportWidthPx * 0.028;
  return Math.min(Math.max(vw, 0.65 * rem), 0.95 * rem);
}

const browser = await chromium.launch();
const results = [];

for (const cond of conditions) {
  const context = await browser.newContext({
    viewport: cond.viewport,
    hasTouch: cond.hasTouch ?? false,
    isMobile: cond.isMobile ?? false,
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });

  // スコアが大きいときを再現
  await page.evaluate(() => {
    const score = document.querySelector("#hud-score");
    const hi = document.querySelector("#hud-hi");
    const wave = document.querySelector("#hud-wave");
    if (score) score.textContent = "99999";
    if (hi) hi.textContent = "99999";
    if (wave) wave.textContent = "10";
  });

  const data = await page.evaluate(() => {
    const hud = document.querySelector(".hud");
    const canvas = document.querySelector("canvas");
    const hudStyle = getComputedStyle(hud);
    const hudRect = hud.getBoundingClientRect();
    const spans = Array.from(hud.querySelectorAll("span")).map((s) => {
      const r = s.getBoundingClientRect();
      return { text: s.textContent, top: r.top, right: r.right };
    });
    const tops = new Set(spans.map((s) => Math.round(s.top)));
    return {
      hudFontSizePx: parseFloat(hudStyle.fontSize),
      hudClientWidth: hud.clientWidth,
      hudScrollWidth: hud.scrollWidth,
      hudHeight: hudRect.height,
      hudRight: hudRect.right,
      hudPaddingRight: parseFloat(hudStyle.paddingRight),
      spans,
      oneLine: tops.size === 1,
      canvasWidth: canvas ? canvas.width : null,
      canvasHeight: canvas ? canvas.height : null,
      docScrollWidth: document.documentElement.scrollWidth,
      docScrollHeight: document.documentElement.scrollHeight,
      docClientWidth: document.documentElement.clientWidth,
      docClientHeight: document.documentElement.clientHeight,
    };
  });

  data.oldFontPxEstimate = oldFontPx(cond.viewport.width);
  data.fontRatio = data.hudFontSizePx / data.oldFontPxEstimate;
  data.rightEdgeOverflow =
    data.spans.length > 0
      ? Math.max(...data.spans.map((s) => s.right)) -
        (data.hudRight - data.hudPaddingRight)
      : null;
  data.canvasAspect = data.canvasWidth && data.canvasHeight
    ? data.canvasWidth / data.canvasHeight
    : null;
  data.scrollOverflowX = data.docScrollWidth > data.docClientWidth;
  data.scrollOverflowY = data.docScrollHeight > data.docClientHeight;

  const shotPath = `${OUT_DIR}/todo006-${cond.name}.png`;
  await page.screenshot({ path: shotPath });
  data.screenshot = shotPath;
  data.condition = cond.name;

  results.push(data);
  await context.close();
}

await browser.close();

console.log(JSON.stringify(results, null, 2));
