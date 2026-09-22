// ゲーム本体。前半は DOM・Canvas に触らない純粋な関数（tests/ から import する）、
// 後半の startGame() が Canvas とキー入力をつなぐ。
// モジュールの読み込み時には window / document に触らない。

import { Sfx } from './audio.ts';

// ---- 論理解像度 ----
const W = 480;
const H = 640;

// ---- 当たり判定 ----
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 重なっていれば true。辺が接しているだけなら false。
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// ---- 編隊 ----
export interface Enemy {
  rx: number; // 編隊の原点からの相対位置
  ry: number;
  w: number;
  h: number;
  kind: number; // 0..2
  alive: boolean;
}

export interface Formation {
  ox: number;
  oy: number;
  dir: number; // 1 = 右, -1 = 左
}

export const DROP = 16; // 端で下がる量
const MARGIN = 12; // 画面の左右の余白

// 生き残りが少ないほど速い。wave が進むほど基本の速さも上がる。
export function formationSpeed(alive: number, total: number, wave: number): number {
  if (total <= 0) return 0;
  const base = 24 + 8 * (wave - 1);
  const ratio = 1 - alive / total; // 0 .. 1
  return base * (1 + 5 * ratio * ratio + 1.5 * ratio);
}

export function enemyRect(f: Formation, e: Enemy): Rect {
  return { x: f.ox + e.rx, y: f.oy + e.ry, w: e.w, h: e.h };
}

// 生きている敵の外枠。いなければ null。
export function formationBounds(f: Formation, enemies: Enemy[]): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    const x = f.ox + e.rx;
    const y = f.oy + e.ry;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + e.w > maxX) maxX = x + e.w;
    if (y + e.h > maxY) maxY = y + e.h;
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// 編隊を dt 秒ぶん動かした新しい状態を返す。端に着いたら端で止め、
// 1 段下がって向きを変える。引数は書き換えない。
export function stepFormation(
  f: Formation,
  enemies: Enemy[],
  speed: number,
  dt: number,
  width: number = W,
  margin: number = MARGIN,
): Formation {
  const b = formationBounds(f, enemies);
  if (!b) return { ...f };
  const dx = f.dir * speed * dt;
  const right = width - margin;
  if (f.dir > 0 && b.x + b.w + dx >= right) {
    return { ox: f.ox + (right - (b.x + b.w)), oy: f.oy + DROP, dir: -1 };
  }
  if (f.dir < 0 && b.x + dx <= margin) {
    return { ox: f.ox + (margin - b.x), oy: f.oy + DROP, dir: 1 };
  }
  return { ox: f.ox + dx, oy: f.oy, dir: f.dir };
}

const COLS = 11;
const ROWS = 5;
const CELL_W = 34;
const CELL_H = 32;
const ENEMY_W = 26;
const ENEMY_H = 18;

export function makeEnemies(): Enemy[] {
  const list: Enemy[] = [];
  for (let r = 0; r < ROWS; r++) {
    const kind = r === 0 ? 2 : r < 3 ? 1 : 0;
    for (let c = 0; c < COLS; c++) {
      list.push({ rx: c * CELL_W, ry: r * CELL_H, w: ENEMY_W, h: ENEMY_H, kind, alive: true });
    }
  }
  return list;
}

export function startFormation(wave: number): Formation {
  const width = (COLS - 1) * CELL_W + ENEMY_W;
  return { ox: (W - width) / 2, oy: 90 + Math.min(wave - 1, 6) * 12, dir: 1 };
}

// ---- ハイスコア（localStorage が使えないときは 0 / 何もしない） ----
const HI_KEY = 'ytinvaders.hiscore';

