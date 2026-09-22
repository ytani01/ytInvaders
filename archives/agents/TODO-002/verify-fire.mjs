// TODO-002 verifier script (fire-on-release / cooldown-queue repro & fix check).
// Reused structure from archives/agents/TODO-001/verify.mjs (TODO-001 file itself is untouched).
//
// Usage:
//   node verify-fire.mjs [baseUrl] [mode]
//     baseUrl: default http://localhost:4321 (override if the preview server
//       picked a different port, e.g. because 4321 was already in use)
//     mode:
//       "before-1a1b" - 1a/1b だけ、pre-fix の game.ts に対して（canvas 画素の
//         ポーリングを使う。1〜2 回目で使った）
//       "after"       - (a)-(h) を canvas 画素のポーリングで測る（1〜2 回目で使った。
//         3 回目の指摘で、この機械では間に合わず値が揺れることが分かったため、
//         3 回目以降は下の "v3" を使う）
//       "v3"          - (a)(b)(c)(d)(h) を、fillRect をラップして実際に描かれた
//         自機の弾の y 座標と performance.now() を記録する方法で測る（3 回目）。
//         (e)(f)(g) は 2 回目の 0/10 をそのまま使うので、ここには無い
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4321';
const MODE = process.argv[3] || 'after'; // 'before-1a1b' | 'after' | 'v3'

// 論理解像度と自機の位置（game.ts と同じ値）
const PLAYER_Y = 640 - 56; // 584
const PLAYER_W = 34;
const MARGIN = 12;
const BAND_HALF_W = 4;
const BAND_HEIGHT = 200; // 自機の上端から上 200px

// シールドは makeShields()（game.ts）どおり: cols=11, rows=8, count=4, SHIELD_CELL=4, W=480。
// sw = 44, gap = (480 - 4*44) / 5 = 60.8。左端の隙間（gap0）は x = 0..60.8 で、
// 自機を左いっぱいに寄せる（px=MARGIN=12, 中心=29）とここに入り、シールドに当たらない。
// 参考: 何もしない場合の初期中心（240）も shield1(165.6-209.6) と shield2(270.4-314.4) の
// 間の隙間（209.6-270.4、中心 240）に一致しており、理屈のうえでは弾の経路にシールドは
// 無いはずだが、reviewer の指摘 4 を受けて念のため左端に寄せて測る。

async function hasPlayerBullet(page, bandHeight = BAND_HEIGHT) {
  return await page.evaluate(({ PLAYER_Y, BAND_HALF_W, bandHeight }) => {
    const c = document.getElementById('screen');
    const ctx = c.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // px（自機の x）を直接読めないので、まず自機の帯（PLAYER_Y..+18px）で重心 x を出し、
    // それを中心に弾の帯を取る。
    const bodyImg = ctx.getImageData(0, Math.round(PLAYER_Y * dpr), c.width, Math.round(18 * dpr));
    let sumX = 0, sumW = 0;
    for (let y = 0; y < bodyImg.height; y++) {
      for (let x = 0; x < bodyImg.width; x++) {
        const i = (y * bodyImg.width + x) * 4;
        const r = bodyImg.data[i], g = bodyImg.data[i + 1], b = bodyImg.data[i + 2], a = bodyImg.data[i + 3];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (a > 10 && lum > 60) {
          sumX += x;
          sumW += 1;
        }
      }
    }
    const shipCenterX = sumW > 0 ? sumX / sumW : c.width / 2;

    const x0 = Math.max(0, Math.round(shipCenterX - BAND_HALF_W * dpr));
    const x1 = Math.min(c.width, Math.round(shipCenterX + BAND_HALF_W * dpr));
    const y1 = Math.round(PLAYER_Y * dpr);
    const y0 = Math.max(0, Math.round((PLAYER_Y - bandHeight) * dpr));
    const img = ctx.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    let whiteCount = 0, totalBright = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2], a = img.data[i + 3];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (a > 10 && lum > 60) {
        totalBright++;
        if (r > 200 && g > 200 && b > 200) whiteCount++;
      }
    }
    return { hasBullet: whiteCount > 0, whiteCount, totalBright, shipCenterX };
  }, { PLAYER_Y, BAND_HALF_W, bandHeight });
}

