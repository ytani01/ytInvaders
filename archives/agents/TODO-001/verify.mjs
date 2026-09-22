// TODO-001 verifier script. Run with:
//   NODE_PATH=<npx playwright cache node_modules> node verify.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:4321';
const SHOT_DIR = process.env.HOME + '/tmp/playwright-mcp';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = {};

function log(section, obj) {
  results[section] = obj;
  console.log('== ' + section + ' ==');
  console.log(JSON.stringify(obj, null, 2));
}

// Read canvas pixel data + compute bright-pixel fraction and (optional) column
// centroid of bright pixels within a y-band, all in logical canvas coordinates
// (game.ts uses a fixed 480x640 logical resolution regardless of DPR).
async function canvasStats(page, yBand) {
  return await page.evaluate((yBand) => {
    const c = document.getElementById('screen');
    const ctx = c.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const data = img.data;
    const wpx = c.width, hpx = c.height;
    let bright = 0, total = 0;
    let sumX = 0, sumW = 0;
    const y0 = yBand ? Math.round(yBand[0] * dpr) : 0;
    const y1 = yBand ? Math.round(yBand[1] * dpr) : hpx;
    for (let y = 0; y < hpx; y++) {
      for (let x = 0; x < wpx; x++) {
        const i = (y * wpx + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const isBright = a > 10 && lum > 60;
        total++;
        if (isBright) bright++;
        if (isBright && y >= y0 && y < y1) {
          sumX += x;
          sumW += 1;
        }
      }
    }
    return {
      brightFraction: bright / total,
      centroidX: sumW > 0 ? sumX / sumW : null,
      centroidSampleCount: sumW,
      canvasPx: { w: wpx, h: hpx },
    };
  }, yBand);
}

async function shot(page, name) {
  const path = `${SHOT_DIR}/${name}.png`;
  await page.screenshot({ path });
  return path;
}

async function collectErrors(page) {
  const errors = { consoleError: 0, pageError: 0, messages: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.consoleError++;
      errors.messages.push('console:' + msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.pageError++;
    errors.messages.push('pageerror:' + err.message);
  });
  return errors;
}

async function desktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = await collectErrors(page);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(300);

  const canvas = page.locator('#screen');
  await canvas.click(); // focus for keyboard events

  const shots = {};
  shots.title = await shot(page, 'todo001-desktop-title');
  const titleStats = await canvasStats(page, [584, 602]); // PLAYER_Y..+H

  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  shots.afterEnter = await shot(page, 'todo001-desktop-afterEnter');
  const afterEnterStats = await canvasStats(page, [584, 602]);

  await page.waitForTimeout(2500);
  shots.playing = await shot(page, 'todo001-desktop-playing');
  const playingStats = await canvasStats(page, [584, 602]);

  // movement: arrow right hold 0.5s
  const before1 = await canvasStats(page, [584, 602]);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(50);
  const afterRight = await canvasStats(page, [584, 602]);

  const beforeLeft = await canvasStats(page, [584, 602]);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(50);
  const afterLeft = await canvasStats(page, [584, 602]);

  // space: bullet appears above player. Compare bright fraction in band just above player.
  const beforeSpaceStats = await canvasStats(page, [520, 584]);
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  const afterSpaceStats = await canvasStats(page, [520, 584]);

  // pause
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(150);
  shots.paused1 = await shot(page, 'todo001-desktop-paused1');
  const paused1 = await canvasStats(page, null);
  await page.waitForTimeout(600);
  shots.paused2 = await shot(page, 'todo001-desktop-paused2');
  const paused2 = await canvasStats(page, null);

  await page.keyboard.press('KeyP');
  await page.waitForTimeout(150);
  shots.resumed = await shot(page, 'todo001-desktop-resumed');

  log('desktop', {
    errors,
    shots,
    titleStats,
    afterEnterStats,
    playingStats,
    movement: {
      before1CentroidX: before1.centroidX,
      afterRightCentroidX: afterRight.centroidX,
      deltaRight: afterRight.centroidX - before1.centroidX,
      beforeLeftCentroidX: beforeLeft.centroidX,
      afterLeftCentroidX: afterLeft.centroidX,
      deltaLeft: afterLeft.centroidX - beforeLeft.centroidX,
    },
    fire: {
      beforeBrightFraction: beforeSpaceStats.brightFraction,
      afterBrightFraction: afterSpaceStats.brightFraction,
    },
    pauseStillness: {
      paused1BrightFraction: paused1.brightFraction,
      paused2BrightFraction: paused2.brightFraction,
      diff: Math.abs(paused1.brightFraction - paused2.brightFraction),
    },
  });

  await context.close();
}