function loadHigh(): number {
  try {
    const v = Number(globalThis.localStorage?.getItem(HI_KEY) ?? 0);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

function saveHigh(v: number): void {
  try {
    globalThis.localStorage?.setItem(HI_KEY, String(v));
  } catch {
    // 保存できなくてもゲームは続ける
  }
}

// ---- 移動のレバー ----
// 中心から半径のこの割合までは倒しても動かない（触れただけで流れないように）
export const LEVER_DEAD = 0.15;

// レバーを中心から横に dx 動かしたときの倒し量（-1..1）。半径より外は端まで倒したのと同じ。
// 動かない範囲の外側から 0 で始まり、倒した量に比例して端で 1 になる。
export function leverAxis(dx: number, radius: number): number {
  const t = Math.max(-1, Math.min(1, dx / radius));
  const a = Math.abs(t);
  if (a <= LEVER_DEAD) return 0;
  return (Math.sign(t) * (a - LEVER_DEAD)) / (1 - LEVER_DEAD);
}

// ---- ここから下は描画と入力 ----

interface HudEls {
  score: HTMLElement;
  hi: HTMLElement;
  lives: HTMLElement;
  wave: HTMLElement;
}

interface TouchEls {
  lever: HTMLElement; // 触れる範囲。真ん中が止まる位置
  leverKnob: HTMLElement; // 触っている位置へ左右に動くつまみ
  fire: HTMLElement;
}

interface Bullet extends Rect {
  vy: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}

interface Star {
  x: number;
  y: number;
  z: number; // 1..3。大きいほど手前で速い
}

interface Ufo extends Rect {
  vx: number;
}

type Mode = 'title' | 'playing' | 'paused' | 'gameover';

const STEP = 1 / 120; // 固定の時間刻み
const MAX_FRAME = 0.25; // タブ復帰などで dt が大きくなったときの上限
const RESTART_LOCK = 1; // ゲームオーバー後、やり直しを受け付けない秒数

const PLAYER_W = 34;
const PLAYER_H = 18;
const PLAYER_Y = H - 56;
const PLAYER_SPEED = 260;
const PLAYER_BULLET_SPEED = 620;
const FIRE_COOLDOWN = 0.35;
const SHIELD_CELL = 4;
const SHIELD_Y = H - 150;

const ENEMY_COLORS = ['#39ff14', '#00e5ff', '#ff2bd6'];
const ENEMY_POINTS = [10, 20, 30];
const UFO_POINTS = [50, 100, 150, 300];

function makeShields(): Rect[] {
  const cells: Rect[] = [];
  const cols = 11;
  const rows = 8;
  const count = 4;
  const sw = cols * SHIELD_CELL;
  const gap = (W - count * sw) / (count + 1);
  for (let s = 0; s < count; s++) {
    const x0 = gap + s * (sw + gap);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 上の角を落とし、下の中央をアーチ状にくり抜く
        if (r === 0 && (c < 2 || c > cols - 3)) continue;
        if (r === 1 && (c === 0 || c === cols - 1)) continue;
        if (r >= rows - 3 && c >= 3 && c <= cols - 4) continue;
        cells.push({ x: x0 + c * SHIELD_CELL, y: SHIELD_Y + r * SHIELD_CELL, w: SHIELD_CELL, h: SHIELD_CELL });
      }
    }
  }
  return cells;
}

