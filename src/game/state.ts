// ゲームの状態と、それを進める処理。DOM・Canvas には触らない。
// モジュールの読み込み時には window / document に触らない。

import type { Sfx } from './audio.ts';
import type { Input } from './input.ts';
import {
  ENEMY_COLORS,
  ENEMY_POINTS,
  FIRE_COOLDOWN,
  H,
  MARGIN,
  PLAYER_BULLET_SPEED,
  PLAYER_H,
  PLAYER_SPEED,
  PLAYER_W,
  PLAYER_Y,
  RESTART_LOCK,
  SHIELD_Y,
  UFO_POINTS,
  W,
  enemyRect,
  formationBounds,
  formationSpeed,
  makeEnemies,
  makeShields,
  overlaps,
  startFormation,
  stepFormation,
} from './logic.ts';
import type { Enemy, Formation, Rect } from './logic.ts';

export interface Bullet extends Rect {
  vy: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}

export interface Star {
  x: number;
  y: number;
  z: number; // 1..3。大きいほど手前で速い
}

export interface Ufo extends Rect {
  vx: number;
}

export type Mode = 'title' | 'playing' | 'paused' | 'gameover';

export interface State {
  mode: Mode;
  score: number;
  hi: number;
  lives: number;
  wave: number;
  enemies: Enemy[];
  formation: Formation;
  animDist: number;
  px: number;
  cooldown: number;
  invuln: number;
  playerBullets: Bullet[];
  enemyBullets: Bullet[];
  shields: Rect[];
  enemyFireTimer: number;
  ufo: Ufo | null;
  ufoTimer: number;
  banner: number;
  shake: number;
  time: number;
  overAt: number; // ゲームオーバーになった時刻
  particles: Particle[];
  stars: Star[];
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

export function createState(): State {
  const stars: Star[] = [];
  const s: State = {
    mode: 'title',
    score: 0,
    hi: loadHigh(),
    lives: 3,
    wave: 1,
    enemies: [],
    formation: startFormation(1),
    animDist: 0,
    px: W / 2 - PLAYER_W / 2,
    cooldown: 0,
    invuln: 0,
    playerBullets: [],
    enemyBullets: [],
    shields: [],
    enemyFireTimer: 0,
    ufo: null,
    ufoTimer: 0,
    banner: 0,
    shake: 0,
    time: 0,
    overAt: 0,
    particles: [],
    stars,
  };
  for (let i = 0; i < 90; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, z: 1 + Math.random() * 2 });
  }
  return s;
}

function newWave(s: State): void {
  s.enemies = makeEnemies();
  s.shields = makeShields();
  s.formation = startFormation(s.wave);
  s.playerBullets = [];
  s.enemyBullets = [];
  s.enemyFireTimer = 1.5;
  s.ufoTimer = 12 + Math.random() * 10;
  s.ufo = null;
  s.banner = 1.6;
}

function newGame(s: State): void {
  s.score = 0;
  s.lives = 3;
  s.wave = 1;
  s.px = W / 2 - PLAYER_W / 2;
  s.invuln = 0;
  s.cooldown = 0;
  s.particles = [];
  newWave(s);
  s.mode = 'playing';
}

function addScore(s: State, n: number): void {
  s.score += n;
  if (s.score > s.hi) s.hi = s.score;
}

function spark(s: State, x: number, y: number, color: string, n: number, spd: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = spd * (0.3 + Math.random() * 0.7);
    const life = 0.4 + Math.random() * 0.5;
    s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color });
  }
}

function gameOver(s: State): void {
  s.mode = 'gameover';
  s.overAt = s.time;
  saveHigh(s.hi);
}

function hitPlayer(s: State, sfx: Sfx): void {
  s.lives--;
  s.shake = 14;
  spark(s, s.px + PLAYER_W / 2, PLAYER_Y + PLAYER_H / 2, '#00e5ff', 50, 260);
  sfx.playerHit();
  s.enemyBullets = [];
  if (s.lives <= 0) {
    gameOver(s);
  } else {
    s.invuln = 2;
  }
}