async function mobile(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors = await collectErrors(page);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(300);

  const shots = {};
  shots.title = await shot(page, 'todo001-mobile-title');

  const left = page.locator('[data-action="left"], #btn-left, .btn-left').first();
  const right = page.locator('[data-action="right"], #btn-right, .btn-right').first();
  const fire = page.locator('[data-action="fire"], #btn-fire, .btn-fire').first();

  const buttonBoxes = {};
  for (const [name, loc] of [['left', left], ['right', right], ['fire', fire]]) {
    try {
      buttonBoxes[name] = await loc.boundingBox();
    } catch (e) {
      buttonBoxes[name] = 'ERROR: ' + e.message;
    }
  }

  const scrollCheck = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  // start via tap on fire (per implementer notes, FIRE/tap starts on title)
  await fire.tap();
  await page.waitForTimeout(400);
  shots.playing = await shot(page, 'todo001-mobile-playing');
  const playingStats = await canvasStats(page, [584, 602]);

  // movement via left button
  const beforeTap = await canvasStats(page, [584, 602]);
  await left.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
  await page.waitForTimeout(500);
  await left.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
  await page.waitForTimeout(50);
  const afterTap = await canvasStats(page, [584, 602]);

  // blur -> auto pause
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(200);
  shots.paused = await shot(page, 'todo001-mobile-paused');
  const pausedText = await page.evaluate(() => document.body.innerText.includes('PAUSED') || document.body.innerText.includes('TAP TO RESUME'));

  // resume via fire tap
  await fire.tap();
  await page.waitForTimeout(300);
  shots.resumed = await shot(page, 'todo001-mobile-resumed');

  log('mobile', {
    errors,
    shots,
    buttonBoxes,
    scrollCheck,
    horizontalScrollOk: scrollCheck.scrollWidth <= scrollCheck.innerWidth,
    playingStats,
    movement: {
      beforeCentroidX: beforeTap.centroidX,
      afterCentroidX: afterTap.centroidX,
      delta: afterTap.centroidX - beforeTap.centroidX,
    },
    pausedTextShown: pausedText,
  });

  await context.close();
}

// ← の移動量だけを測り直す（被弾する前の直後の 1 回、続けて → 1 回・← 1 回）。
async function leftRecheck(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = await collectErrors(page);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.locator('#screen').click();

  async function livesText() {
    return await page.locator('#hud-lives').innerText();
  }

  async function press(key) {
    const before = { centroidX: (await canvasStats(page, [584, 602])).centroidX, lives: await livesText() };
    await page.keyboard.down(key);
    await page.waitForTimeout(500);
    await page.keyboard.up(key);
    await page.waitForTimeout(50);
    const after = { centroidX: (await canvasStats(page, [584, 602])).centroidX, lives: await livesText() };
    return { before, after, hit: before.lives !== after.lives };
  }

  await page.keyboard.press('Enter');
  await page.waitForTimeout(50); // 開始直後、被弾する前

  const round1 = await press('ArrowLeft');
  const round2 = await press('ArrowRight');
  const round3 = await press('ArrowLeft');

  log('leftRecheck', { errors, round1, round2, round3 });
  await context.close();
}

async function localStorageDenied(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = await collectErrors(page);
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('denied');
      },
    });
  });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.locator('#screen').click();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const shotPath = await shot(page, 'todo001-desktop-lsdenied');

  log('localStorageDenied', { errors, shotPath });
  await context.close();
}

const browser = await chromium.launch();
if (process.argv.includes('--left-recheck')) {
  await leftRecheck(browser);
} else {
  await desktop(browser);
  await mobile(browser);
  await localStorageDenied(browser);
}
await browser.close();

fs.writeFileSync(
  process.env.HOME + '/tmp/playwright-mcp/todo001-results.json',
  JSON.stringify(results, null, 2)
);
console.log('DONE');
