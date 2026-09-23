import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DROP,
  formationSpeed,
  makeEnemies,
  overlaps,
  stepFormation,
  startFormation,
  formationBounds,
  enemyRect,
  leverAxis,
  LEVER_DEAD,
} from '../src/game/game.ts';
import type { Enemy, Formation } from '../src/game/game.ts';

const box = { x: 10, y: 10, w: 10, h: 10 };

test('overlaps: 重なっていれば当たる', () => {
  assert.equal(overlaps(box, { x: 15, y: 15, w: 10, h: 10 }), true);
  assert.equal(overlaps(box, { x: 12, y: 12, w: 2, h: 2 }), true); // 内側
  assert.equal(overlaps(box, { x: 19.9, y: 10, w: 5, h: 5 }), true);
});

test('overlaps: 辺が接するだけなら当たらない', () => {
  assert.equal(overlaps(box, { x: 20, y: 10, w: 5, h: 5 }), false); // 右
  assert.equal(overlaps(box, { x: 5, y: 10, w: 5, h: 5 }), false); // 左
  assert.equal(overlaps(box, { x: 10, y: 20, w: 5, h: 5 }), false); // 下
  assert.equal(overlaps(box, { x: 10, y: 5, w: 5, h: 5 }), false); // 上
  assert.equal(overlaps(box, { x: 20, y: 20, w: 5, h: 5 }), false); // 角
});

test('overlaps: 離れていれば当たらない', () => {
  assert.equal(overlaps(box, { x: 30, y: 10, w: 5, h: 5 }), false);
  assert.equal(overlaps(box, { x: 10, y: 30, w: 5, h: 5 }), false);
  assert.equal(overlaps(box, { x: 15, y: 30, w: 5, h: 5 }), false); // x だけ重なる
});

function one(): Enemy[] {
  return [{ rx: 0, ry: 0, w: 20, h: 10, kind: 0, alive: true }];
}

test('stepFormation: 端でなければ横に動くだけ', () => {
  const f: Formation = { ox: 100, oy: 50, dir: 1 };
  const n = stepFormation(f, one(), 30, 0.1);
  assert.equal(n.ox, 103);
  assert.equal(n.oy, 50);
  assert.equal(n.dir, 1);
  const l = stepFormation({ ox: 100, oy: 50, dir: -1 }, one(), 30, 0.1);
  assert.equal(l.ox, 97);
  assert.equal(l.dir, -1);
  assert.deepEqual(f, { ox: 100, oy: 50, dir: 1 }); // 引数は書き換えない
});

test('stepFormation: 右端で 1 段下がって左へ向きを変える', () => {
  // 右端 = 480 - 12 = 468。敵の右辺は 446 + 20 = 466
  const n = stepFormation({ ox: 446, oy: 50, dir: 1 }, one(), 30, 0.1);
  assert.equal(n.dir, -1);
  assert.ok(DROP > 0);
  assert.equal(n.oy, 50 + DROP);
  assert.equal(n.ox + 20, 468); // 端で止まり、はみ出さない
  // 次のステップは左へ動き、もう下がらない
  const m = stepFormation(n, one(), 30, 0.1);
  assert.equal(m.dir, -1);
  assert.equal(m.oy, n.oy);
  assert.ok(m.ox < n.ox);
});

test('stepFormation: 左端で 1 段下がって右へ向きを変える', () => {
  const n = stepFormation({ ox: 14, oy: 50, dir: -1 }, one(), 30, 0.1);
  assert.equal(n.dir, 1);
  assert.equal(n.oy, 50 + DROP);
  assert.equal(n.ox, 12);
});

test('stepFormation: 端の判定は生きている敵だけで決まる', () => {
  // 右側の敵が死んでいれば、その分だけ右端まで余裕がある
  const enemies: Enemy[] = [
    { rx: 0, ry: 0, w: 20, h: 10, kind: 0, alive: true },
    { rx: 100, ry: 0, w: 20, h: 10, kind: 0, alive: false },
  ];
  const n = stepFormation({ ox: 400, oy: 50, dir: 1 }, enemies, 30, 0.1);
  assert.equal(n.dir, 1);
  assert.equal(n.oy, 50);
  enemies[1].alive = true;
  const m = stepFormation({ ox: 400, oy: 50, dir: 1 }, enemies, 30, 0.1);
  assert.equal(m.dir, -1);
});

