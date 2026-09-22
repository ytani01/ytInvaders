// TODO-003 verifier script (star shape check: 1px..2px square point).
// Startup structure reused from archives/agents/TODO-002/verify-fire.mjs
// (that file itself is untouched). fillRect-wrapping idea reused too.
//
// 星の呼び出しの見分け方: 星のループ（game.ts 588-593 行）は fillStyle に
// '#bfe9ff' か '#7a6cff' しか使わず、この 2 色は src/ 全体で他に使われていない
// （`rg -n "bfe9ff|7a6cff" src` で確認）。よって fillRect 直前の fillStyle が
// この 2 色のどちらかであることをもって「星の呼び出し」と判定する。
//
// Usage: node verify-stars.mjs [baseUrl]
//   baseUrl: default http://localhost:4321/ytInvaders/

import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4321/ytInvaders/';
const STAR_COLORS = new Set(['#bfe9ff', '#7a6cff']);

async function installFillRectHook(page) {
  await page.addInitScript((colors) => {
    window.__starCalls = [];
    const starColors = new Set(colors);
    const proto = CanvasRenderingContext2D.prototype;
    const origFillRect = proto.fillRect;
    proto.fillRect = function (x, y, w, h) {
      if (starColors.has(this.fillStyle)) {
        window.__starCalls.push({ w, h });
      }
      return origFillRect.call(this, x, y, w, h);
    };
  }, [...STAR_COLORS]);
}

async function captureOneFrame(page) {
  // fillStyle は CSS color 文字列としてそのまま読める（ブラウザが hex を
  // 大文字化・rgb() 化しないことを実測で確認）。
  await page.evaluate(() => { window.__starCalls = []; });
  await page.waitForTimeout(60); // 1 フレーム以上経過を待つ
  const calls = await page.evaluate(() => window.__starCalls.slice());
  return calls;
}

function summarize(calls) {
  const n = calls.length;
  const sq = calls.filter((c) => c.w === c.h);
  const ws = calls.map((c) => c.w);
  return {
    count: n,
    squareRatio: n > 0 ? sq.length / n : null,
    wMin: n > 0 ? Math.min(...ws) : null,
    wMax: n > 0 ? Math.max(...ws) : null,
  };
}

async function runForViewport(browser, label, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await installFillRectHook(page);
  await page.goto(BASE, { waitUntil: 'load' });

  // タイトル画面のスクリーンショット
  await page.waitForTimeout(300);
  const titleCalls = await captureOneFrame(page);
  await page.screenshot({ path: `archives/agents/TODO-003/title-${label}.png` });

  // Enter で開始、2 秒待ってプレイ中のスクリーンショットと星の計測
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const playCalls = await captureOneFrame(page);
  await page.screenshot({ path: `archives/agents/TODO-003/play-${label}.png` });

  // 星の一部を拡大した切り抜き（canvas 左上 120x120 を切り出して4倍に拡大）
  const canvas = await page.$('#screen');
  const box = await canvas.boundingBox();
  const cropSize = Math.min(120, box.width, box.height);
  const cropPage = await context.newPage();
  await cropPage.goto(BASE, { waitUntil: 'load' });
  await cropPage.waitForTimeout(300);
  await cropPage.screenshot({
    path: `archives/agents/TODO-003/crop-raw-${label}.png`,
    clip: { x: box.x, y: box.y, width: cropSize, height: cropSize },
  });
  await cropPage.close();

  await context.close();
  return {
    label,
    title: summarize(titleCalls),
    play: summarize(playCalls),
  };
}

const browser = await chromium.launch();
const results = [];
results.push(await runForViewport(browser, '1280x800', { viewport: { width: 1280, height: 800 } }));
results.push(await runForViewport(browser, '390x844', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }));
await browser.close();

console.log(JSON.stringify(results, null, 2));
