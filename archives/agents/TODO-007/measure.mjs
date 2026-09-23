// TODO-007 verifier: 変更前/変更後を同じ手順で測る Playwright スクリプト。
// 使い方: node measure.mjs <url> <out-json-path> <shot-prefix>
import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2];
const outPath = process.argv[3];
const shotDir = process.argv[4]; // ~/tmp/playwright-mcp/

const result = {};

async function installLogger(page) {
  await page.evaluate(() => {
    window.__log = [];
    window.addEventListener('keydown', (ev) => {
      window.__log.push({ type: 'keydown', code: ev.code, repeat: ev.repeat, defaultPrevented: ev.defaultPrevented });
    });
    window.__errors = [];
    window.addEventListener('error', (ev) => window.__errors.push(String(ev.message || ev.error)));
  });
  page.on('pageerror', (e) => {
    page.__pageerrors = page.__pageerrors || [];
    page.__pageerrors.push(String(e));
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      page.__consoleErrors = page.__consoleErrors || [];
      page.__consoleErrors.push(msg.text());
    }
  });
}

async function getPlayerXRange(page) {
  // 自機は #00e5ff の輪郭線＋薄い塗り（連続した幅）。被弾時のスパーク粒子も
  // 同じ色で飛ぶが 3x3 の点がバラバラに散るだけなので、各行でいちばん長く
  // 連続したかたまりを自機とみなし、スパークのノイズを避ける。
  return page.evaluate(() => {
    const canvas = document.getElementById('screen');
    const dpr = canvas.width / 480;
    const ctx = canvas.getContext('2d');
    const yStart = Math.round(584 * dpr);
    const yEnd = Math.round(602 * dpr);
    const h = Math.max(1, yEnd - yStart);
    const data = ctx.getImageData(0, yStart, canvas.width, h).data;
    let bestLen = 0;
    let bestStart = null;
    let bestEnd = null;
    for (let y = 0; y < h; y++) {
      let runStart = null;
      for (let x = 0; x <= canvas.width; x++) {
        let match = false;
        if (x < canvas.width) {
          const i = (y * canvas.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          match = a > 10 && g > 90 && b > 90 && r < 90;
        }
        if (match) {
          if (runStart === null) runStart = x;
        } else if (runStart !== null) {
          const len = x - runStart;
          if (len > bestLen) {
            bestLen = len;
            bestStart = runStart;
            bestEnd = x - 1;
          }
          runStart = null;
        }
      }
    }
    return {
      minX: bestStart === null ? null : bestStart / dpr,
      maxX: bestEnd === null ? null : bestEnd / dpr,
      runLen: bestLen === 0 ? null : bestLen / dpr,
      dpr,
    };
  });
}

async function hasBullet(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('screen');
    const dpr = canvas.width / 480;
    const ctx = canvas.getContext('2d');
    // 自機より上（y 論理 0..580）を白系ピクセルで探す
    const yEnd = Math.round(580 * dpr);
    const data = ctx.getImageData(0, 0, canvas.width, yEnd).data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 50 && r > 200 && g > 200 && b > 200) return true;
    }
    return false;
  });
}

async function colorCountInRow(page, yLogical, test) {
  return page.evaluate(
    ({ yLogical, testStr }) => {
      const canvas = document.getElementById('screen');
      const dpr = canvas.width / 480;
      const ctx = canvas.getContext('2d');
      const y0 = Math.max(0, Math.round((yLogical - 10) * dpr));
      const y1 = Math.min(canvas.height, Math.round((yLogical + 10) * dpr));
      const h = Math.max(1, y1 - y0);
      const data = ctx.getImageData(0, y0, canvas.width, h).data;
      // eslint-disable-next-line no-eval
      const testFn = new Function('r', 'g', 'b', 'a', 'return ' + testStr);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (testFn(data[i], data[i + 1], data[i + 2], data[i + 3])) count++;
      }
      return count;
    },
    { yLogical, testStr: test },
  );
}

