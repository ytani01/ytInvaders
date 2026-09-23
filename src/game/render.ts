// 描画。状態は引数から読み、書き換えない。

import { ENEMY_COLORS, H, MARGIN, PLAYER_H, PLAYER_W, PLAYER_Y, RESTART_LOCK, W, enemyRect } from './logic.ts';
import type { Rect } from './logic.ts';
import type { State } from './state.ts';

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
}

function drawEnemy(ctx: CanvasRenderingContext2D, r: Rect, kind: number, frame: number): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  glow(ctx, ENEMY_COLORS[kind], 12);
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

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  glow(ctx, '#00e5ff', 16);
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

function drawUfo(ctx: CanvasRenderingContext2D, u: Rect, time: number): void {
  glow(ctx, '#ff3355', 18);
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

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string): void {
  glow(ctx, color, 14);
  ctx.font = `700 ${size}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

export function render(ctx: CanvasRenderingContext2D, dpr: number, s: State): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#05010f';
  ctx.fillRect(0, 0, W, H);

  if (s.shake > 0) {
    ctx.translate((Math.random() * 2 - 1) * s.shake, (Math.random() * 2 - 1) * s.shake);
  }

  // 星空
  for (const st of s.stars) {
    ctx.globalAlpha = 0.25 + st.z * 0.25;
    ctx.fillStyle = st.z > 2.4 ? '#bfe9ff' : '#7a6cff';
    // 縦長だと敵の弾と見間違えるので、奥 1px〜手前 2px の正方形の点にする
    const d = 0.5 + st.z * 0.5;
    ctx.fillRect(st.x, st.y, d, d);
  }
  ctx.globalAlpha = 1;

  // 地面の線
  glow(ctx, '#ff2bd6', 10);
  ctx.globalAlpha = 0.6;
  ctx.fillRect(0, H - 28, W, 1.5);
  ctx.globalAlpha = 1;

  if (s.mode !== 'title') {
    // シールド
    glow(ctx, '#ffe14d', 8);
    for (const c of s.shields) ctx.fillRect(c.x, c.y, c.w - 0.5, c.h - 0.5);

    // 敵
    const frame = Math.floor(s.animDist / 14) % 2;
    for (const e of s.enemies) {
      if (e.alive) drawEnemy(ctx, enemyRect(s.formation, e), e.kind, frame);
    }

    if (s.ufo) drawUfo(ctx, s.ufo, s.time);

    // 自機（無敵中は点滅）
    if (s.mode !== 'gameover' && (s.invuln <= 0 || Math.floor(s.invuln * 10) % 2 === 0)) {
      drawPlayer(ctx, s.px, PLAYER_Y);
    }

    // 弾
    glow(ctx, '#ffffff', 14);
    ctx.shadowColor = '#00e5ff';
    for (const b of s.playerBullets) ctx.fillRect(b.x, b.y, b.w, b.h);
    glow(ctx, '#ff7b00', 14);
    for (const b of s.enemyBullets) {
      ctx.beginPath();
      const zig = Math.floor((b.y + s.time * 60) / 4) % 2 ? 2 : -2;
      ctx.moveTo(b.x + b.w / 2, b.y);
      ctx.lineTo(b.x + b.w / 2 + zig, b.y + b.h / 3);
      ctx.lineTo(b.x + b.w / 2 - zig, b.y + (b.h * 2) / 3);
      ctx.lineTo(b.x + b.w / 2, b.y + b.h);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 残機（地面の下）
    for (let i = 0; i < s.lives - 1; i++) {
      ctx.save();
      ctx.translate(MARGIN + i * 26, H - 20);
      ctx.scale(0.55, 0.55);
      drawPlayer(ctx, 0, 0);
      ctx.restore();
    }
  }

  // パーティクル
  ctx.shadowBlur = 0;
  for (const p of s.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;

  // 文字
  if (s.mode === 'title') {
    text(ctx, 'YT INVADERS', W / 2, H * 0.34, 40, '#ff2bd6');
    text(ctx, '← → / A D  MOVE', W / 2, H * 0.5, 16, '#00e5ff');
    text(ctx, 'SPACE  FIRE    P  PAUSE', W / 2, H * 0.5 + 26, 16, '#00e5ff');
    if (Math.floor(s.time * 2) % 2 === 0) text(ctx, 'PRESS ENTER / TAP FIRE', W / 2, H * 0.66, 18, '#ffe14d');
  } else if (s.mode === 'paused') {
    text(ctx, 'PAUSED', W / 2, H * 0.45, 36, '#ffe14d');
    text(ctx, 'P / ENTER / TAP TO RESUME', W / 2, H * 0.45 + 40, 16, '#00e5ff');
  } else if (s.mode === 'gameover') {
    text(ctx, 'GAME OVER', W / 2, H * 0.4, 40, '#ff3355');
    text(ctx, `SCORE ${s.score}`, W / 2, H * 0.4 + 48, 20, '#00e5ff');
    if (s.time - s.overAt >= RESTART_LOCK && Math.floor(s.time * 2) % 2 === 0) {
      text(ctx, 'PRESS ENTER / TAP FIRE', W / 2, H * 0.62, 18, '#ffe14d');
    }
  } else if (s.banner > 0) {
    text(ctx, `WAVE ${s.wave}`, W / 2, H * 0.5, 32, '#39ff14');
  }
  ctx.shadowBlur = 0;
}
