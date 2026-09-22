// TODO-005 verifier script.
// Startup structure reused from archives/agents/TODO-003/verify-stars.mjs
// (that file itself is untouched).
//
// Playwright の touchscreen.tap は押し続けられないので、CDP の
// Input.dispatchTouchEvent (touchStart / touchMove / touchEnd) を使う。
//
// 自機の位置の取り方: 最初は drawPlayer(x, y) の moveTo(x+PLAYER_W/2, y) を
// フックする方法を試したが、敵の kind=1 も同じ ENEMY_COLORS[1]='#00e5ff' で
// glow するため、shadowColor/strokeStyle だけでは敵と自機の moveTo を
// 区別できず、実際には敵編隊の位置を「自機」として拾っていた（自機の
// 想定速度と大きく食い違う遅い値が出たことで発覚。詳細は verifier-report
// に書く）。drawPlayer は shadowBlur=16、drawEnemy は shadowBlur=12 と
// blur の値が違う点でも区別できるが、それでも「フックで判定する」方式は
// 描画の内部実装に強く依存し壊れやすいため、canvas の実ピクセルを
// getImageData で読み、シアン色（自機の色 '#00e5ff'）の横方向の範囲を
// PLAYER_Y 付近の 1 行だけ走査して求める方式に変更した（ground truth を
// ピクセル走査で取り、moveTo フックの値と突き合わせて後者が誤りだと
// 確認済み。verifier-report 参照）。編隊の敵がこの行の高さまで
// 短時間の測定中に降りてくることは無いので、シアンの塊は自機のみのはず。
// PLAYER_W = 34, PLAYER_Y = H-56 = 584 (game.ts の定数)。
//
// Usage: node verify-lever.mjs [baseUrl]
//   baseUrl: default http://localhost:4321/ytInvaders/

import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:4321/ytInvaders/';
const PLAYER_W = 34;
const OUT = 'archives/agents/TODO-005';

async function installBulletHook(page) {
  await page.addInitScript(() => {
    window.__bulletFireCount = 0;
    const proto = CanvasRenderingContext2D.prototype;
    const origFillRect = proto.fillRect;
    proto.fillRect = function (x, y, w, h) {
      // 自機の弾: glow('#ffffff', 14) の後 ctx.shadowColor = '#00e5ff' に
      // 上書きしてから fillRect する（render() のコメント参照）
      if (this.fillStyle === '#ffffff' && this.shadowColor === '#00e5ff') {
        window.__bulletFireCount++;
      }
      return origFillRect.call(this, x, y, w, h);
    };
  });
}

// canvas を getImageData で読み、自機の色（シアン, '#00e5ff'）の横方向の
// 範囲を PLAYER_Y 付近の 1 行だけ走査して求める。戻り値は論理座標 px
// （canvas の devicePixelRatio 分のスケールを戻した値）。
async function readPlayerXViaPixels(page) {
  return await page.evaluate(() => {
    const W = 480;
    const H = 640;
    const canvas = document.getElementById('screen');
    const ctx = canvas.getContext('2d');
    const dpr = canvas.width / W;
    const y = Math.floor(canvas.height * (600 / H)); // PLAYER_Y=584, 機体の胴の高さ
    const row = ctx.getImageData(0, y, canvas.width, 1).data;
    let minX = -1;
    let maxX = -1;
    for (let x = 0; x < canvas.width; x++) {
      const r = row[x * 4];
      const g = row[x * 4 + 1];
      const b = row[x * 4 + 2];
      const a = row[x * 4 + 3];
      if (a > 50 && g > 150 && b > 150 && r < 150) {
        if (minX === -1) minX = x;
        maxX = x;
      }
    }
    if (minX === -1) return null;
    return (minX + maxX) / 2 / dpr - 17; // PLAYER_W/2=17 を引いて機体左端(px)相当にする
  });
}

async function cdpTouch(client, type, x, y, id = 1) {
  await client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints:
      type === 'touchEnd'
        ? []
        : [{ x, y, id, radiusX: 5, radiusY: 5, force: 1 }],
  });
}