// 弾の個数を数えるときは、帯を自機のすぐ上の細い帯に絞る。BAND_HEIGHT(200px) のままだと、
// 弾の速さ(620px/s)とcooldown(0.35s)の組み合わせで、連続する弾の「帯の中にいる時間」同士が
// ほぼ切れ目なくつながってしまい、白画素が 0 になる一瞬（数十ms）を数フレームおきの
// ポーリングで拾えず、複数発を 1 つの塊として数えてしまうことがある（実測で確認）。
// 帯を 60px（自機の上端から上、通過に要する時間 ≈ 60/620 ≈ 0.097s）まで狭めると、
// 1 発ごとの帯滞在時間が cooldown（0.35s）よりずっと短くなり、塊の区切りが安定する。
const BURST_BAND_HEIGHT = 60;

// windowMs の間、pollMs おきに帯を見て、一度でも弾が写ったかを判定する（1 回だけ見ない）。
async function pollForBullet(page, windowMs, pollMs = 16) {
  const start = Date.now();
  let seen = false;
  let tFirstMs = null;
  const samples = [];
  while (Date.now() - start < windowMs) {
    const stat = await hasPlayerBullet(page);
    samples.push({ t: Date.now() - start, whiteCount: stat.whiteCount });
    if (stat.hasBullet && !seen) {
      seen = true;
      tFirstMs = Date.now() - start;
    }
    await page.waitForTimeout(pollMs);
  }
  return { seen, tFirstMs, samples };
}

// samples（{t, whiteCount}[]）から、白画素の塊（弾）の個数を数える。
function countBursts(samples) {
  let bursts = 0;
  let inBurst = false;
  for (const s of samples) {
    if (s.whiteCount > 0 && !inBurst) {
      bursts++;
      inBurst = true;
    } else if (s.whiteCount === 0) {
      inBurst = false;
    }
  }
  return bursts;
}

async function livesText(page) {
  return await page.locator('#hud-lives').innerText();
}

