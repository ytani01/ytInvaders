# TODO-001 implementer の報告

## 作ったファイル・変えたファイル

| ファイル | 内容 |
|---------|------|
| `src/game/game.ts`（新規） | 1–138 行: 純粋な関数（`overlaps` 20、`formationSpeed` 44、`formationBounds` 56、`stepFormation` 76、`makeEnemies` / `startFormation` 104–118、`loadHigh` / `saveHigh` 123–138）。219 行以降: `startGame()`（状態、`update` 328、`render` 567、HUD 665、キー・タッチ入力、rAF ループ） |
| `src/game/audio.ts`（新規） | `Sfx` クラス。`unlock()` で AudioContext を作る／resume。音は oscillator とノイズバッファで合成 |
| `src/pages/index.astro` | HUD（DOM）、`<canvas>`、タッチのボタン 3 つ、CSS、`<script>` で `startGame` を呼ぶ |
| `tests/logic.test.ts`（新規） | 当たり判定と編隊のテスト 10 件 |
| `package.json:13` | `"test": "node --test tests/"`。依存関係は足していない |
| `README.md` | 遊び方（操作の表）と開発の手順（dev / build / test） |

## 設計の要点

- `game.ts` はモジュールの読み込み時に `window` / `document` に触らない（触るのは
  `startGame()` の中だけ）。`audio.ts` も `unlock()` の中でだけ `window` を読む。
  そのためファイルは分けず、tests から `game.ts` を直接 import している
- 時間の刻み: rAF の dt を 0.25 秒で頭打ちにし、1/120 秒の固定ステップに分けて
  `update` を回す（`game.ts:181-182`、ループは末尾の `frame()`）。自機の弾は
  1 ステップ 5.2px、敵の高さ 18px・シールドのセル 4px・弾の長さ 12px なので、
  すり抜けは起きない
- 編隊: `stepFormation` は生きている敵の外枠で端を判定し、端に着いたら端に
  合わせて止め、`DROP`（16px）下がって向きを変える。引数は書き換えず新しい
  状態を返す。速さは `formationSpeed(alive, total, wave)`（生き残りが減るほど、
  ウェーブが進むほど速い。1 体だけになると約 7.3 倍）
- 当たり判定 `overlaps` は辺が接するだけなら当たらない（厳密な不等号）
- 画面: 論理解像度 480x640 固定。canvas の実ピクセルは devicePixelRatio（上限 2）倍。
  CSS で `min(100vw, (100dvh - HUD - ボタン) * 0.75)` の幅に収める
- タッチのボタンは `@media (pointer: coarse)` のときだけ出す。FIRE ボタンと画面のタップは
  タイトル・ゲームオーバーでは開始、一時停止中の画面タップは再開
- ハイスコア: `loadHigh` / `saveHigh` を try/catch で囲み、`globalThis.localStorage?.` で
  読む（無い・例外のときは 0 / 何もしない）。ゲームオーバーのときに保存
- 一時停止: P。加えて、ウィンドウの blur と `visibilitychange`（hidden）で自動的に
  一時停止し、押しっぱなしのキーを離した扱いにする（依頼に無いが、タブ復帰時の
  暴走を防ぐために入れた。要らなければ `game.ts` の `suspend()` を消す）
- 被弾: 残機を減らし、画面の揺れ・パーティクル・画面の敵弾を消す・2 秒の無敵。
  敵が自機の高さまで降りたら即ゲームオーバー。全滅させたら次のウェーブ（+100 点）
- UFO: 12–22 秒ごとに上を横切る。得点は 50 / 100 / 150 / 300 からランダム

## 検証

| コマンド | 結果 |
|---------|------|
| `npm test` | 成功（終了コード 0）。10 件すべて pass |
| `npm run build` | 成功（終了コード 0）。1 page built |
| `npx astro check` | 使えない。`@astrojs/check` が入っておらず、実行すると導入の確認プロンプトが出る（依存を足さないと使えない） |
| 代わりの型チェック: `npx -p typescript@5 tsc --noEmit --strict --verbatimModuleSyntax --isolatedModules --erasableSyntaxOnly --moduleResolution bundler --allowImportingTsExtensions --lib esnext,dom --skipLibCheck src/game/game.ts src/game/audio.ts` | 成功（終了コード 0、TypeScript 5.9.3、npx のキャッシュで実行し package.json は変えていない）。`--erasableSyntaxOnly` で、型を落とすだけで動かない構文が無いことも確かめた。`tests/` は `@types/node` が無いので型チェックの対象外。`index.astro` の `<script>` も対象外 |

簡単な動作確認（verifier の実測の代わりではない）: `astro preview` を開いて Playwright
（1.63.0、npx のキャッシュ）で Enter → Space と ← を 3 秒押し → P。ページのエラー 0 件、
HUD が `SCORE 30` に進み、敵を撃ち落とせていた。375x667 のタッチ端末の設定では
`scrollWidth` 375 = `innerWidth` 375（横スクロール無し）、タッチのボタンが表示された。
使ったスクリプトはスクラッチパッドに置いただけで、リポジトリには残していない。

### 壊すと落ちるかの確認

`game.ts` を 1 か所ずつ `sed` で壊して `npm test` 相当を走らせ、戻した。

| 壊した箇所 | 落ちたテスト |
|-----------|-------------|
| 右端の判定を `if (false)` にする | 右端で 1 段下がる / 往復してもはみ出さない / 端の判定は生きている敵だけ（3 件） |
| `overlaps` の x を `<=` にする（接しても当たる） | 辺が接するだけなら当たらない |
| `formationSpeed` を `return base;`（数に依らない）にする | 数が減るほど速い |
| 左端で下がらない（`oy: f.oy`） | 左端で 1 段下がって右へ向きを変える |

