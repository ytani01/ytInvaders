# TODO-007 verifier 報告

対象: 未コミットの `git diff`（HEAD 52fa068 との差分。`src/game/audio.ts`、
`src/game/game.ts`、`src/pages/index.astro`、`tests/logic.test.ts`）。
reviewer の報告（`archives/agents/TODO-007/reviewer-report.md`）を先に読んだ。

## 1. `npm test` / `npm run build`（本体、変更後）

- `npm test`: 15 件すべて pass（終了コード 0）
- `npm run build`: `astro build` が `Complete!` で終了（終了コード 0）

## 準備

- 変更前: `git worktree add <scratchpad>/before HEAD` で 52fa068 を出し、
  `node_modules` は本体へのシンボリックリンクにした。`npm run build` 済み
- 変更後: 本体を `npm run build` 済み
- それぞれ `npx astro preview --port 4501`（before）/ `--port 4502`（after）で配信
  （URL は `/ytInvaders/`）。計測後、PID を `pgrep`/`ss` で確かめてから `kill`、
  worktree は `git worktree remove` で削除済み（`git worktree list` で本体のみに戻ったことを確認）
- 計測は Playwright（chromium、本体の `node_modules`）で 1 本のスクリプトを書き、
  `archives/agents/TODO-007/measure.mjs` に残した。同じスクリプトを前後の URL に
  対して実行し、`node measure.mjs <url> <out.json> <screenshot.png>` で
  JSON と PNG を出す

## 2. キー（1280x800）

### defaultPrevented / repeat（新しいコンテキストで 1 キーずつ、down→up と down→down→up）

ArrowLeft・KeyA・ArrowRight・KeyD・Space・KeyP・Enter・NumpadEnter は
repeat なし・あり（2 回目の `ev.repeat` は実際に `true` になることを確認）とも
`defaultPrevented === true` で前後一致。KeyX は repeat なし・ありとも
`defaultPrevented === false` で前後一致。**JSON はキー単位で完全一致**
（`repeatTable` に diff なし）。

### 挙動（1280x800、1 ページの中で順に操作）

| 項目 | 前 | 後 | 一致 |
|---|---|---|---|
| タイトルの操作説明（シアン、y=320 行の画素数） | 437 | 438 | ほぼ一致（1 px、星のノイズと見られる） |
| Enter → 開始後、同じ行のシアン画素 | 0 | 0 | 一致（説明文が消える） |
| ← を押している間、自機が左へ | movedLeft=true | movedLeft=true | 一致 |
| → を押している間、自機が右へ | movedRight=true | movedRight=true | 一致 |
| 自機の x（run 幅・位置） | 各段で ±4px 差 | 同上 | 位置の絶対値は数 px 前後する（後述） |
| Space → 弾（白画素、自機より上） | before=false → after=true | 同じ | 一致 |
| P → PAUSED（黄色、y=288 行の画素数） | 1220 | 1220 | **完全一致** |
| もう一度 P → 再開（同じ画素数） | 0 | 0 | 一致 |
| pageerror / console error | 0 件 | 0 件 | 一致 |

自機の x 座標は前後で最大 4px 前後する（例: 左に寄せた後の位置が
`minX=135/maxX=171` と `minX=139/maxX=175`）。これは同じ入力を別プロセスの
別ページで再生した際のフレームタイミングのばらつきで、`PLAYER_SPEED=260px/s`
に対して数 ms 分の差にすぎない。**方向（movedLeft/movedRight）と幅
（run 幅 36〜37px）は前後で一致**しており、移動の分岐そのものは変わっていない。

自機の位置検出は当初、行全体でシアン系画素の最小・最大 x を取る素朴な方法で
試したところ、被弾時に散るスパーク粒子（同じ `#00e5ff` 系の色で自機の周りに
飛ぶ）を自機と誤認し、前後で無関係な大きな差（数百 px）が出た。**各行で最も
長く連続した画素のかたまり**（スパークは 3x3 の点が散るだけで連続しない）を
自機とみなすよう `measure.mjs` を直してから測り直し、上の結果になった。

## 3. タッチ（360x740、hasTouch、isMobile）

`page.touchscreen.tap` と CDP の `Input.dispatchTouchEvent` を使った
（reviewer 指摘のとおり、合成 `dispatchEvent('pointerdown', {pointerId: 99})`
のような実在しないポインタは使っていない）。

| 項目 | 前 | 後 | 一致 |
|---|---|---|---|
| FIRE タップでタイトルから開始（操作説明のシアン画素） | 439→0 | 438→1 | ほぼ一致（1 px、星のノイズと見られる） |
| 遊んでいる間のタップで弾が出る | true/true | true/true | 一致 |
| レバーを右へドラッグ → つまみの transform | `matrix(1,0,0,1,41,0)` | 同じ | **完全一致** |
| ドラッグ中に自機が右へ | true | true | 一致 |
| 離すとつまみが戻る（`transform: none`） | true | true | 一致 |
| pageerror / console error（タップ・ドラッグの間） | 0 件 | 0 件 | **一致（0 件）** |

## 4. 見た目（両条件で getComputedStyle）

- `.hud` の height（`60.8281px`）、`#btn-fire` の color・border・box-shadow・
  background・font-size・border-radius、`#lever`・`#lever-knob` の
  width・height・border-radius・background: **すべて前後で完全一致**
- `.game` の `align-items`: 前は `stretch`、後は `normal`。これは reviewer の
  検討どおり、`.game` の他の `align-items` 指定が無く、`flex-direction: column`
  の cross 軸では初期値 `normal` が `stretch` と同じ効き方をするための表示上の
  差。実際に取得したスタイルの数値としては違う文字列になる点は記録しておく
- タイトル画面のスクリーンショット（1280x800 相当ではなく指示どおり両条件、
  ここでは 360x740 のものを目で見た）を
  `~/tmp/playwright-mcp/todo007-before-title.png` と
  `todo007-after-title.png` に保存。並べて見て、レイアウト・文字・色・
  HUD・レバー・FIRE ボタンの見た目は同じ。星の位置がランダムに違うだけ

## 範囲

- 変更されたファイルは `src/game/audio.ts`、`src/game/game.ts`、
  `src/pages/index.astro`、`tests/logic.test.ts` の 4 つで、reviewer の報告・
  TODO-007 の一覧と一致。指示に無い変更は無い

## 確かめられなかったこと・判断が要る点

- reviewer が挙げた 2 件の検討（`setPointerCapture` の例外が pageerror として
  表に出るようになる点、`webkitAudioContext` のみのブラウザで無音になる点）は
  今回の Chromium・実際のポインタでの操作では発生しなかった（`pageerrors` は
  常に 0 件）。Firefox・Safari や `webkitAudioContext` しか無い環境は確かめて
  いない。実害は未確認
- タイトル文言のシアン画素数に前後で 1 px の差が数か所出た（437/438、439/438、
  0/1）。星のランダム配置によるノイズだと考えているが、確証はない。**実害は
  未確認**（表示上は目視で違いを確認できていない）
- 自機の x 座標が前後で数 px（最大 4px）ずれる点は、別プロセス・別ページの
  フレームタイミングのばらつきだと考えているが、これも確証はない。方向と
  移動幅は一致しているので、分岐そのものへの影響は無いと見ている
- `.game` の `align-items` が `stretch` → `normal` に変わったこと自体は
  diff どおりの意図した変更で、reviewer 済み。見た目・レイアウトの実測でも
  差は出ていない