async function freshPage(browser, { moveIntoGap = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.locator('#screen').click();
  await page.keyboard.press('Enter');
  if (moveIntoGap) {
    // 左いっぱいに寄せてシールドの隙間（gap0）に入れる。PLAYER_SPEED=260px/s、
    // 初期中心からの距離は最大でも 240-29=211px なので 211/260≈0.81s。余裕を見て 1s。
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(1000);
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(50);
  } else {
    await page.waitForTimeout(50);
  }
  return { context, page };
}

// ---- 1a/1b: すぐ離す押下（直す前・直した後、共通で使う） ----
async function testQuickRelease(browser, { useDownUpGap, count = 20 } = {}) {
  const { context, page } = await freshPage(browser);
  let fired = 0;
  let aborted = 0;
  for (let i = 0; i < count; i++) {
    const before = await livesText(page);
    if (useDownUpGap) {
      await page.keyboard.down('Space');
      await page.waitForTimeout(50);
      await page.keyboard.up('Space');
    } else {
      await page.keyboard.press('Space');
    }
    const poll = await pollForBullet(page, 500, 16); // 1 回だけでなく 0.5 秒の間続けて見る
    const after = await livesText(page);
    if (after !== before) {
      aborted++;
    } else if (poll.seen) {
      fired++;
    }
    await page.waitForTimeout(100); // 次の回まで（0.6s 間隔 = 上の 0.5s + ここ 0.1s）
  }
  await context.close();
  return { fired, total: count, aborted };
}

// ---- 2 / (b): 押しっぱなし 0.5 秒 ----
async function testHold(browser) {
  const { context, page } = await freshPage(browser);
  await page.keyboard.down('Space');
  const samples = [];
  const start = Date.now();
  while (Date.now() - start < 500) {
    const stat = await hasPlayerBullet(page, BURST_BAND_HEIGHT);
    samples.push({ t: Date.now() - start, whiteCount: stat.whiteCount });
    await page.waitForTimeout(20);
  }
  await page.keyboard.up('Space');
  await context.close();
  return { bursts: countBursts(samples) };
}

// ---- 3（直す前）: すぐ離す押下 1 回、0.15 秒後にもう 1 回。2 回目から 0.4 秒以内に弾が出たか ----
async function testQueueDuringCooldown_v1(browser) {
  const { context, page } = await freshPage(browser);
  let secondShotFired = 0;
  let aborted = 0;
  for (let i = 0; i < 10; i++) {
    const before = await livesText(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    await page.keyboard.press('Space');
    const poll = await pollForBullet(page, 400, 16);
    const after = await livesText(page);
    if (after !== before) aborted++;
    else if (poll.seen) secondShotFired++;
    await page.waitForTimeout(700);
  }
  await context.close();
  return { secondShotFired, total: 10, aborted };
}

// ---- (c): 1 発目が出たのを確かめた直後に押すと、約 0.35 秒後に 2 発目が出るか。出た時刻も記録 ----
async function testSecondShotTiming(browser, count = 10) {
  const { context, page } = await freshPage(browser);
  const rounds = [];
  for (let i = 0; i < count; i++) {
    const before = await livesText(page);
    await page.keyboard.press('Space'); // 1 発目
    const p1 = await pollForBullet(page, 300, 10);
    if (!p1.seen) {
      rounds.push({ ok: false, note: '1発目が出なかったので対象外' });
      await page.waitForTimeout(700);
      continue;
    }
    await page.keyboard.press('Space'); // 1発目を確認した直後にもう1回
    const t0 = Date.now();
    const p2 = await pollForBullet(page, 600, 10);
    const after = await livesText(page);
    if (after !== before) {
      rounds.push({ ok: false, note: '被弾' });
    } else {
      rounds.push({
        ok: true,
        secondShotFired: p2.seen,
        secondShotAtMs: p2.tFirstMs,
      });
    }
    await page.waitForTimeout(700);
  }
  await context.close();
  return rounds;
}

// ---- (d): 1発目の後、撃てない間に3回押しても、出るのは1発だけ ----
async function testQueueCollapsesToOne(browser, count = 10) {
  const { context, page } = await freshPage(browser);
  const rounds = [];
  for (let i = 0; i < count; i++) {
    const before = await livesText(page);
    await page.keyboard.press('Space'); // 1発目
    await page.waitForTimeout(30);
    await page.keyboard.press('Space'); // cooldown中に3回
    await page.waitForTimeout(30);
    await page.keyboard.press('Space');
    await page.waitForTimeout(30);
    await page.keyboard.press('Space');
    // 1.2秒見て、白い塊(弾)がいくつ出たか数える(1発目+最大1発のqueue=2発のはず)。
    // 帯は自機のすぐ上の細い帯に絞る（BURST_BAND_HEIGHT、理由は hasPlayerBullet 付近のコメント）。
    const samples = [];
    const start = Date.now();
    while (Date.now() - start < 1200) {
      const stat = await hasPlayerBullet(page, BURST_BAND_HEIGHT);
      samples.push({ t: Date.now() - start, whiteCount: stat.whiteCount });
      await page.waitForTimeout(20);
    }
    const after = await livesText(page);
    if (after !== before) {
      rounds.push({ ok: false, note: '被弾' });
    } else {
      rounds.push({ ok: true, bursts: countBursts(samples) });
    }
    await page.waitForTimeout(400);
  }
  await context.close();
  return rounds;
}

// ---- (e): 一時停止中にSpaceを押してからPで再開しても撃たない ----
async function testNoFireAfterPauseResume(browser, count = 10) {
  const { context, page } = await freshPage(browser);
  const rounds = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('KeyP'); // pause
    await page.waitForTimeout(200);
    await page.keyboard.press('Space'); // paused中に押す(覚えられるとしたら困る)
    await page.waitForTimeout(200); // 0.2秒以上空ける
    await page.keyboard.press('KeyP'); // resume
    const poll = await pollForBullet(page, 400, 16);
    rounds.push({ firedAfterResume: poll.seen });
    await page.waitForTimeout(500);
  }
  await context.close();
  return rounds;
}

// ---- (f): タイトルでSpaceを押してからEnterで始めても、始めた直後に撃たない ----
async function testNoFireOnStartFromTitle(browser, count = 10) {
  const rounds = [];
  for (let i = 0; i < count; i++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    // canvas を click() すると pointerdown が startOrContinue() を呼んでしまい、
    // まだ Space を押す前にゲームが始まってしまう（キー入力は window に付いているので
    // フォーカスは不要）。ここでは click() しない。
    await page.keyboard.press('Space'); // title で押す
    await page.waitForTimeout(200); // 0.2秒以上空ける
    await page.keyboard.press('Enter'); // 開始
    const poll = await pollForBullet(page, 400, 16);
    rounds.push({ firedRightAfterStart: poll.seen });
    await context.close();
  }
  return rounds;
}

// ---- (g): blurの後、Enterで再開しても撃たない ----
async function testNoFireAfterBlurResume(browser, count = 10) {
  const { context, page } = await freshPage(browser);
  const rounds = [];
  for (let i = 0; i < count; i++) {
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); // auto-pause
    await page.waitForTimeout(100);
    await page.keyboard.press('Space'); // 一時停止中に押す
    await page.waitForTimeout(200); // 0.2秒以上空ける
    await page.keyboard.press('Enter'); // 再開
    const poll = await pollForBullet(page, 400, 16);
    rounds.push({ firedAfterResume: poll.seen });
    await page.waitForTimeout(500);
  }
  await context.close();
  return rounds;
}