戻した後に 10 件 pass を確かめた。

## 判断が要る点・残る懸念

- 自動の一時停止（blur / visibilitychange）は依頼に無い追加。上に書いたとおり
- `npm test` は `node --test tests/`。README に「Node 22.18 以降」と書いた
  （`package.json` の `engines` は `>=22.12.0` のままで、22.12–22.17 では型を落とす機能が
  既定で無効のため `npm test` が走らない）。`engines` を上げるかは範囲外なので触っていない
- タッチのボタンを `pointer: coarse` でだけ出すため、デスクトップの Playwright で
  ボタンを確かめるときは `hasTouch` / `isMobile` を付ける必要がある（verifier 向け）
- ゲームパッド、BGM、編隊の足音、敵の種類による弾の違いは入れていない
- 当たり判定・編隊以外（自機の移動、弾の発射、シールドの削れ、ウェーブの進行）は
  `startGame()` の中にあり、テストしていない

---

## 2 回目（reviewer の指摘への対応）

依頼: `implementer-request-2.md`。`package.json` の `engines`（`>=22.18.0`、管理者が変更）には触れていない。

### 変えた箇所

| 指摘 | 箇所 | 内容 |
|------|------|------|
| 1・2 | `src/game/game.ts:681-687` | `startOrContinue()` は一時停止中なら再開する。Enter・FIRE ボタン・画面のタップはすべてここを通る。P は従来どおり `togglePause()` |
| 1・2 | `src/game/game.ts:655` | 一時停止の文言を `P / ENTER / TAP TO RESUME` にした |
| 1 | `README.md` の遊び方の表 | 「開始・やり直し」と「一時停止からの再開」を別の行に分けた。やり直しを受け付けない時間、自動の一時停止、ウェーブでシールドが戻ることを箇条書きに足した |
| 3 | `tests/logic.test.ts:116-166` | 4 件足した（`enemyRect` の x・y、`formationBounds` の minY・maxY と全滅で null、`DROP` が 0 でなく下がる量と等しい、左右の端にちょうど接したとき・1 px 届かないとき）。接する境界のテストは dx = 3 * 1 にして、浮動小数の誤差が入らないようにした |
| 4 | `src/game/game.ts:764-767, 780` | タッチのボタンと canvas の `pointerup` でも `sfx.unlock()` を呼ぶ |
| 5 | `src/game/game.ts:183, 251, 300, 659-661, 686` | ゲームオーバーの時刻（`overAt`）を記録する。`RESTART_LOCK`（1 秒）経つまではやり直さず、`PRESS ENTER / TAP FIRE` も出さない |
| 6 | `src/game/game.ts:262` | `newWave()` でシールドを作り直す（`newGame()` 側の呼び出しは外した。`newGame()` は `newWave()` を呼ぶ） |
| 7 | `src/pages/index.astro:106, 137-139` | `@media (any-pointer: coarse)` にした。ボタンの下の余白とボタンの領域の高さに `env(safe-area-inset-bottom, 0px)` を足した |
| 8 | `src/game/game.ts` | `W` `H` `MARGIN` `COLS` `ROWS` `loadHigh` `saveHigh` `HudEls` `TouchEls` `Rect` の `export` を外した。`rg -lw <名前> tests src/pages` で、残した export がすべて tests か index.astro から使われていることを確かめた（`enemyRect` は新しいテストから使う） |

### 検証

| コマンド | 結果 |
|---------|------|
| `npm test` | 成功（終了コード 0）。14 件 pass |
| `npm run build` | 成功（終了コード 0） |
| `npx -p typescript@5 tsc --noEmit --strict --erasableSyntaxOnly --verbatimModuleSyntax ...`（1 回目と同じオプション） | 成功（終了コード 0） |

簡単な動作確認（Playwright、375x667、`hasTouch` / `isMobile`）: FIRE をタップして開始 →
`window` に `blur` を送る → `PAUSED` と `P / ENTER / TAP TO RESUME` が出る → FIRE をタップ →
再開した（編隊が動き、敵の弾が出た）。ページのエラーは 0 件。横スクロールは無い（375 = 375）。
ボタンが表示されている。ゲームオーバー後に受け付けない時間は、実際には試していない（verifier 向け）。

### 壊すと落ちるかの確認（reviewer の表で「なし」「1 件だけ」だったもの）

| 壊した箇所 | 落ちたテスト |
|-----------|-------------|
| `enemyRect` の `y: f.oy + e.ry` → `y: e.ry` | enemyRect |
| `enemyRect` の `x: f.ox + e.rx` → `x: e.rx` | enemyRect |
| `formationBounds` の maxY に高さを足さない | formationBounds |
| `formationBounds` の minY を 0 にする | formationBounds |
| `DROP = 0` | 下がる量は DROP で 0 ではない / 往復し続けても〜（2 件） |
| 右端 `>=` → `>` | 端にちょうど接したら〜 |
| 左端 `<=` → `<` | 端にちょうど接したら〜 |
| 右端の判定から `dx` を外す | 4 件 |
| `formationSpeed` のウェーブの項を外す | ウェーブが進むと速い |
| `overlaps` の y を `<=` | 辺が接するだけなら当たらない |

戻した後に `cmp` で元と同じことと、14 件 pass を確かめた。

### 残る懸念

- FIRE で一時停止から再開すると、押したままの間は射撃も始まる（再開と同時に 1 発出る）。実害は小さいと見て、そのままにした
- ゲームオーバー後の時間は `update()` の `time` で測る。ゲームオーバー中も `time` は進むので、タブが隠れていた間を除けば約 1 秒
