// キー・FIRE・レバー・Canvas のタップの登録。ゲームの状態は直接触らず、
// 開始・一時停止・フォーカスが外れたときの処理はコールバックで受け取る。

import type { Sfx } from './audio.ts';
import { leverAxis } from './logic.ts';

export interface TouchEls {
  lever: HTMLElement; // 触れる範囲。真ん中が止まる位置
  leverKnob: HTMLElement; // 触っている位置へ左右に動くつまみ
  fire: HTMLElement;
}

export interface Input {
  left: boolean;
  right: boolean;
  fire: boolean;
  axis: number; // レバーの倒し量（-1..1）。キーの左右と足して使う
  // 押して離すまでが 1 フレームより短い押下や、撃てない間の押下を取りこぼさないよう、
  // 押したことを覚えておき、撃てるようになった時点で 1 発出す
  fireQueued: boolean;
}

export function createInput(): Input {
  return { left: false, right: false, fire: false, axis: 0, fireQueued: false };
}

export interface InputHandlers {
  startOrContinue(): void;
  togglePause(): void;
  suspend(): void; // フォーカスが外れたとき。遊んでいれば止める
}

// 押している間だけ input を true にするキー
const KEYS: Record<string, 'left' | 'right' | 'fire'> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'fire',
};

export function bindInput(
  canvas: HTMLCanvasElement,
  touch: TouchEls,
  sfx: Sfx,
  input: Input,
  on: InputHandlers,
): void {
  window.addEventListener('keydown', (ev) => {
    sfx.unlock();
    const k = KEYS[ev.code];
    if (k) input[k] = true;
    else if (!['KeyP', 'Enter', 'NumpadEnter'].includes(ev.code)) return;
    ev.preventDefault();
    if (ev.repeat) return;
    if (ev.code === 'Space') input.fireQueued = true;
    else if (ev.code === 'KeyP') on.togglePause();
    else if (!k) on.startOrContinue(); // Enter
  });

  window.addEventListener('keyup', (ev) => {
    const k = KEYS[ev.code];
    if (k) input[k] = false;
  });

  // フォーカスが外れたらキーの押しっぱなしを解き、遊んでいれば止める
  function suspend(): void {
    input.left = input.right = input.fire = false;
    releaseLever();
    on.suspend();
  }
  window.addEventListener('blur', suspend);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspend();
  });

  const fireUp = (): void => {
    input.fire = false;
  };
  touch.fire.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    sfx.unlock();
    on.startOrContinue();
    input.fireQueued = true;
    input.fire = true;
    touch.fire.setPointerCapture(ev.pointerId);
  });
  // タッチでは pointerdown がユーザーの活性化にならないので、pointerup でも音を解く
  touch.fire.addEventListener('pointerup', () => {
    sfx.unlock();
    fireUp();
  });
  touch.fire.addEventListener('pointercancel', fireUp);
  touch.fire.addEventListener('lostpointercapture', fireUp);
  touch.fire.addEventListener('contextmenu', (ev) => ev.preventDefault());

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
    touch.lever.setPointerCapture(ev.pointerId);
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
    on.startOrContinue();
  });
  canvas.addEventListener('pointerup', () => sfx.unlock());
}