export function startGame(canvas: HTMLCanvasElement, hud: HudEls, touch: TouchEls): void {
  const ctxOrNull = canvas.getContext('2d');
  if (!ctxOrNull) return;
  const ctx: CanvasRenderingContext2D = ctxOrNull;
  const sfx = new Sfx();

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;

  // ---- 状態 ----
  let mode: Mode = 'title';
  let score = 0;
  let hi = loadHigh();
  let lives = 3;
  let wave = 1;
  let enemies: Enemy[] = [];
  let formation: Formation = startFormation(1);
  let animDist = 0;
  let px = W / 2 - PLAYER_W / 2;
  let cooldown = 0;
  let invuln = 0;
  let playerBullets: Bullet[] = [];
  let enemyBullets: Bullet[] = [];
  let shields: Rect[] = [];
  let enemyFireTimer = 0;
  let ufo: Ufo | null = null;
  let ufoTimer = 0;
  let banner = 0;
  let shake = 0;
  let time = 0;
  let overAt = 0; // ゲームオーバーになった時刻
  let particles: Particle[] = [];
  const stars: Star[] = [];
  for (let i = 0; i < 90; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, z: 1 + Math.random() * 2 });
  }

  // axis はレバーの倒し量（-1..1）。キーの左右と足して使う
  const input = { left: false, right: false, fire: false, axis: 0 };
  // 押して離すまでが 1 フレームより短い押下や、撃てない間の押下を取りこぼさないよう、
  // 押したことを覚えておき、撃てるようになった時点で 1 発出す
  let fireQueued = false;

  function newWave(): void {
    enemies = makeEnemies();
    shields = makeShields();
    formation = startFormation(wave);
    playerBullets = [];
    enemyBullets = [];
    enemyFireTimer = 1.5;
    ufoTimer = 12 + Math.random() * 10;
    ufo = null;
    banner = 1.6;
  }

  function newGame(): void {
    score = 0;
    lives = 3;
    wave = 1;
    px = W / 2 - PLAYER_W / 2;
    invuln = 0;
    cooldown = 0;
    particles = [];
    newWave();
    mode = 'playing';
  }

  function addScore(n: number): void {
    score += n;
    if (score > hi) hi = score;
  }

  function spark(x: number, y: number, color: string, n: number, spd: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = spd * (0.3 + Math.random() * 0.7);
      const life = 0.4 + Math.random() * 0.5;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color });
    }
  }

  function gameOver(): void {
    mode = 'gameover';
    overAt = time;
    saveHigh(hi);
  }

  function hitPlayer(): void {
    lives--;
    shake = 14;
    spark(px + PLAYER_W / 2, PLAYER_Y + PLAYER_H / 2, '#00e5ff', 50, 260);
    sfx.playerHit();
    enemyBullets = [];
    if (lives <= 0) {
      gameOver();
    } else {
      invuln = 2;
    }
  }

  // 弾とシールドの判定。当たったセルは消す。
  function hitShield(b: Rect): boolean {
    for (let i = 0; i < shields.length; i++) {
      if (overlaps(b, shields[i])) {
        const s = shields[i];
        shields.splice(i, 1);
        spark(s.x + 2, s.y + 2, '#ffe14d', 4, 80);
        sfx.shieldHit();
        return true;
      }
    }
    return false;
  }

  function update(dt: number): void {
    time += dt;
    for (const s of stars) {
      s.y += s.z * s.z * 12 * dt;
      if (s.y > H) {
        s.y -= H;
        s.x = Math.random() * W;
      }
    }
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2 * dt;
      p.vy *= 1 - 2 * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    shake = Math.max(0, shake - 40 * dt);

    if (mode !== 'playing') {
      fireQueued = false;
      return;
    }

    if (banner > 0) banner -= dt;
    if (invuln > 0) invuln -= dt;
    if (cooldown > 0) cooldown -= dt;

    // 自機
    const mv = Math.max(-1, Math.min(1, (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.axis));
    px = Math.min(W - MARGIN - PLAYER_W, Math.max(MARGIN, px + mv * PLAYER_SPEED * dt));
    if ((input.fire || fireQueued) && cooldown <= 0 && playerBullets.length < 2) {
      fireQueued = false;
      playerBullets.push({ x: px + PLAYER_W / 2 - 1.5, y: PLAYER_Y - 12, w: 3, h: 12, vy: -PLAYER_BULLET_SPEED });
      cooldown = FIRE_COOLDOWN;
      sfx.shoot();
    }

    // 編隊
    const alive = enemies.filter((e) => e.alive);
    const speed = formationSpeed(alive.length, enemies.length, wave);
    formation = stepFormation(formation, enemies, speed, dt);
    animDist += speed * dt;

    // 敵の射撃: 各列の一番下にいる敵から撃つ
    enemyFireTimer -= dt;
    if (enemyFireTimer <= 0 && alive.length > 0 && enemyBullets.length < 3 + wave) {
      const bottoms = new Map<number, Enemy>();
      for (const e of alive) {
        const cur = bottoms.get(e.rx);
        if (!cur || e.ry > cur.ry) bottoms.set(e.rx, e);
      }
      const shooters = [...bottoms.values()];
      // 自機の近くの列を少し狙いやすくする
      shooters.sort((a, b) => Math.abs(formation.ox + a.rx - px) - Math.abs(formation.ox + b.rx - px));
      const pick = Math.random() < 0.4 ? shooters[0] : shooters[Math.floor(Math.random() * shooters.length)];
      const r = enemyRect(formation, pick);
      enemyBullets.push({ x: r.x + r.w / 2 - 2, y: r.y + r.h, w: 4, h: 12, vy: 200 + wave * 15 });
      sfx.enemyShoot();
      enemyFireTimer = (0.5 + Math.random() * 0.8) / (1 + 0.15 * (wave - 1));
    }

    // UFO
    if (ufo) {
      ufo.x += ufo.vx * dt;
      if (ufo.x > W + 50 || ufo.x < -90) ufo = null;
    } else {
      ufoTimer -= dt;
      if (ufoTimer <= 0) {
        const fromLeft = Math.random() < 0.5;
        ufo = { x: fromLeft ? -44 : W + 4, y: 48, w: 40, h: 16, vx: fromLeft ? 110 : -110 };
        ufoTimer = 15 + Math.random() * 10;
      }
    }

    // 自機の弾
    for (const b of playerBullets) b.y += b.vy * dt;
    playerBullets = playerBullets.filter((b) => {
      if (b.y + b.h < 0) return false;
      if (hitShield(b)) return false;
      for (const e of enemies) {
        if (!e.alive) continue;
        const r = enemyRect(formation, e);
        if (overlaps(b, r)) {
          e.alive = false;
          addScore(ENEMY_POINTS[e.kind]);
          spark(r.x + r.w / 2, r.y + r.h / 2, ENEMY_COLORS[e.kind], 24, 220);
          shake = Math.max(shake, 3);
          sfx.explode();
          return false;
        }
      }
      if (ufo && overlaps(b, ufo)) {
        const pts = UFO_POINTS[Math.floor(Math.random() * UFO_POINTS.length)];
        addScore(pts);
        spark(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, '#ff3355', 40, 260);
        shake = Math.max(shake, 6);
        sfx.ufo();
        ufo = null;
        return false;
      }
      return true;
    });

    // 敵の弾
    for (const b of enemyBullets) b.y += b.vy * dt;
    const playerRect: Rect = { x: px, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H };
    let playerWasHit = false;
    enemyBullets = enemyBullets.filter((b) => {
      if (b.y > H) return false;
      if (hitShield(b)) return false;
      if (!playerWasHit && invuln <= 0 && overlaps(b, playerRect)) playerWasHit = true;
      return true;
    });
    if (playerWasHit) {
      hitPlayer(); // 画面の敵弾もここで消える
      if (mode !== 'playing') return;
    }

    // 敵がシールドを削る・自機の高さまで来たら終わり
    const fb = formationBounds(formation, enemies);
    if (fb) {
      if (fb.y + fb.h >= SHIELD_Y) {
        for (const e of enemies) {
          if (!e.alive) continue;
          const r = enemyRect(formation, e);
          shields = shields.filter((s) => !overlaps(s, r));
        }
      }
      if (fb.y + fb.h >= PLAYER_Y) {
        lives = 0;
        shake = 14;
        sfx.playerHit();
        gameOver();
        return;
      }
    } else {
      // 全滅させたら次のウェーブ
      wave++;
      addScore(100);
      sfx.wave();
      newWave();
    }
  }

  // ---- 描画 ----
  function glow(color: string, blur: number): void {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
  }

  function drawEnemy(r: Rect, kind: number, frame: number): void {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    glow(ENEMY_COLORS[kind], 12);
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (kind === 2) {
      // ひし形の頭と触角
      ctx.moveTo(cx, r.y);
      ctx.lineTo(r.x + r.w * 0.85, cy);
      ctx.lineTo(cx, r.y + r.h);
      ctx.lineTo(r.x + r.w * 0.15, cy);
      ctx.closePath();
      ctx.moveTo(r.x + r.w * 0.15, cy);
      ctx.lineTo(r.x, frame ? r.y : r.y + r.h);
      ctx.moveTo(r.x + r.w * 0.85, cy);
      ctx.lineTo(r.x + r.w, frame ? r.y : r.y + r.h);
    } else if (kind === 1) {
      // 六角形の胴と腕
      const hw = r.w * 0.32;
      ctx.moveTo(cx - hw, r.y);
      ctx.lineTo(cx + hw, r.y);
      ctx.lineTo(cx + hw * 1.4, cy);
      ctx.lineTo(cx + hw, r.y + r.h * 0.8);
      ctx.lineTo(cx - hw, r.y + r.h * 0.8);
      ctx.lineTo(cx - hw * 1.4, cy);
      ctx.closePath();
      const arm = frame ? -5 : 5;
      ctx.moveTo(cx - hw * 1.4, cy);
      ctx.lineTo(r.x, cy + arm);
      ctx.moveTo(cx + hw * 1.4, cy);
      ctx.lineTo(r.x + r.w, cy + arm);
    } else {
      // 半円のドームと脚
      ctx.arc(cx, cy + 2, r.w * 0.42, Math.PI, 0);
      ctx.closePath();
      const leg = frame ? 4 : -4;
      for (const k of [-0.3, 0, 0.3]) {
        ctx.moveTo(cx + k * r.w, cy + 2);
        ctx.lineTo(cx + k * r.w + leg, r.y + r.h);
      }
    }
    ctx.stroke();
    // 目
    ctx.shadowBlur = 0;
    ctx.fillRect(cx - 5, cy - 2, 3, 3);
    ctx.fillRect(cx + 2, cy - 2, 3, 3);
  }

  function drawPlayer(x: number, y: number): void {
    glow('#00e5ff', 16);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + PLAYER_W / 2, y);
    ctx.lineTo(x + PLAYER_W * 0.62, y + PLAYER_H * 0.45);
    ctx.lineTo(x + PLAYER_W, y + PLAYER_H);
    ctx.lineTo(x, y + PLAYER_H);
    ctx.lineTo(x + PLAYER_W * 0.38, y + PLAYER_H * 0.45);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawUfo(u: Rect): void {
    glow('#ff3355', 18);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(u.x + u.w / 2, u.y + u.h * 0.65, u.w / 2, u.h * 0.35, 0, 0, Math.PI * 2);
    ctx.moveTo(u.x + u.w * 0.3, u.y + u.h * 0.4);
    ctx.arc(u.x + u.w / 2, u.y + u.h * 0.45, u.w * 0.2, Math.PI, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;
    const blink = Math.floor(time * 8) % 3;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i === blink ? 1 : 0.35;
      ctx.fillRect(u.x + u.w * (0.25 + i * 0.25) - 1.5, u.y + u.h * 0.6, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function text(s: string, x: number, y: number, size: number, color: string): void {
    glow(color, 14);
    ctx.font = `700 ${size}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  function render(): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#05010f';
    ctx.fillRect(0, 0, W, H);

    if (shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
    }

    // 星空
    for (const s of stars) {
      ctx.globalAlpha = 0.25 + s.z * 0.25;
      ctx.fillStyle = s.z > 2.4 ? '#bfe9ff' : '#7a6cff';
      // 縦長だと敵の弾と見間違えるので、奥 1px〜手前 2px の正方形の点にする
      const d = 0.5 + s.z * 0.5;
      ctx.fillRect(s.x, s.y, d, d);
    }
    ctx.globalAlpha = 1;

    // 地面の線
    glow('#ff2bd6', 10);
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, H - 28, W, 1.5);
    ctx.globalAlpha = 1;

    if (mode !== 'title') {
      // シールド
      glow('#ffe14d', 8);
      for (const s of shields) ctx.fillRect(s.x, s.y, s.w - 0.5, s.h - 0.5);

      // 敵
      const frame = Math.floor(animDist / 14) % 2;
      for (const e of enemies) {
        if (e.alive) drawEnemy(enemyRect(formation, e), e.kind, frame);
      }

      if (ufo) drawUfo(ufo);

      // 自機（無敵中は点滅）
      if (mode !== 'gameover' && (invuln <= 0 || Math.floor(invuln * 10) % 2 === 0)) {
        drawPlayer(px, PLAYER_Y);
      }

      // 弾
      glow('#ffffff', 14);
      ctx.shadowColor = '#00e5ff';
      for (const b of playerBullets) ctx.fillRect(b.x, b.y, b.w, b.h);
      glow('#ff7b00', 14);
      for (const b of enemyBullets) {
        ctx.beginPath();
        const zig = Math.floor((b.y + time * 60) / 4) % 2 ? 2 : -2;
        ctx.moveTo(b.x + b.w / 2, b.y);
        ctx.lineTo(b.x + b.w / 2 + zig, b.y + b.h / 3);
        ctx.lineTo(b.x + b.w / 2 - zig, b.y + (b.h * 2) / 3);
        ctx.lineTo(b.x + b.w / 2, b.y + b.h);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // 残機（地面の下）
      for (let i = 0; i < lives - 1; i++) {
        ctx.save();
        ctx.translate(MARGIN + i * 26, H - 20);
        ctx.scale(0.55, 0.55);
        drawPlayer(0, 0);
        ctx.restore();
      }
    }

    // パーティクル
    ctx.shadowBlur = 0;
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    // 文字
    if (mode === 'title') {
      text('YT INVADERS', W / 2, H * 0.34, 40, '#ff2bd6');
      text('← → / A D  MOVE', W / 2, H * 0.5, 16, '#00e5ff');
      text('SPACE  FIRE    P  PAUSE', W / 2, H * 0.5 + 26, 16, '#00e5ff');
      if (Math.floor(time * 2) % 2 === 0) text('PRESS ENTER / TAP FIRE', W / 2, H * 0.66, 18, '#ffe14d');
    } else if (mode === 'paused') {
      text('PAUSED', W / 2, H * 0.45, 36, '#ffe14d');
      text('P / ENTER / TAP TO RESUME', W / 2, H * 0.45 + 40, 16, '#00e5ff');
    } else if (mode === 'gameover') {
      text('GAME OVER', W / 2, H * 0.4, 40, '#ff3355');
      text(`SCORE ${score}`, W / 2, H * 0.4 + 48, 20, '#00e5ff');
      if (time - overAt >= RESTART_LOCK && Math.floor(time * 2) % 2 === 0) {
        text('PRESS ENTER / TAP FIRE', W / 2, H * 0.62, 18, '#ffe14d');
      }
    } else if (banner > 0) {
      text(`WAVE ${wave}`, W / 2, H * 0.5, 32, '#39ff14');
    }
    ctx.shadowBlur = 0;
  }

  // ---- HUD ----
  let lastHud = '';
  function updateHud(): void {
    const key = `${score}|${hi}|${lives}|${wave}`;
    if (key === lastHud) return;
    lastHud = key;
    hud.score.textContent = String(score);
    hud.hi.textContent = String(hi);
    hud.lives.textContent = String(Math.max(lives, 0));
    hud.wave.textContent = String(wave);
  }

  // ---- 入力 ----
  // Enter・FIRE・画面のタップで共通。開始、一時停止からの再開、やり直し。
  // ゲームオーバー直後は連打で GAME OVER を見逃さないよう、少しの間受け付けない。
  function startOrContinue(): void {
    if (mode === 'paused') mode = 'playing';
    else if (mode === 'title') newGame();
    else if (mode === 'gameover' && time - overAt >= RESTART_LOCK) newGame();
  }

  function togglePause(): void {
    if (mode === 'playing') mode = 'paused';
    else if (mode === 'paused') mode = 'playing';
  }

  window.addEventListener('keydown', (ev) => {
    sfx.unlock();
    switch (ev.code) {
      case 'ArrowLeft':
      case 'KeyA':
        input.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        input.right = true;
        break;
      case 'Space':
        input.fire = true;
        if (!ev.repeat) fireQueued = true;
        break;
      case 'KeyP':
        if (!ev.repeat) togglePause();
        break;
      case 'Enter':
      case 'NumpadEnter':
        if (!ev.repeat) startOrContinue();
        break;
      default:
        return;
    }
    ev.preventDefault();
  });

  window.addEventListener('keyup', (ev) => {
    switch (ev.code) {
      case 'ArrowLeft':
      case 'KeyA':
        input.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        input.right = false;
        break;
      case 'Space':
        input.fire = false;
        break;
    }
  });

  // フォーカスが外れたらキーの押しっぱなしを解き、遊んでいれば止める
  function suspend(): void {
    input.left = input.right = input.fire = false;
    releaseLever();
    if (mode === 'playing') mode = 'paused';
  }
  window.addEventListener('blur', suspend);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspend();
  });

  function bindFire(el: HTMLElement): void {
    const down = (ev: PointerEvent): void => {
      ev.preventDefault();
      sfx.unlock();
      startOrContinue();
      fireQueued = true;
      input.fire = true;
      try {
        el.setPointerCapture(ev.pointerId);
      } catch {
        // 取れなくても押している間は動く
      }
    };
    const up = (): void => {
      input.fire = false;
    };
    el.addEventListener('pointerdown', down);
    // タッチでは pointerdown がユーザーの活性化にならないので、pointerup でも音を解く
    el.addEventListener('pointerup', () => {
      sfx.unlock();
      up();
    });
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }
  bindFire(touch.fire);

  // レバー。中心と左右の端は固定で、触っている位置の中心からの距離で速さを決める。
  // 1 本の指だけを追い、ほかの指は無視する
  let leverPointer: number | null = null;
  function moveLever(clientX: number): void {
    const r = touch.lever.getBoundingClientRect();
    // つまみが欄の端に着く所で全速にする（つまみが欄からはみ出さず、指も画面の端まで寄せなくてよい）
    const radius = Math.max(1, (r.width - touch.leverKnob.offsetWidth) / 2 - 4);
    const dx = Math.max(-radius, Math.min(radius, clientX - (r.left + r.width / 2)));
    input.axis = leverAxis(dx, radius);
    touch.leverKnob.style.transform = `translateX(${dx}px)`;
  }
  function releaseLever(): void {
    leverPointer = null;
    input.axis = 0;
    touch.lever.classList.remove('active');
    touch.leverKnob.style.transform = '';
  }
  touch.lever.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    sfx.unlock();
    if (leverPointer !== null) return;
    leverPointer = ev.pointerId;
    touch.lever.classList.add('active');
    moveLever(ev.clientX);
    try {
      touch.lever.setPointerCapture(ev.pointerId);
    } catch {
      // 取れなくても、レバーの上で動かしている間は効く
    }
  });
  touch.lever.addEventListener('pointermove', (ev) => {
    if (ev.pointerId === leverPointer) moveLever(ev.clientX);
  });
  const leverUp = (ev: PointerEvent): void => {
    if (ev.pointerId === leverPointer) releaseLever();
  };
  touch.lever.addEventListener('pointerup', (ev) => {
    sfx.unlock();
    leverUp(ev);
  });
  touch.lever.addEventListener('pointercancel', leverUp);
  touch.lever.addEventListener('lostpointercapture', leverUp);
  touch.lever.addEventListener('contextmenu', (ev) => ev.preventDefault());

  canvas.addEventListener('pointerdown', () => {
    sfx.unlock();
    startOrContinue();
  });
  canvas.addEventListener('pointerup', () => sfx.unlock());

  // ---- ループ ----
  let last = performance.now();
  let acc = 0;
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (dt > 0) acc += dt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    updateHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