async function main() {
  const browser = await chromium.launch();
  const results = {};

  // ---- 1. 操作欄の高さ・レバー/FIRE の位置 ----
  async function measureLayout(label, contextOptions) {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(200);
    const data = await page.evaluate(() => {
      const touchEl = document.querySelector('.touch');
      const lever = document.getElementById('lever');
      const fire = document.getElementById('btn-fire');
      const canvas = document.getElementById('screen');
      const knob = document.getElementById('lever-knob');
      const touchVisible = touchEl && getComputedStyle(touchEl).display !== 'none';
      return {
        touchVisible,
        touchRect: touchEl ? touchEl.getBoundingClientRect().toJSON() : null,
        leverRect: lever ? lever.getBoundingClientRect().toJSON() : null,
        fireRect: fire ? fire.getBoundingClientRect().toJSON() : null,
        canvasRect: canvas ? canvas.getBoundingClientRect().toJSON() : null,
        knobRect: knob ? knob.getBoundingClientRect().toJSON() : null,
      };
    });
    await context.close();
    return { label, ...data };
  }

  results.layout = [];
  results.layout.push(
    await measureLayout('390x844-mobile', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }),
  );
  results.layout.push(
    await measureLayout('1920x1080-touchpc', { viewport: { width: 1920, height: 1080 }, hasTouch: true }),
  );
  results.layout.push(
    await measureLayout('1280x800-notouch', { viewport: { width: 1280, height: 800 } }),
  );
  results.layout.push(
    await measureLayout('667x375-mobile-landscape', { viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true }),
  );

  // ---- 2〜5. タッチ操作 (390x844) ----
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await installBulletHook(page);
    const client = await context.newCDPSession(page);
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(200);

    const layout = await page.evaluate(() => {
      const lever = document.getElementById('lever').getBoundingClientRect();
      const knob = document.getElementById('lever-knob').getBoundingClientRect();
      const fire = document.getElementById('btn-fire').getBoundingClientRect();
      return { lever: lever.toJSON(), knob: knob.toJSON(), fire: fire.toJSON() };
    });
    const leverCx = layout.lever.x + layout.lever.width / 2;
    const leverCy = layout.lever.y + layout.lever.height / 2;
    const radius = (layout.lever.width - layout.knob.width) / 2 - 4;

    async function tapFireOnce() {
      await cdpTouch(client, 'touchStart', layout.fire.x + layout.fire.width / 2, layout.fire.y + layout.fire.height / 2);
      await page.waitForTimeout(50);
      await cdpTouch(client, 'touchEnd', 0, 0);
      await page.waitForTimeout(50);
    }

    // 開始
    await tapFireOnce();
    await page.waitForTimeout(300);

    async function readPx() {
      return readPlayerXViaPixels(page);
    }

    async function recenterPlayer() {
      // 中心に戻す: キーボードではなく、実測前に一度レバーを中心へ押して待つのは
      // 速度 0 なので戻らない。README にある px 直接操作手段が無いため、
      // 画面幅の中心へ向けて反対方向へレバーを最大まで倒して 2 秒走らせ、
      // 端に到達させてから測る（端で止まるので確実に既知の位置になる）。
      await cdpTouch(client, 'touchStart', layout.lever.x + 2, leverCy);
      await page.waitForTimeout(50);
      await cdpTouch(client, 'touchMove', layout.lever.x + 2, leverCy);
      await page.waitForTimeout(900);
      await cdpTouch(client, 'touchEnd', 0, 0);
      await page.waitForTimeout(50);
      // 中心 W/2 - PLAYER_W/2 に戻すため、今度は右へ倒して中央付近まで走らせる
      await cdpTouch(client, 'touchStart', leverCx + radius, leverCy);
      await page.waitForTimeout(50);
      await cdpTouch(client, 'touchMove', leverCx + radius, leverCy);
      // 左端(margin=12)から中心(480/2-17=223)まで260px/sなら約0.85秒
      await page.waitForTimeout(850);
      await cdpTouch(client, 'touchEnd', 0, 0);
      await page.waitForTimeout(50);
    }

    async function measureSpeed(offsetFromCenter, name) {
      await recenterPlayer();
      const x = leverCx + offsetFromCenter;
      const y = leverCy;
      await cdpTouch(client, 'touchStart', x, y);
      await page.waitForTimeout(30);
      await cdpTouch(client, 'touchMove', x, y);
      const p0 = await readPx();
      await page.waitForTimeout(500);
      const p1 = await readPx();
      await cdpTouch(client, 'touchEnd', 0, 0);
      await page.waitForTimeout(50);
      const speed = (p1 - p0) / 0.5;
      return { name, offsetFromCenter, radius, p0, p1, speedPxPerSec: speed };
    }

    results.speed = [];
    results.speed.push(await measureSpeed(0, 'center'));
    results.speed.push(await measureSpeed(radius * 0.5, 'right-50%'));
    results.speed.push(await measureSpeed(radius, 'right-100%'));
    results.speed.push(await measureSpeed(-radius, 'left-100%'));
    // レバー欄の左端ぎりぎり (欄の左内側 + 1px)
    results.speed.push(await measureSpeed(layout.lever.x + 1 - leverCx, 'lever-left-edge'));

    // つまみが欄内に収まっているか（半径ちょうどのとき）
    await recenterPlayer();
    await cdpTouch(client, 'touchStart', leverCx + radius, leverCy);
    await page.waitForTimeout(30);
    await cdpTouch(client, 'touchMove', leverCx + radius, leverCy);
    await page.waitForTimeout(100);
    const knobAtEdge = await page.evaluate(() => {
      const lever = document.getElementById('lever').getBoundingClientRect();
      const knob = document.getElementById('lever-knob').getBoundingClientRect();
      return { lever: lever.toJSON(), knob: knob.toJSON() };
    });
    results.knobAtEdge = knobAtEdge;
    await cdpTouch(client, 'touchEnd', 0, 0);
    await page.waitForTimeout(50);

    // 3. 指を離したら止まる
    await recenterPlayer();
    await cdpTouch(client, 'touchStart', leverCx + radius, leverCy);
    await page.waitForTimeout(30);
    await cdpTouch(client, 'touchMove', leverCx + radius, leverCy);
    await page.waitForTimeout(300);
    await cdpTouch(client, 'touchEnd', 0, 0);
    // pointerup イベントの伝播（1 フレーム分程度）を待ってから 0.3 秒の測定を始める。
    // 直後に読むと、touchEnd が JS 側へ伝わる前の 1 フレームぶんの慣性が
    // 誤って「離した後の動き」として計測されるおそれがあるため
    await page.waitForTimeout(30);
    const afterRelease0 = await readPx();
    await page.waitForTimeout(300);
    const afterRelease1 = await readPx();
    results.stopOnRelease = { afterRelease0, afterRelease1, delta: afterRelease1 - afterRelease0 };

    // 4. 同時押し: レバー右端寄り + 別指で FIRE
    await recenterPlayer();
    await page.evaluate(() => { window.__bulletFireCount = 0; });
    // 先にレバーの指(id=1)だけを置く
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: leverCx + radius * 0.8, y: leverCy, id: 1, force: 1 }],
    });
    await page.waitForTimeout(100);
    const px0 = await readPx();
    // 別指(id=2)で FIRE を追加で押す。両方の touchPoint を含める必要がある
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: leverCx + radius * 0.8, y: leverCy, id: 1, force: 1 },
        { x: layout.fire.x + layout.fire.width / 2, y: layout.fire.y + layout.fire.height / 2, id: 2, force: 1 },
      ],
    });
    await page.waitForTimeout(400);
    const px1 = await readPx();
    const bulletCount = await page.evaluate(() => window.__bulletFireCount);
    // 指を両方離す
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [{ x: leverCx + radius * 0.8, y: leverCy, id: 1, force: 1 }],
    });
    await page.waitForTimeout(50);
    results.simultaneous = { px0, px1, deltaWhileFireHeld: px1 - px0, bulletFillRectCount: bulletCount };

    // スクリーンショット: 390x844 押していない / 左へ寄せて押している
    await recenterPlayer();
    await page.screenshot({ path: `${OUT}/lever-idle-390x844.png` });
    await cdpTouch(client, 'touchStart', leverCx - radius, leverCy);
    await page.waitForTimeout(30);
    await cdpTouch(client, 'touchMove', leverCx - radius, leverCy);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}/lever-left-390x844.png` });
    await cdpTouch(client, 'touchEnd', 0, 0);

    await context.close();
  }

  // ---- 5. 667x375 横向きのスクリーンショット ----
  {
    const context = await browser.newContext({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/lever-idle-667x375.png` });

    const layout = await page.evaluate(() => {
      const lever = document.getElementById('lever').getBoundingClientRect();
      return { lever: lever.toJSON() };
    });
    await cdpTouch(client, 'touchStart', layout.lever.x + 1, layout.lever.y + layout.lever.height / 2);
    await page.waitForTimeout(30);
    await cdpTouch(client, 'touchMove', layout.lever.x + 1, layout.lever.y + layout.lever.height / 2);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}/lever-left-667x375.png` });
    await cdpTouch(client, 'touchEnd', 0, 0);
    await context.close();
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

main();
