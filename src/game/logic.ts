// DOM・Canvas に触らない純粋な関数と定数（tests/ から import する）。
// モジュールの読み込み時には window / document に触らない。

// ---- 論理解像度 ----
export const W = 480;
export const H = 640;

// ---- 当たり判定 ----
export interface Rect {
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
export const MARGIN = 12; // 画面の左右の余白

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
export function stepFormation(f: Formation, enemies: Enemy[], speed: number, dt: number): Formation {
  const b = formationBounds(f, enemies);
  if (!b) return { ...f };
  const dx = f.dir * speed * dt;
  const right = W - MARGIN;
  if (f.dir > 0 && b.x + b.w + dx >= right) {
    return { ox: f.ox + (right - (b.x + b.w)), oy: f.oy + DROP, dir: -1 };
  }
  if (f.dir < 0 && b.x + dx <= MARGIN) {
    return { ox: f.ox + (MARGIN - b.x), oy: f.oy + DROP, dir: 1 };
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

// ---- ゲームの定数 ----
export const RESTART_LOCK = 1; // ゲームオーバー後、やり直しを受け付けない秒数

export const PLAYER_W = 34;
export const PLAYER_H = 18;
export const PLAYER_Y = H - 56;
export const PLAYER_SPEED = 260;
export const PLAYER_BULLET_SPEED = 620;
export const FIRE_COOLDOWN = 0.35;
export const SHIELD_CELL = 4;
export const SHIELD_Y = H - 150;

export const ENEMY_COLORS = ['#39ff14', '#00e5ff', '#ff2bd6'];
export const ENEMY_POINTS = [10, 20, 30];
export const UFO_POINTS = [50, 100, 150, 300];

export function makeShields(): Rect[] {
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
