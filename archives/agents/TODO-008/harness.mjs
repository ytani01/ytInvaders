// usage: node harness.mjs <dir> <scenario>
import { createHash } from 'node:crypto';
const [dir] = process.argv.slice(2);
import { createHash as ch } from 'node:crypto';
const H0 = ch('sha256'); let nlines = 0; const waves = new Set(); let over = 0; const sfxc = {};
const log = { push(l) { nlines++; H0.update(l + '\n'); if (l.startsWith('hud:wave=')) waves.add(l); if (l.includes('GAME OVER')) over++; if (l.startsWith('sfx:')) sfxc[l] = (sfxc[l] ?? 0) + 1; if (process.env.TRACE && nlines >= +process.env.TRACE && nlines < +process.env.TRACE + 40) console.log(nlines, l); } }; globalThis.__log = log;
let seed = 12345, rnd = 0;
Math.random = () => { rnd++; seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function target(name) {
  const ls = {};
  return { name, ls, addEventListener(t, f) { (ls[t] ??= []).push(f); }, fire(t, ev = {}) { for (const f of ls[t] ?? []) f({ preventDefault() {}, repeat: false, pointerId: 1, clientX: 0, ...ev }); } };
}
const win = target('window'); win.devicePixelRatio = 1;
const doc = target('document'); doc.hidden = false;
globalThis.window = win; globalThis.document = doc;
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { log.push('ls:' + k + '=' + v); store.set(k, v); } }, configurable: true });
let raf = null; globalThis.requestAnimationFrame = (f) => { raf = f; };
let nowv = 0; globalThis.performance = { now: () => nowv };
const ctx = new Proxy({}, {
  get(o, p) { if (p in o) return o[p]; return (...a) => { log.push(`c:${String(p)}(${a.map((x) => typeof x === 'number' ? x.toFixed(4) : x).join(',')})`); }; },
  set(o, p, v) { log.push(`c:${String(p)}=${v}`); return true; },
});
const canvas = { ...target('canvas'), getContext: () => ctx };
function el(name) { const t = target(name); return Object.assign(t, { setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, width: 200 }), offsetWidth: 40, classList: { add: (c) => log.push(name + ':+' + c), remove: (c) => log.push(name + ':-' + c) }, style: new Proxy({}, { set(o, p, v) { log.push(`${name}.style.${String(p)}=${v}`); return true; } }) }); }
const touch = { lever: el('lever'), leverKnob: el('knob'), fire: el('fire') };
const hudEl = (n) => ({ set textContent(v) { log.push(`hud:${n}=${v}`); } });
const hud = { score: hudEl('score'), hi: hudEl('hi'), lives: hudEl('lives'), wave: hudEl('wave') };
const { startGame } = await import(dir + '/game.ts');
startGame(canvas, hud, touch);
const key = (t, code, repeat = false) => win.fire(t, { code, repeat });
let maxWave = 0;
for (let f = 1; f <= 40000; f++) {
  // 決まった入力（Math.random は使わない）
  if (f % 1500 === 10) key('keydown', 'Enter');
  if (f % 7 === 0) { key('keydown', 'Space'); }
  if (f % 7 === 2) key('keyup', 'Space');
  if (f % 7 === 3) key('keydown', 'Space', true);
  const ph = Math.floor(f / 90) % 4;
  if (f % 90 === 0) { if (ph === 0) key('keydown', 'ArrowLeft'); if (ph === 1) key('keyup', 'ArrowLeft'); if (ph === 2) key('keydown', 'KeyD'); if (ph === 3) key('keyup', 'KeyD'); }
  if (f % 2400 === 500) key('keydown', 'KeyP');
  if (f % 2400 === 560) key('keydown', 'KeyP');
  if (f % 3100 === 700) win.fire('blur');
  if (f % 3100 === 760) canvas.fire('pointerdown');
  if (f % 3700 === 900) { doc.hidden = true; doc.fire('visibilitychange'); doc.hidden = false; doc.fire('visibilitychange'); }
  if (f % 3700 === 950) touch.fire.fire('pointerdown');
  if (f % 3700 === 953) touch.fire.fire('pointerup');
  if (f % 500 === 100) touch.lever.fire('pointerdown', { clientX: 20 });
  if (f % 500 === 130) touch.lever.fire('pointermove', { clientX: 180 });
  if (f % 500 === 131) touch.lever.fire('pointermove', { clientX: 90, pointerId: 2 });
  if (f % 500 === 200) touch.lever.fire('pointerup');
  if (f % 1100 === 300) touch.lever.fire('pointerdown', { clientX: 150 });
  if (f % 1100 === 340) win.fire('blur');
  if (f % 997 === 5) key('keydown', 'NumpadEnter');
  if (f % 13 === 0) touch.fire.fire('lostpointercapture');
  nowv = f * 16.6667 + (f % 5 === 0 ? 3 : 0) + (f % 4001 === 0 ? 400 : 0);
  raf(nowv);
}
console.log(JSON.stringify({ lines: nlines, rnd, hash: H0.digest('hex').slice(0, 16), waves: [...waves], over, sfxc }));