// 弾とシールドの判定。当たったセルは消す。
function hitShield(s: State, b: Rect, sfx: Sfx): boolean {
  for (let i = 0; i < s.shields.length; i++) {
    if (overlaps(b, s.shields[i])) {
      const c = s.shields[i];
      s.shields.splice(i, 1);
      spark(s, c.x + 2, c.y + 2, '#ffe14d', 4, 80);
      sfx.shieldHit();
      return true;
    }
  }
  return false;
}

// ---- update() から順に呼ぶ処理 ----

// 星・パーティクル・揺れ。遊んでいないときも動かす
function stepBackground(s: State, dt: number): void {
  s.time += dt;
  for (const st of s.stars) {
    st.y += st.z * st.z * 12 * dt;
    if (st.y > H) {
      st.y -= H;
      st.x = Math.random() * W;
    }
  }
  for (const p of s.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2 * dt;
    p.vy *= 1 - 2 * dt;
    p.life -= dt;
  }
  s.particles = s.particles.filter((p) => p.life > 0);
  s.shake = Math.max(0, s.shake - 40 * dt);
}

// 自機
function stepPlayer(s: State, dt: number, input: Input, sfx: Sfx): void {
  const mv = Math.max(-1, Math.min(1, (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.axis));
  s.px = Math.min(W - MARGIN - PLAYER_W, Math.max(MARGIN, s.px + mv * PLAYER_SPEED * dt));
  if ((input.fire || input.fireQueued) && s.cooldown <= 0 && s.playerBullets.length < 2) {
    input.fireQueued = false;
    s.playerBullets.push({ x: s.px + PLAYER_W / 2 - 1.5, y: PLAYER_Y - 12, w: 3, h: 12, vy: -PLAYER_BULLET_SPEED });
    s.cooldown = FIRE_COOLDOWN;
    sfx.shoot();
  }
}

// 編隊。生きている敵を返す（敵の射撃で使う）
function stepFormationMove(s: State, dt: number): Enemy[] {
  const alive = s.enemies.filter((e) => e.alive);
  const speed = formationSpeed(alive.length, s.enemies.length, s.wave);
  s.formation = stepFormation(s.formation, s.enemies, speed, dt);
  s.animDist += speed * dt;
  return alive;
}

// 敵の射撃: 各列の一番下にいる敵から撃つ
function stepEnemyFire(s: State, dt: number, alive: Enemy[], sfx: Sfx): void {
  s.enemyFireTimer -= dt;
  if (s.enemyFireTimer <= 0 && alive.length > 0 && s.enemyBullets.length < 3 + s.wave) {
    const bottoms = new Map<number, Enemy>();
    for (const e of alive) {
      const cur = bottoms.get(e.rx);
      if (!cur || e.ry > cur.ry) bottoms.set(e.rx, e);
    }
    const shooters = [...bottoms.values()];
    // 自機の近くの列を少し狙いやすくする
    shooters.sort((a, b) => Math.abs(s.formation.ox + a.rx - s.px) - Math.abs(s.formation.ox + b.rx - s.px));
    const pick = Math.random() < 0.4 ? shooters[0] : shooters[Math.floor(Math.random() * shooters.length)];
    const r = enemyRect(s.formation, pick);
    s.enemyBullets.push({ x: r.x + r.w / 2 - 2, y: r.y + r.h, w: 4, h: 12, vy: 200 + s.wave * 15 });
    sfx.enemyShoot();
    s.enemyFireTimer = (0.5 + Math.random() * 0.8) / (1 + 0.15 * (s.wave - 1));
  }
}

// UFO
function stepUfo(s: State, dt: number): void {
  if (s.ufo) {
    s.ufo.x += s.ufo.vx * dt;
    if (s.ufo.x > W + 50 || s.ufo.x < -90) s.ufo = null;
  } else {
    s.ufoTimer -= dt;
    if (s.ufoTimer <= 0) {
      const fromLeft = Math.random() < 0.5;
      s.ufo = { x: fromLeft ? -44 : W + 4, y: 48, w: 40, h: 16, vx: fromLeft ? 110 : -110 };
      s.ufoTimer = 15 + Math.random() * 10;
    }
  }
}

// 自機の弾
function stepPlayerBullets(s: State, dt: number, sfx: Sfx): void {
  for (const b of s.playerBullets) b.y += b.vy * dt;
  s.playerBullets = s.playerBullets.filter((b) => {
    if (b.y + b.h < 0) return false;
    if (hitShield(s, b, sfx)) return false;
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const r = enemyRect(s.formation, e);
      if (overlaps(b, r)) {
        e.alive = false;
        addScore(s, ENEMY_POINTS[e.kind]);
        spark(s, r.x + r.w / 2, r.y + r.h / 2, ENEMY_COLORS[e.kind], 24, 220);
        s.shake = Math.max(s.shake, 3);
        sfx.explode();
        return false;
      }
    }
    if (s.ufo && overlaps(b, s.ufo)) {
      const pts = UFO_POINTS[Math.floor(Math.random() * UFO_POINTS.length)];
      addScore(s, pts);
      spark(s, s.ufo.x + s.ufo.w / 2, s.ufo.y + s.ufo.h / 2, '#ff3355', 40, 260);
      s.shake = Math.max(s.shake, 6);
      sfx.ufo();
      s.ufo = null;
      return false;
    }
    return true;
  });
}

