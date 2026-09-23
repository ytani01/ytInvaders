// ゲームの入口。Canvas の用意、HUD、固定刻みのループを受け持ち、
// state.ts（状態と更新）・render.ts（描画）・input.ts（入力）をつなぐ。
// モジュールの読み込み時には window / document に触らない。

import { Sfx } from './audio.ts';
import { bindInput, createInput } from './input.ts';
import type { TouchEls } from './input.ts';
import { H, W } from './logic.ts';
import { render } from './render.ts';
import { createState, pause, startOrContinue, togglePause, update } from './state.ts';

interface HudEls {
  score: HTMLElement;
  hi: HTMLElement;
  lives: HTMLElement;
  wave: HTMLElement;
}

const STEP = 1 / 120; // 固定の時間刻み
const MAX_FRAME = 0.25; // タブ復帰などで dt が大きくなったときの上限

export function startGame(canvas: HTMLCanvasElement, hud: HudEls, touch: TouchEls): void {
  const ctxOrNull = canvas.getContext('2d');
  if (!ctxOrNull) return;
  const ctx: CanvasRenderingContext2D = ctxOrNull;
  const sfx = new Sfx();

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;

  const s = createState();
  const input = createInput();

  // ---- HUD ----
  let lastHud = '';
  function updateHud(): void {
    const key = `${s.score}|${s.hi}|${s.lives}|${s.wave}`;
    if (key === lastHud) return;
    lastHud = key;
    hud.score.textContent = String(s.score);
    hud.hi.textContent = String(s.hi);
    hud.lives.textContent = String(Math.max(s.lives, 0));
    hud.wave.textContent = String(s.wave);
  }

  bindInput(canvas, touch, sfx, input, {
    startOrContinue: () => startOrContinue(s),
    togglePause: () => togglePause(s),
    suspend: () => pause(s),
  });

  // ---- ループ ----
  let last = performance.now();
  let acc = 0;
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (dt > 0) acc += dt;
    while (acc >= STEP) {
      update(s, STEP, input, sfx);
      acc -= STEP;
    }
    render(ctx, dpr, s);
    updateHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