const YELLOW_TEST = 'a>50 && r>200 && g>150 && b<160'; // #ffe14d 系
const CYAN_TEXT_TEST = 'a>50 && g>90 && b>90 && r<90'; // #00e5ff 系

async function getStyles(page) {
  return page.evaluate(() => {
    const cs = (sel) => getComputedStyle(document.querySelector(sel));
    const hud = cs('.hud');
    const game = cs('.game');
    const fire = cs('#btn-fire');
    const lever = cs('#lever');
    const knob = cs('#lever-knob');
    return {
      hudHeight: hud.height,
      gameAlignItems: game.alignItems,
      fire: {
        color: fire.color,
        border: fire.border,
        boxShadow: fire.boxShadow,
        background: fire.backgroundColor,
        fontSize: fire.fontSize,
        borderRadius: fire.borderRadius,
      },
      lever: {
        width: lever.width,
        height: lever.height,
        borderRadius: lever.borderRadius,
        background: lever.backgroundColor,
      },
      knob: {
        width: knob.width,
        height: knob.height,
        borderRadius: knob.borderRadius,
        background: knob.backgroundColor,
      },
    };
  });
}

async function keydownRepeatTable(browser, baseUrl) {
  const keys = ['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'Space', 'KeyP', 'Enter', 'NumpadEnter', 'KeyX'];
  const table = {};
  for (const key of keys) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });
    await installLogger(page);
    await page.waitForTimeout(150);

    // repeat なし
    await page.evaluate(() => (window.__log = []));
    await page.keyboard.down(key);
    await page.waitForTimeout(30);
    await page.keyboard.up(key);
    await page.waitForTimeout(30);
    const noRepeatLog = await page.evaluate(() => window.__log);
    const noRepeatEntry = noRepeatLog.find((e) => e.type === 'keydown' && !e.repeat);

    // repeat あり: down を 2 回連続で呼ぶ
    await page.evaluate(() => (window.__log = []));
    await page.keyboard.down(key);
    await page.waitForTimeout(20);
    await page.keyboard.down(key);
    await page.waitForTimeout(30);
    await page.keyboard.up(key);
    await page.waitForTimeout(30);
    const repeatLog = await page.evaluate(() => window.__log);
    const repeatEntry = repeatLog.find((e) => e.repeat === true) || repeatLog[repeatLog.length - 1];

    table[key] = {
      noRepeat: noRepeatEntry
        ? { defaultPrevented: noRepeatEntry.defaultPrevented, repeatFlag: noRepeatEntry.repeat }
        : null,
      repeatCallTwice: repeatEntry
        ? { defaultPrevented: repeatEntry.defaultPrevented, repeatFlag: repeatEntry.repeat, allEntries: repeatLog }
        : null,
    };
    await context.close();
  }
  return table;
}