// ---- (h): スマホ390x844・hasTouchで、FIREボタンをtapしたとき毎回弾が出る ----
async function testMobileFireTap(browser, count = 10) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const fire = page.locator('#btn-fire');
  await fire.tap(); // 開始
  await page.waitForTimeout(500);
  let fired = 0;
  let aborted = 0;
  for (let i = 0; i < count; i++) {
    const before = await page.locator('#hud-lives').innerText();
    await fire.tap();
    const poll = await pollForBullet(page, 500, 16);
    const after = await page.locator('#hud-lives').innerText();
    if (after !== before) aborted++;
    else if (poll.seen) fired++;
    await page.waitForTimeout(600);
  }
  await context.close();
  return { fired, total: count, aborted };
}

// ==== 3 回目: fillRect をラップして自機の弾の y を直接記録する（canvas 画素の
// ポーリングは、この機械では間に合わず値が揺れるため使わない） ====
//
// game.ts の fillRect 呼び出しで w=3, h=12 になるのは自機の弾（playerBullets、
// game.ts:622）だけ（確認した内訳: 目 3x3・UFO の飾り 3x3・シールドのセル
// 約3.5x3.5・星 0.8z x 2z（z は 1..3 なので高さは最大 6）・地面の線 W x1.5・
// 背景塗り W x H・パーティクル 3x3。どれも w=3 かつ h=12 にはならない）。
const SPAWN_Y = PLAYER_Y - 12; // 572。自機の弾はここで生まれる
const SPAWN_BAND = 20; // 発射位置から上へ 20px 以内

async function newLoggedContext(browser, contextOptions) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(() => {
    window.__shots = [];
    const orig = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      if (w === 3 && h === 12) {
        window.__shots.push({ t: performance.now(), y });
      }
      return orig.call(this, x, y, w, h);
    };
  });
  return context;
}

async function clearShots(page) {
  await page.evaluate(() => {
    window.__shots = [];
  });
}

async function readShots(page) {
  return await page.evaluate(() => window.__shots.slice());
}

