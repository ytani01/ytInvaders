# TODO-008 implementer の報告

## 作ったファイル・変えたファイル

| ファイル | 行数 | 中身 |
|----------|------|------|
| `src/game/logic.ts`（新規） | 159 | 旧 7〜112・133〜144 行（`W`〜`startFormation`、`LEVER_DEAD`・`leverAxis`）と、`RESTART_LOCK`・`PLAYER_*`・`FIRE_COOLDOWN`・`SHIELD_*`・`ENEMY_COLORS`・`ENEMY_POINTS`・`UFO_POINTS`・`makeShields`。`Rect`・`W`・`H`・`MARGIN` も export |
| `src/game/state.ts`（新規） | 401 | `Bullet`/`Particle`/`Star`/`Ufo`/`Mode`/`State`、`createState`（:104）、`loadHigh`/`saveHigh`、`newWave`〜`hitShield`、`update`（:359）と `step*` 9 関数（:211〜:333）、`startOrContinue`/`togglePause`/`suspend` |
| `src/game/render.ts`（新規） | 202 | `glow`〜`render`。`render(ctx, dpr, s)`（:104） |
| `src/game/input.ts`（新規） | 142 | `TouchEls`、`Input`、`createInput`、`InputHandlers`、`KEYS`、`bindInput`（:42。中に `moveLever`/`releaseLever`、blur・visibilitychange） |
| `src/game/game.ts` | 69（829 から） | `startGame`、`HudEls`・`updateHud`、`STEP`・`MAX_FRAME`、ループ |
| `tests/logic.test.ts:14-15` | | import 先を `../src/game/logic.ts` に |
| `src/pages/index.astro:148` | | コメントを「input.ts の moveLever」に |
| `README.md:39-49` | | ソースの説明を新しいファイルごとの箇条書きに |

`update()` の中の順番: `stepBackground` → `mode` 判定で `fireQueued = false` して戻る →
`banner`/`invuln`/`cooldown` → `stepPlayer` → `stepFormationMove`（`alive` を返す）→
`stepEnemyFire(alive)` → `stepUfo` → `stepPlayerBullets` → `stepEnemyBullets`（当たったら
true）→ `hitPlayer` と `mode` 判定で戻る → `stepFormationReach`。

## 検証

- `npm test`: 15 件すべて pass、終了コード 0
- `npm run build`: 終了コード 0。warn / error の出力なし（変更前も 0 件）
- 型チェック（プロジェクトに typescript が入っていないため `npx -p typescript@5 tsc --noEmit --strict --verbatimModuleSyntax ...` で一時的に実行）: `src/game/*.ts` はエラーなし。`tests/logic.test.ts` の `node:test` の型が無いという 2 件だけ（@types/node が無いためで、今回の変更とは無関係）
- `rg -n "game\.ts" --glob '!archives/**' --glob '!package-lock.json' --glob '!TODO.md'`: `index.astro:29` の import と `README.md:42` の説明だけ。どちらも新しい分け方と合っている

## 依頼から外れたところ・迷ったところ

- 状態を `s` で受けるため、`s` と重なるループ変数の名前を変えた（挙動は同じ）:
  星は `st`（`state.ts` の `stepBackground`、`render.ts` の星空）、シールドのセルは `c`
  （`hitShield` の `const s = shields[i]`、`stepFormationReach` と `render` のシールドの filter / 描画）
- フォーカスが外れたときの「遊んでいれば止める」は `state.ts` の `suspend(s)`。`input.ts` の内側の
  `suspend()` がキーを解く → `releaseLever()` → `on.suspend()` の順で呼ぶ
- `Input` 型の作成に `createInput()` を `input.ts` に置いた（依頼に名前の指定なし）
- `drawUfo` は点滅に `time` を使うので、引数に `time` を足した（`drawUfo(ctx, s.ufo, s.time)`）
- `createState()` の星は、オブジェクトを作ったあとに 90 個足す。`loadHigh()`・`startFormation(1)` は乱数を使わないので、`Math.random()` の順番は元と同じ
- `state.ts` と `input.ts` は互いに型だけを import している（`import type` なので実行時の循環は無い）
- ブラウザでの動作確認はしていない（依頼どおり verifier の担当）
