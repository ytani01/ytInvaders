# TODO-007 reviewer 報告

対象: `git diff`（HEAD 52fa068 との差分。game.ts、audio.ts、index.astro、logic.test.ts）。

**要修正: 0 件。** 検討 2 件。そのほかは前と同じだった。

## 検討

### 1. `src/game/game.ts:757`、`:791`: `setPointerCapture` が投げると、ページのエラーとして表に出るようになった

- 何が: try/catch を外したので、`setPointerCapture` が例外を投げると、捕まらずに
  `pageerror`（コンソールのエラー）になる。前は黙って握りつぶしていた
- 前提（「最後の文なので、それまでの処理は済む」）は正しい。Playwright（Chromium）で
  実測した。同じ要素に付けた別のリスナーも呼ばれる
  - `mouse.click` / `touchscreen.tap` / `locator.tap`（isTrusted=true、pointerId 1〜3）:
    例外なし。前の処理も `setPointerCapture` も済む
  - `dispatchEvent('pointerdown', { pointerId: 1 })`（合成、isTrusted=false）: 例外なし
  - `dispatchEvent('pointerdown', { pointerId: 99 })`（合成、実在しないポインタ）:
    `NotFoundError: Failed to execute 'setPointerCapture' on 'Element': No active pointer ...`。
    それより前の処理と、2 つめのリスナーは実行された
- なぜ気にするか: 実際の操作では起きないが、**verifier が合成イベントで FIRE やレバーを
  押すと `pageerror` が出る**。前後比較で「前には無かったエラー」として見える。
  verifier には `touchscreen.tap` など実際のポインタを使うよう伝えるのがよい
- Firefox と Safari（WebKit）での挙動は未確認。実害は未確認

### 2. `src/game/audio.ts:15`: `webkitAudioContext` しか無いブラウザで音が出なくなる

- 何が: `AudioContext` が無く `webkitAudioContext` だけある環境（Safari 14.1 より前、
  iOS 14.5 より前と記憶している。未確認）では、`AC` が `undefined` になり
  `disabled = true` で無音になる。前はそちらで鳴っていた
- 例外は出ない（`if (!AC)` で抜ける）。型は `tsc --noEmit`（TypeScript 6.0.3）で
  src にエラーなし（tests の `node:test` の型が無いエラーは HEAD でも同じ 2 件）
- 今のブラウザでの挙動は変わらない。対象外にしてよいかは利用者の判断。実害は未確認

## 前と同じだったもの

### 1. keydown / keyup（コードを読んで突き合わせた。ブラウザでの実測は verifier の担当）

keydown。`input`・`fireQueued`・呼び出し・`preventDefault` の 4 点。

| キー | repeat | input | fireQueued | togglePause / startOrContinue | preventDefault | 前と |
|------|--------|-------|------------|-------------------------------|----------------|------|
| ArrowLeft / KeyA | false | left = true | 変えない | 呼ばない | する | 同じ |
| ArrowLeft / KeyA | true | left = true | 変えない | 呼ばない | する | 同じ |
| ArrowRight / KeyD | false | right = true | 変えない | 呼ばない | する | 同じ |
| ArrowRight / KeyD | true | right = true | 変えない | 呼ばない | する | 同じ |
| Space | false | fire = true | true にする | 呼ばない | する | 同じ |
| Space | true | fire = true | 変えない | 呼ばない | する | 同じ |
| KeyP | false | 変えない | 変えない | togglePause | する | 同じ |
| KeyP | true | 変えない | 変えない | 呼ばない | する | 同じ |
| Enter / NumpadEnter | false | 変えない | 変えない | startOrContinue | する | 同じ |
| Enter / NumpadEnter | true | 変えない | 変えない | 呼ばない | する | 同じ |
| それ以外（`''` を含む） | 両方 | 変えない | 変えない | 呼ばない | しない | 同じ |