// samples（{t,y}[]、記録順 = 時刻順）から、「発射位置の近くに現れた最初のフレーム」ごとに
// 1 回とみなして、発射時刻（performance.now() の ms）の配列を返す。同じ弾が数フレーム
// 続けて発射位置の近くに写っても、間が 100ms 以内なら同じ発射としてまとめる。
function extractShotTimes(samples) {
  const lo = SPAWN_Y - SPAWN_BAND;
  const hi = SPAWN_Y;
  const times = [];
  let last = -Infinity;
  for (const s of samples) {
    if (s.y >= lo - 0.01 && s.y <= hi + 0.01) {
      if (s.t - last > 100) times.push(s.t);
      last = s.t;
    }
  }
  return times;
}

async function freshLoggedPage(browser, contextOptions = { viewport: { width: 1280, height: 800 } }) {
  const context = await newLoggedContext(browser, contextOptions);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  // 左いっぱいに寄せてシールドの隙間に入れる（自機はシールドの間に置いたままでよい、との指示どおり）
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(50);
  await clearShots(page); // ここまでの移動中に出た弾（無いはず）を捨てる
  return { context, page };
}

// (a) すぐ離す（press）5 回。間隔 1.2 秒。各回の発射の有無
async function v3_testQuickRelease(browser, count = 5) {
  const { context, page } = await freshLoggedPage(browser);
  const rounds = [];
  for (let i = 0; i < count; i++) {
    await clearShots(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500); // 弾が発射位置を通り過ぎるのに十分な間
    const shots = extractShotTimes(await readShots(page));
    rounds.push({ fired: shots.length > 0, shotCount: shots.length });
    await page.waitForTimeout(700); // 合計 1.2 秒間隔
  }
  await context.close();
  return rounds;
}

// (b) 0.5 秒の押しっぱなし 3 回。各回の発射数（期待 2）
async function v3_testHold(browser, count = 3) {
  const { context, page } = await freshLoggedPage(browser);
  const rounds = [];
  for (let i = 0; i < count; i++) {
    await clearShots(page);
    await page.keyboard.down('Space');
    await page.waitForTimeout(500);
    await page.keyboard.up('Space');
    await page.waitForTimeout(100); // 離した直後の最後の 1 発が描かれるのを待つ
    const shots = extractShotTimes(await readShots(page));
    rounds.push({ shotCount: shots.length, shotTimesMs: shots });
    await page.waitForTimeout(700);
  }
  await context.close();
  return rounds;
}

// (c) 3 回。1 発目と、1 発目の直後（50ms 以内）に押した 2 発目の、発射時刻の差（期待 約350ms）
async function v3_testSecondShotTiming(browser, count = 3) {
  const { context, page } = await freshLoggedPage(browser);
  const rounds = [];
  for (let i = 0; i < count; i++) {
    await clearShots(page);
    await page.keyboard.press('Space'); // 1発目
    // 1発目が発射位置に現れるのを待つ（cooldown はすぐ切れているはずなので数フレームのはず）
    let first = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 200) {
      first = extractShotTimes(await readShots(page));
      if (first.length > 0) break;
      await page.waitForTimeout(10);
    }
    if (first.length === 0) {
      rounds.push({ ok: false, note: '1発目が出なかったので対象外' });
      await page.waitForTimeout(700);
      continue;
    }
    await page.keyboard.press('Space'); // 1発目を検出してから 50ms 以内に 2発目
    await page.waitForTimeout(600); // 2発目（約350ms後のはず）が発射位置を通り過ぎるまで待つ
    const shots = extractShotTimes(await readShots(page));
    if (shots.length >= 2) {
      rounds.push({ ok: true, diffMs: shots[1] - shots[0], shotTimesMs: shots });
    } else {
      rounds.push({ ok: false, note: `2発目が検出できなかった（記録: ${shots.length} 発）`, shotTimesMs: shots });
    }
    await page.waitForTimeout(700);
  }
  await context.close();
  return rounds;
}

