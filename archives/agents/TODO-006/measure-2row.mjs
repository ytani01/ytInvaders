// TODO-006 再確認: ヘッダを 2x2 の 2 行に作り直した変更を、同じ4条件で測る。
// 実行: node archives/agents/TODO-006/measure-2row.mjs
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

// 前回報告と同じ式: 変更前の clamp(0.65rem, 2.8vw, 0.95rem)（1rem = 16px と仮定）
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
    const gameEl = document.querySelector(".game");
    const touchEl = document.querySelector(".touch");
    const hudStyle = getComputedStyle(hud);
    const hudRect = hud.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const spans = Array.from(hud.querySelectorAll("span")).map((s) => {
      const r = s.getBoundingClientRect();
      return { text: s.textContent.trim(), top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });
    const tops = [...new Set(spans.map((s) => Math.round(s.top)))].sort((a, b) => a - b);
    const row1 = spans.filter((s) => Math.round(s.top) === tops[0]);
    const row2 = tops.length > 1 ? spans.filter((s) => Math.round(s.top) === tops[1]) : [];
    // 左右の列が重ならないか（同じ行内で left 列の right < right 列の left）
    const overlapRow1 = row1.length === 2 ? row1[0].right > row1[1].left : null;
    const overlapRow2 = row2.length === 2 ? row2[0].right > row2[1].left : null;
    return {
      hudFontSizePx: parseFloat(hudStyle.fontSize),
      hudHeight: hudRect.height,
      hudTop: hudRect.top,
      hudBottom: hudRect.bottom,
      hudRight: hudRect.right,
      hudPaddingRight: parseFloat(hudStyle.paddingRight),
      spans,
      rowCount: tops.length,
      row1Texts: row1.map((s) => s.text),
      row2Texts: row2.map((s) => s.text),
      overlapRow1,
      overlapRow2,
      canvasWidth: canvas ? canvas.width : null,
      canvasHeight: canvas ? canvas.height : null,
      canvasRectTop: canvasRect.top,
      canvasRectBottom: canvasRect.bottom,
      gameHeight: gameEl.getBoundingClientRect().height,
      touchHeight: touchEl ? touchEl.getBoundingClientRect().height : 0,
      docScrollWidth: document.documentElement.scrollWidth,
      docScrollHeight: document.documentElement.scrollHeight,
      docClientWidth: document.documentElement.clientWidth,
      docClientHeight: document.documentElement.clientHeight,
    };
  });

  data.oldFontPxEstimate = oldFontPx(cond.viewport.width);
  data.fontRatio = data.hudFontSizePx / data.oldFontPxEstimate;
  const rightSpans = data.spans.filter((_, i) => i % 2 === 1);
  data.rightEdgeOverflow =
    rightSpans.length > 0
      ? Math.max(...rightSpans.map((s) => s.right)) - (data.hudRight - data.hudPaddingRight)
      : null;
  data.row2BottomOverflowsHud = data.row2Texts.length
    ? Math.max(...data.spans.filter((s) => data.row2Texts.includes(s.text)).map((s) => s.bottom)) > data.hudBottom
    : null;
  data.hudBottomOverflowsIntoCanvas = data.hudBottom > data.canvasRectTop;
  data.canvasAspect = data.canvasWidth && data.canvasHeight ? data.canvasWidth / data.canvasHeight : null;
  data.scrollOverflowX = data.docScrollWidth > data.docClientWidth;
  data.scrollOverflowY = data.docScrollHeight > data.docClientHeight;
  data.totalFits = data.gameHeight + data.touchHeight <= data.docClientHeight + 1; // 丸め誤差1px許容

  const shotPath = `${OUT_DIR}/todo006-2row-${cond.name}.png`;
  await page.screenshot({ path: shotPath });
  data.screenshot = shotPath;
  data.condition = cond.name;

  results.push(data);
  await context.close();
}

await browser.close();

console.log(JSON.stringify(results, null, 2));
