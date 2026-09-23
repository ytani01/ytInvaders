# TODO-008 reviewer の報告

対象: 未コミットの差分（`src/game/{game,logic,state,render,input}.ts`、`tests/logic.test.ts`、
`src/pages/index.astro`、`README.md`）。変更前は `git show HEAD:src/game/game.ts`。

## 要修正

なし。

## 検討

1. `archives/agents/TODO-008/implementer-report.md` の「`state.ts` と `input.ts` は互いに型だけを
   import している」は事実と違う。`input.ts` が import しているのは `audio.ts`（型）と `logic.ts` だけで、
   `state.ts` を import していない（`input.ts:4-5`）。循環は無い。コードの問題ではなく報告の記述の誤り。
2. 名前の重なり: `input.ts:67` の内側の関数 `suspend()`（キーを解く → レバーを離す → `on.suspend()`）と、
   `state.ts:399` の `suspend(s)`（遊んでいれば止める）が同じ名前。`game.ts:50` で
   `suspend: () => suspend(s)` とつないでおり、動きは正しいが、読むときにどちらか取り違えやすい。好みの範囲に近い。
3. `TODO.md` の「分け方を決める」にチェックが入っている。implementer の報告には書かれていないので、
   main が入れたものなら問題なし（未確認）。

## 実測（変更前後の差分実行）

変更前の `game.ts` と変更後の 5 ファイルを、同じスタブの上で動かし、出力を突き合わせた。

- 手段: `node`（v26、型を落として `.ts` を直接実行）。スクリプトは
  `/tmp/claude-649/-home-ytani-work-ytInvaders/0ea3399f-4744-4a36-a582-f28b17ff92e0/scratchpad/harness.mjs`
  （フレーム数を指定できる版は同じ場所の `h2.mjs`）
- `Math.random` を種付きの乱数に差し替えて呼んだ回数を数える。`window` / `document` / Canvas の
  context / タッチの要素 / HUD / `localStorage` / `requestAnimationFrame` をスタブにし、context の
  呼び出しと代入、`Sfx` の呼び出し、HUD と `localStorage` への書き込み、レバーの class と style を
  全部 1 本の記録にして sha256 を取る
- 入力はフレーム番号から決める（Enter・NumpadEnter・Space の押下／離す／repeat、左右キー、P で一時停止と
  再開、blur、visibilitychange、Canvas のタップ、FIRE の pointerdown/up・lostpointercapture、
  レバーの pointerdown/move（別の指を含む）/up、レバーを握ったままの blur）。フレームの間隔は
  揺らし、4001 フレームごとに 400ms 飛ばす

| 条件 | 記録の行数 | `Math.random` の回数 | sha256（先頭 16 桁） | 変更前後 |
|------|-----------:|---------------------:|----------------------|----------|
| そのまま、40000 フレーム | 50,436,640 | 52,965 | `72e52c293d44d351` | 一致 |
| 敵を 3 列 2 段に減らし（両方の `COLS`/`ROWS` を同じに書き換え）、12000 フレーム。ウェーブ 3 まで進む | 8,328,385 | 8,348 | `97add5e7db8aa3d1` | 一致 |

- 通った分岐: 自機の射撃、敵の射撃、シールド、敵の撃破、UFO の出現と撃破、被弾、ゲームオーバーと
  やり直し、全滅から次のウェーブ（`sfx:wave` 3 回）、ハイスコアの保存
- 記録が違いを拾えることの確認: 変更後の `PLAYER_SPEED` を 261 にすると、200 フレームで sha256 が変わった
  （`3a4777d89d8e3b15` → `c07f5dafaaeecd9b`）。一方、`stepEnemyFire` と `stepUfo` の順を入れ替える、
  `mode !== 'playing'` での `fireQueued = false` を消す、の 2 つは 3000 フレームでは差が出なかった
  （この入力の並びでは同じ結果になる）。**この 2 点は下の読み合わせで確かめたもので、差分実行では確かめていない**

## 依頼の項目ごと（変更前と同じだったもの）

1. `update()`: 同じ。`state.ts:359-381` の呼ぶ順と `return` の位置が変更前 341〜484 行と一致
   - `alive` は `stepFormationMove`（`filter` で作り、`stepFormation` の前）で出し、`stepEnemyFire` に渡す。変更前 380・387 行と同じ
   - 敵の弾で当たったら `hitPlayer` → `mode !== 'playing'` で戻る（`state.ts:376-379`、変更前 455-458 行）
   - 外枠の判定はシールド削り → 自機の高さで `gameOver` と `return` → 全滅で次のウェーブ（`state.ts:333-357`、変更前 461-483 行）
   - `particles`・`playerBullets`・`enemyBullets`・シールドの削りは `filter` で作り直し、`hitShield` は `splice`、撃破は `e.alive = false`。変更前と同じ
2. `Math.random()` の順番と回数: 同じ（上の実測で回数も記録も一致）。`createState` で星を後から足しても、`loadHigh`・`startFormation` は乱数を使わないので順は同じ
3. 状態の読み書き: 同じ。ローカル変数に写して書き戻す箇所は無い（`update` で持つローカルは `alive` だけ）。`newGame`・`newWave` の初期化項目と順は変更前 270-292 行と同じ
4. 入力: 同じ。`input.ts` のキー・FIRE・レバー・Canvas・blur・visibilitychange の分岐と順は変更前 710-811 行と一致。`fireQueued` は keydown の Space と FIRE の pointerdown で立て、`stepPlayer` で撃ったとき、`update` の `mode !== 'playing'` で下ろす（変更前と同じ 3 か所）
5. 描画: 同じ。`render.ts` と変更前 486-682 行を `diff` にかけ、違いは `ctx`・`s.` の付け足し、ループ変数の改名（`st`・`c`）、`drawUfo` の `time` 引数だけ
6. 読み込み時の `window` / `document`: 触らない。`node` で 5 ファイルをそれぞれ単独で import して、どれもエラーなく読めた
7. tests の import 先、`index.astro:148` のコメント、`README.md:39-49` の説明: 新しいファイルと合っている。`npm test` は 15 件 pass