// 敵の弾。自機に当たったら true
function stepEnemyBullets(s: State, dt: number, sfx: Sfx): boolean {
  for (const b of s.enemyBullets) b.y += b.vy * dt;
  const playerRect: Rect = { x: s.px, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H };
  let playerWasHit = false;
  s.enemyBullets = s.enemyBullets.filter((b) => {
    if (b.y > H) return false;
    if (hitShield(s, b, sfx)) return false;
    if (!playerWasHit && s.invuln <= 0 && overlaps(b, playerRect)) playerWasHit = true;
    return true;
  });
  return playerWasHit;
}

// 敵がシールドを削る・自機の高さまで来たら終わり・全滅させたら次のウェーブ
function stepFormationReach(s: State, sfx: Sfx): void {
  const fb = formationBounds(s.formation, s.enemies);
  if (fb) {
    if (fb.y + fb.h >= SHIELD_Y) {
      for (const e of s.enemies) {
        if (!e.alive) continue;
        const r = enemyRect(s.formation, e);
        s.shields = s.shields.filter((c) => !overlaps(c, r));
      }
    }
    if (fb.y + fb.h >= PLAYER_Y) {
      s.lives = 0;
      s.shake = 14;
      sfx.playerHit();
      gameOver(s);
      return;
    }
  } else {
    // 全滅させたら次のウェーブ
    s.wave++;
    addScore(s, 100);
    sfx.wave();
    newWave(s);
  }
}

export function update(s: State, dt: number, input: Input, sfx: Sfx): void {
  stepBackground(s, dt);

  if (s.mode !== 'playing') {
    input.fireQueued = false;
    return;
  }

  if (s.banner > 0) s.banner -= dt;
  if (s.invuln > 0) s.invuln -= dt;
  if (s.cooldown > 0) s.cooldown -= dt;

  stepPlayer(s, dt, input, sfx);
  const alive = stepFormationMove(s, dt);
  stepEnemyFire(s, dt, alive, sfx);
  stepUfo(s, dt);
  stepPlayerBullets(s, dt, sfx);
  if (stepEnemyBullets(s, dt, sfx)) {
    hitPlayer(s, sfx); // 画面の敵弾もここで消える
    if (s.mode !== 'playing') return;
  }
  stepFormationReach(s, sfx);
}

// ---- 入力から呼ぶ処理 ----

// Enter・FIRE・画面のタップで共通。開始、一時停止からの再開、やり直し。
// ゲームオーバー直後は連打で GAME OVER を見逃さないよう、少しの間受け付けない。
export function startOrContinue(s: State): void {
  if (s.mode === 'paused') s.mode = 'playing';
  else if (s.mode === 'title') newGame(s);
  else if (s.mode === 'gameover' && s.time - s.overAt >= RESTART_LOCK) newGame(s);
}

export function togglePause(s: State): void {
  if (s.mode === 'playing') s.mode = 'paused';
  else if (s.mode === 'paused') s.mode = 'playing';
}

// フォーカスが外れたとき。遊んでいれば止める
export function pause(s: State): void {
  if (s.mode === 'playing') s.mode = 'paused';
}