// (d) 3 回。1発目の直後に 0.1 秒おきに 3 回押す。1.5 秒の間の発射数（期待 2）
async function v3_testQueueCollapsesToOne(browser, count = 3) {
  const { context, page } = await freshLoggedPage(browser);
  const rounds = [];
  for (let i = 0; i < count; i++) {
    await clearShots(page);
    await page.keyboard.press('Space'); // 1発目
    await page.waitForTimeout(100);
    await page.keyboard.press('Space'); // 撃てない間に 3 回
    await page.waitForTimeout(100);
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    await page.keyboard.press('Space');
    await page.waitForTimeout(1200); // 合計 1.5 秒見る
    const shots = extractShotTimes(await readShots(page));
    rounds.push({ shotCount: shots.length, shotTimesMs: shots });
    await page.waitForTimeout(400);
  }
  await context.close();
  return rounds;
}

// (h) スマホ 390x844・hasTouch で FIRE の tap 5 回、間隔 1.2 秒
async function v3_testMobileFireTap(browser, count = 5) {
  const context = await newLoggedContext(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const fire = page.locator('#btn-fire');
  await fire.tap(); // 開始
  await page.waitForTimeout(500);
  await clearShots(page);
  const rounds = [];
  for (let i = 0; i < count; i++) {
    await clearShots(page);
    await fire.tap();
    await page.waitForTimeout(500);
    const shots = extractShotTimes(await readShots(page));
    rounds.push({ fired: shots.length > 0, shotCount: shots.length });
    await page.waitForTimeout(700); // 合計 1.2 秒間隔
  }
  await context.close();
  return rounds;
}

const browser = await chromium.launch();

if (MODE === 'before-1a1b') {
  // reviewer 指摘 4 を受けて直した測り方で、直す前の 1a・1b だけ測り直す。
  const pressResult = await testQuickRelease(browser, { useDownUpGap: false });
  const downUp50msResult = await testQuickRelease(browser, { useDownUpGap: true });
  console.log(JSON.stringify({
    mode: 'before-1a1b (fixed measurement)',
    quickRelease_press: pressResult,
    quickRelease_downUp50ms: downUp50msResult,
  }, null, 2));
} else if (MODE === 'v3') {
  // 3 回目: canvas 画素のポーリングをやめ、fillRect をラップして自機の弾の
  // y と performance.now() を直接記録する。(e)(f)(g) は 2 回目の 0/10 をそのまま使うので、
  // ここでは測らない。
  const a = await v3_testQuickRelease(browser, 5);
  const b = await v3_testHold(browser, 3);
  const c = await v3_testSecondShotTiming(browser, 3);
  const d = await v3_testQueueCollapsesToOne(browser, 3);
  const h = await v3_testMobileFireTap(browser, 5);
  console.log(JSON.stringify({
    mode: 'v3 (fillRect logging)',
    a_quickRelease: a,
    b_hold500ms: b,
    c_secondShotTiming: c,
    d_queueCollapsesToOne: d,
    h_mobileFireTap: h,
  }, null, 2));
} else {
  const a = await testQuickRelease(browser, { useDownUpGap: false, count: 20 });
  const b = await testHold(browser);
  const c = await testSecondShotTiming(browser, 10);
  const d = await testQueueCollapsesToOne(browser, 10);
  const e = await testNoFireAfterPauseResume(browser, 10);
  const f = await testNoFireOnStartFromTitle(browser, 10);
  const g = await testNoFireAfterBlurResume(browser, 10);
  const h = await testMobileFireTap(browser, 10);

  console.log(JSON.stringify({
    mode: 'after (post-fix confirmation)',
    a_quickRelease: a,
    b_hold500ms: b,
    c_secondShotTiming: c,
    d_queueCollapsesToOne: d,
    e_noFireAfterPauseResume: e,
    f_noFireOnStartFromTitle: f,
    g_noFireAfterBlurResume: g,
    h_mobileFireTap: h,
  }, null, 2));
}

await browser.close();