- `sfx.unlock()` はどのキーでも最初に呼ぶ。前と同じ
- 順序だけ違う: 前は `togglePause` / `startOrContinue` の後に `preventDefault`、
  今は前。どちらも例外を投げないので結果は同じ（1 行だけ記録）
- keyup: 5 つのキーで該当する `input` を false、それ以外は何もしない。前と同じ
- `input[k]` の型: `tsc` でエラーなし

### 2. FIRE とレバー

- FIRE の `pointerdown` / `pointerup` / `pointercancel` / `lostpointercapture` /
  `contextmenu` の中身と順序は `bindFire` のときと同じ
- レバーの `pointerdown` でも `setPointerCapture` は最後の文。前提は正しい（上の検討 1）

### 3. stepFormation とテスト

- 呼び出しは `game.ts:382` の 1 か所で、前から 4 引数だった。ゲームの挙動は同じ
- 数値の境目は、余白 10 → 12 に合わせて 2 ずつずらしただけで、形は前と同じ
  - 右端: 敵の右辺が端の 2 手前、dx 3 で越える → 端で止まる（470 → 468）
  - 左端: 左辺が端の 2 先、dx 3 で越える（ox 12 → 14、止まる所 10 → 12）
  - ちょうど接する / 1 足りない: 右 445 / 444（右端 468）、左 15 / 16（左端 12）。
    `touchR.ox` 448 も計算と一致
  - 「端でなければ」「生きている敵だけ」の値は、端が 468 / 12 でも同じ分岐に入る
- 消した test の中身（`DROP > 0`、右と左で `oy` が `DROP` だけ下がる）は、
  右端 test（`DROP > 0` と `oy`）と左端 test（`oy`）で揃っている。抜けは無い
- 壊すと落ちるかを、scratchpad の写しで確かめた（リポジトリは触っていない）

| 壊し方 | 落ちた test |
|--------|-------------|
| 右の `>=` を `>` | 端にちょうど接したら… |
| 左の `<=` を `<` | 端にちょうど接したら… |
| 右端を `W - 10` | 右端で…、往復し続けても…、端にちょうど接したら… |
| 左端で下がらない（`oy: f.oy`） | 左端で… |

- `npm test`: 15 件すべて通る
- テストは `W` / `MARGIN` を import せず 480 / 12 を直に書く。既存の「往復し続けても」
  test も同じ書き方なので、今の作りに沿っている

### 4. index.astro

- `.hud` の `height: 2.6em`: `font-size` は `.hud` 自身に `calc(var(--w) * 0.065)` が
  付いているので、em はその値。2.6 × 0.065 = 0.169 で、前の `calc(var(--w) * 0.169)` と
  同じ（計算で確認。画面での実測は verifier）
- `--hud-h` の参照はほかに無い（`rg` で確認）
- `.touch` の中は `.lever`（div）と `#btn-fire.fire`（button）だけで、button は FIRE の 1 つ。
  `.touch button` に当たっていたのは FIRE だけなので、ほかの要素のスタイルは変わらない
- 詳細度は `.touch button`（0,1,1）→ `.touch .fire`（0,2,0）に上がったが、
  `.touch .fire:active`（0,3,0）が今も勝つ。`.touch > *`（0,1,0）とは同じプロパティを
  持たない。見た目は変わらない
- `align-items: stretch` を消した: `.game` の `align-items` を指定するほかのルールは無い
  （メディアクエリの中も）。初期値 `normal` は flex では stretch と同じ
- frontmatter を消した後も `Astro.generator` は使える。`astro build --outDir`（scratchpad）で
  `<meta name="generator" content="Astro v7.3.3">` が出ることを確かめた

### 5. 範囲

- 差分は TODO.md の TODO-007 の一覧と一致。指示に無い変更は無い

## 備考

- Playwright の実測のため、リポジトリ直下に一時ファイル `.pc-tmp.mjs` を置き、
  実行後すぐ消した（`playwright` を解決させるため）。`git status` は変わっていない