async function keyboardBehavior(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'load' });
  await installLogger(page);
  await page.waitForTimeout(150);

  const behavior = {};
  behavior.titleCyanTextBefore = await colorCountInRow(page, 320, CYAN_TEXT_TEST);

  // Enter で開始
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  behavior.titleCyanTextAfterEnter = await colorCountInRow(page, 320, CYAN_TEXT_TEST);

  // 自機の初期位置
  const initial = await getPlayerXRange(page);
  behavior.playerInitial = initial;

  // ←/A を押している間、左へ動く
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(300);
  const afterLeft = await getPlayerXRange(page);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(100);
  behavior.playerAfterLeft = afterLeft;
  behavior.movedLeft = afterLeft.minX !== null && initial.minX !== null && afterLeft.minX < initial.minX;

  // →/D を押している間、右へ動く
  const beforeRight = await getPlayerXRange(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  const afterRight = await getPlayerXRange(page);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(100);
  behavior.playerBeforeRight = beforeRight;
  behavior.playerAfterRight = afterRight;
  behavior.movedRight = afterRight.maxX !== null && beforeRight.maxX !== null && afterRight.maxX > beforeRight.maxX;

  // Space で弾が出る
  behavior.bulletBeforeSpace = await hasBullet(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  behavior.bulletAfterSpace = await hasBullet(page);

  // P → PAUSED
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(150);
  behavior.pausedTextAfterP = await colorCountInRow(page, 288, YELLOW_TEST);

  // もう一度 P → 再開
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(150);
  behavior.pausedTextAfterP2 = await colorCountInRow(page, 288, YELLOW_TEST);

  behavior.pageerrors = page.__pageerrors || [];
  behavior.consoleErrors = page.__consoleErrors || [];

  await context.close();
  return behavior;
}

async function touchBehavior(browser, baseUrl, shotPath) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'load' });
  page.__pageerrors = [];
  page.__consoleErrors = [];
  page.on('pageerror', (e) => page.__pageerrors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') page.__consoleErrors.push(msg.text());
  });
  await page.waitForTimeout(150);

  const behavior = {};
  behavior.styles = await getStyles(page);

  await page.screenshot({ path: shotPath });

  behavior.titleCyanTextBefore = await colorCountInRow(page, 320, CYAN_TEXT_TEST);

  // FIRE をタップすると開始
  const fireBox = await page.locator('#btn-fire').boundingBox();
  await page.touchscreen.tap(fireBox.x + fireBox.width / 2, fireBox.y + fireBox.height / 2);
  await page.waitForTimeout(200);
  behavior.titleCyanTextAfterFireTap = await colorCountInRow(page, 320, CYAN_TEXT_TEST);

  // 遊んでいる間のタップで弾が出る
  behavior.bulletBeforeTap = await hasBullet(page);
  await page.touchscreen.tap(fireBox.x + fireBox.width / 2, fireBox.y + fireBox.height / 2);
  await page.waitForTimeout(80);
  behavior.bulletAfterTap = await hasBullet(page);

  // レバー: CDP の Input.dispatchTouchEvent を使う（合成 dispatchEvent は使わない）
  const cdp = await context.newCDPSession(page);
  const leverBox = await page.locator('#lever').boundingBox();
  const cx = leverBox.x + leverBox.width / 2;
  const cy = leverBox.y + leverBox.height / 2;
  const rightX = leverBox.x + leverBox.width - 8;

  const initialPlayer = await getPlayerXRange(page);
  const initialKnobTransform = await page.evaluate(
    () => getComputedStyle(document.getElementById('lever-knob')).transform,
  );

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: cx, y: cy, id: 1 }],
  });
  await page.waitForTimeout(50);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: rightX, y: cy, id: 1 }],
  });
  await page.waitForTimeout(200);

  const draggedKnobTransform = await page.evaluate(
    () => getComputedStyle(document.getElementById('lever-knob')).transform,
  );
  const draggedPlayer = await getPlayerXRange(page);

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.waitForTimeout(150);

  const releasedKnobTransform = await page.evaluate(
    () => getComputedStyle(document.getElementById('lever-knob')).transform,
  );

  behavior.lever = {
    initialKnobTransform,
    draggedKnobTransform,
    releasedKnobTransform,
    initialPlayer,
    draggedPlayer,
    knobMoved: draggedKnobTransform !== initialKnobTransform,
    playerMovedRight:
      draggedPlayer.maxX !== null && initialPlayer.maxX !== null && draggedPlayer.maxX > initialPlayer.maxX,
    knobReturned: releasedKnobTransform === initialKnobTransform,
  };

  behavior.pageerrors = page.__pageerrors;
  behavior.consoleErrors = page.__consoleErrors;

  await context.close();
  return behavior;
}

const browser = await chromium.launch();

result.repeatTable = await keydownRepeatTable(browser, url);
result.keyboardBehavior = await keyboardBehavior(browser, url);
result.touchBehavior = await touchBehavior(browser, url, shotDir);

await browser.close();

fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log('done ->', outPath);