test('stepFormation: 往復し続けても画面からはみ出さない', () => {
  const enemies = makeEnemies();
  let f = startFormation(1);
  let drops = 0;
  for (let i = 0; i < 20000; i++) {
    const prev = f.oy;
    f = stepFormation(f, enemies, 80, 1 / 120);
    if (f.oy !== prev) drops++;
    const b = formationBounds(f, enemies)!;
    assert.ok(b.x >= 12 - 1e-9 && b.x + b.w <= 480 - 12 + 1e-9);
  }
  assert.ok(drops >= 2);
});

test('formationSpeed: 数が減るほど速い', () => {
  const total = 55;
  let prev = formationSpeed(total, total, 1);
  for (let alive = total - 1; alive >= 1; alive--) {
    const s = formationSpeed(alive, total, 1);
    assert.ok(s > prev, `alive=${alive}: ${s} <= ${prev}`);
    prev = s;
  }
  assert.ok(formationSpeed(1, total, 1) > 4 * formationSpeed(total, total, 1));
});

test('formationSpeed: ウェーブが進むと速い', () => {
  assert.ok(formationSpeed(55, 55, 2) > formationSpeed(55, 55, 1));
});

test('enemyRect: 編隊の原点に相対位置を足した位置になる', () => {
  const e: Enemy = { rx: 30, ry: 40, w: 20, h: 10, kind: 0, alive: true };
  assert.deepEqual(enemyRect({ ox: 100, oy: 200, dir: 1 }, e), { x: 130, y: 240, w: 20, h: 10 });
});

test('formationBounds: 生きている敵の上端と下端（高さ込み）を返す', () => {
  const enemies: Enemy[] = [
    { rx: 0, ry: 0, w: 20, h: 10, kind: 0, alive: false }, // 死んでいるので外枠に入らない
    { rx: 10, ry: 30, w: 20, h: 10, kind: 0, alive: true },
    { rx: 50, ry: 60, w: 20, h: 15, kind: 0, alive: true },
  ];
  const b = formationBounds({ ox: 100, oy: 200, dir: 1 }, enemies)!;
  assert.equal(b.x, 110);
  assert.equal(b.y, 230);
  assert.equal(b.x + b.w, 170);
  assert.equal(b.y + b.h, 275);
  enemies[1].alive = enemies[2].alive = false;
  assert.equal(formationBounds({ ox: 0, oy: 0, dir: 1 }, enemies), null);
});

test('stepFormation: 端にちょうど接したら向きを変え、届かなければそのまま', () => {
  // dx = 3 * 1 = 3（浮動小数の誤差が出ない値にする）
  // 右端 468。445 + 20 + 3 = 468 で接する、444 + 20 + 3 = 467 で届かない
  const touchR = stepFormation({ ox: 445, oy: 50, dir: 1 }, one(), 3, 1);
  assert.equal(touchR.dir, -1);
  assert.equal(touchR.ox, 448);
  const shortR = stepFormation({ ox: 444, oy: 50, dir: 1 }, one(), 3, 1);
  assert.equal(shortR.dir, 1);
  assert.equal(shortR.oy, 50);
  // 左端 12。15 - 3 = 12 で接する、16 - 3 = 13 で届かない
  const touchL = stepFormation({ ox: 15, oy: 50, dir: -1 }, one(), 3, 1);
  assert.equal(touchL.dir, 1);
  assert.equal(touchL.ox, 12);
  const shortL = stepFormation({ ox: 16, oy: 50, dir: -1 }, one(), 3, 1);
  assert.equal(shortL.dir, -1);
  assert.equal(shortL.oy, 50);
});

test('leverAxis: 動かない範囲の内側は 0、境目から比例して端で 1', () => {
  const r = 100;
  assert.equal(leverAxis(0, r), 0);
  assert.equal(leverAxis(LEVER_DEAD * r, r), 0);
  assert.equal(leverAxis(-LEVER_DEAD * r, r), 0);
  assert.ok(leverAxis(LEVER_DEAD * r + 1, r) > 0);
  assert.equal(leverAxis(r, r), 1);
  assert.equal(leverAxis(-r, r), -1);
  // 境目と端の中間なら半分
  const mid = ((1 + LEVER_DEAD) / 2) * r;
  assert.ok(Math.abs(leverAxis(mid, r) - 0.5) < 1e-9);
  assert.ok(Math.abs(leverAxis(-mid, r) + 0.5) < 1e-9);
});

test('leverAxis: 半径より外は端まで倒したのと同じ', () => {
  assert.equal(leverAxis(250, 100), 1);
  assert.equal(leverAxis(-250, 100), -1);
});
