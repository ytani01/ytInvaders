# TODO-008 implementer への依頼

## 目的

`src/game/game.ts`（829 行）をファイルに分け、`startGame` の中の `let` の並びを
1 つの状態オブジェクトに、`update()` を処理ごとの関数にまとめる。**挙動は変えない。**

## 分け方（main が決めた。この形で作る）

| ファイル | 中身 |
|----------|------|
| `src/game/logic.ts` | DOM・Canvas に触らない純粋な関数と定数。今の 7〜144 行（`W`〜`leverAxis`）に加え、`makeShields`、`PLAYER_*`、`SHIELD_CELL`、`SHIELD_Y`、`ENEMY_COLORS`、`ENEMY_POINTS`、`UFO_POINTS`、`RESTART_LOCK`、`Rect`（export する）。tests はここから import する |
| `src/game/state.ts` | `Bullet` / `Particle` / `Star` / `Ufo` / `Mode` の型、`State` 型、`createState()`、`loadHigh` / `saveHigh`、`newWave` / `newGame` / `addScore` / `spark` / `gameOver` / `hitPlayer` / `hitShield`、`update`（下で分ける）、`startOrContinue` / `togglePause`、フォーカスが外れたときの「遊んでいれば止める」 |
| `src/game/render.ts` | `glow`〜`render`。`render(ctx, dpr, s)` の形で、状態は引数から読む |
| `src/game/input.ts` | キー・FIRE・レバー・Canvas のタップの登録。`TouchEls` 型、`KEYS`、`moveLever` / `releaseLever`、blur と visibilitychange |
| `src/game/game.ts` | `startGame` だけ。Canvas の用意、`Sfx` を作る、HUD（`HudEls`・`updateHud`）、固定刻みのループ（`STEP`・`MAX_FRAME`）、上の 4 つをつなぐ |

`src/pages/index.astro` は `startGame` を `../game/game.ts` から import したまま
変えない（同じファイルの 148 行目のコメント「game.ts の moveLever」は「input.ts の
moveLever」に直す）。`README.md` の 40 行目付近のソースの説明も新しいファイルに合わせる。

## 状態と入力

- `State` は今の `startGame` 内の `let` / `const` の状態（`mode`〜`particles`、`stars`）を
  そのまま持つ。名前は変えない（`s.score` のように読む）。HUD の `lastHud` と
  ループの `last` / `acc` は `game.ts` のローカルに残す
- 入力は `input.ts` が export する 1 つのオブジェクト型にまとめる:
  `{ left, right, fire, axis, fireQueued }`（今の `input` に `fireQueued` を足す）。
  `update` はこれを引数で受け取る
- `Sfx` は `State` に入れず、要る関数に引数で渡す
- `input.ts` の登録関数は、ゲームの状態を直接触らない。開始・一時停止・
  フォーカスが外れたときの処理はコールバックで受け取る
  （例: `bindInput(canvas, touch, sfx, input, { startOrContinue, togglePause, suspend })`）。
  blur・visibilitychange の順番は今と同じ: キーの押しっぱなしを解く → `releaseLever()` →
  遊んでいれば止める

## `update()` の分け方

`update(s, dt, input, sfx)` の中で、次の順に呼ぶ。**呼ぶ順番と、途中の `return` の
位置は今と同じにする。**

1. 星・パーティクル・揺れと `time`（今の 342〜358 行）
2. `mode !== 'playing'` なら `fireQueued = false` で戻る
3. `banner` / `invuln` / `cooldown` を減らす
4. 自機（移動と射撃）
5. 編隊（`alive` を出し、速さを求めて動かし、`animDist` を進める）
6. 敵の射撃（5 の `alive` を使う）
7. UFO
8. 自機の弾
9. 敵の弾。当たったら `hitPlayer`、そのあと `mode !== 'playing'` なら戻る
10. 編隊がシールドを削る・自機の高さまで来たら終わり・全滅なら次のウェーブ

関数名は任せる。コメントは元の位置の意味が残るように移す。

## 保つもの

- `Math.random()` を呼ぶ順番と回数（update → render の順も）
- 各フレームで状態を読み書きする順番。配列を作り直すところ（`filter`）と、
  その場で書き換えるところ（`e.alive = false`、`shields.splice`）は今のまま
- `startOrContinue` / `togglePause` の分岐、キー入力の分岐（TODO-007 で表にしたもの）
- モジュールの読み込み時に `window` / `document` に触らない（`logic.ts` と
  `state.ts` は tests から import されうる）
- 定数の値、描画の色・座標・文字

## 変えないもの

- `audio.ts`、`tests/logic.test.ts` の中身（import 先だけ `../src/game/logic.ts` に直す）
- `index.astro` の import 行とスタイル

## 完了条件と確認

- `npm test` と `npm run build` が通る（終了コードを報告に書く）
- `rg -n "game\.ts" --glob '!archives/**' --glob '!package-lock.json' --glob '!TODO.md'`
  で出る箇所が、新しい分け方と合っている
- ブラウザでの前後比較は verifier がやるので要らない

## 報告

`archives/agents/TODO-008/implementer-report.md` に、作ったファイルと行数、
依頼から外れたところ（あれば理由）、迷ったところを書く。
返事は「終わったか・報告ファイルのパス・判断が要る点」の 5 行以内。
コミットはしない。
