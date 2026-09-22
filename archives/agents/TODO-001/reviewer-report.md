# TODO-001 reviewer の報告

対象: `git status --short` / `git diff` の src/game/、src/pages/index.astro、tests/、
package.json、README.md（archives/ は対象外）。

直すべき: 0 件。直すとよい: 3 件。参考: 5 件。

## 指摘

### 1. 直すとよい — README.md:11,14（遊び方の表）

「開始・再開 | Enter | FIRE ボタンか画面をタップ」とあるが、一時停止からの再開は
Enter でも FIRE ボタンでもできない。`startOrContinue()`（src/game/game.ts:676-678）は
title / gameover のときだけ動き、paused では何もしない。一時停止から戻せるのは P と
画面のタップ（game.ts:763-767）だけ。「再開」がゲームオーバー後のやり直しの意味なら、
一時停止の「再開」と紛らわしい。

### 2. 直すとよい — src/game/game.ts:652（一時停止の画面の文言）

一時停止の画面には `P TO RESUME` としか出ない。タッチの端末では、アプリの切り替えなどで
自動の一時停止（`suspend()`、game.ts:729-736）に入ると P キーが無く、戻し方（画面の
タップ）が画面に出ない。FIRE や ◀▶ を押しても戻らない（`bindHold` は
`startOrContinue()` を呼ぶだけ）。タイトルの文言は `PRESS ENTER / TAP FIRE` とタッチ向けも
書いているのと揃っていない。実機での実害は未確認（verifier の Playwright で
`hasTouch` を付けて、blur 後に FIRE を押しても戻らないことは確かめられるはず）。

### 3. 直すとよい — tests/logic.test.ts（当たり判定の位置と、編隊の縦の外枠が試されていない）

scratchpad に写したコピーを 1 か所ずつ壊して `node --test tests/` を走らせた
（リポジトリのファイルは変えていない。終了後の `git status --short` は開始時と同じ）。

| 壊した箇所（game.ts） | 落ちたテスト |
|---|---|
| `enemyRect` の `y: f.oy + e.ry` → `y: e.ry`（:52） | なし |
| `enemyRect` の `x: f.ox + e.rx` → `x: e.rx`（:52） | なし |
| `formationBounds` の maxY を `y`（高さを足さない）にする（:68） | なし |
| `formationBounds` の minY を 0 にする（:66） | なし |
| `DROP = 0`（:40） | 1 件（往復し続けても〜）だけ |
| 右端の判定から `dx` を外す（:88） | 2 件 |
| `formationSpeed` からウェーブの項を外す（:46） | 1 件 |
| `overlaps` の y を `<=` にする（:21） | 1 件 |
| 右端 `>=` → `>`、左端 `<=` → `<`（:88, :91） | なし（接する境界は試していない。実害は小さい） |

- 弾と敵の当たりは `overlaps(b, enemyRect(formation, e))`（game.ts:406-407）で決まるが、
  `enemyRect` はテストから呼ばれていない。敵の位置を取り違えても全件通る
- `formationBounds` の y 側は、シールドを削る判定（:446）と、敵が自機の高さまで来たら
  終わる判定（:453）に使われるが、テストは x 側しか見ていない
- 右端・左端のテストは `50 + DROP` と書いており、`DROP` の値そのものは確かめていない
  （0 にしても 2 件は通る）。依頼の「1 段下がる」は 20000 ステップのテストの
  `drops >= 2` でだけ捕まる

仕様の「当たり判定と編隊の動き」の範囲で、`enemyRect` と `formationBounds` の y を
1 件ずつ足せば埋まる。`update()`（弾の発射、シールド、ウェーブの進行、侵入での終わり）は
`startGame()` の中でテストできないことは implementer の報告どおり。そこまで広げるかは
管理者の判断。

### 4. 参考 — src/game/game.ts:738-767（Android Chrome での最初のタップの音、実害は未確認）

`sfx.unlock()` はキーの keydown と、タッチの `pointerdown` で呼ぶ。HTML の仕様では、
`pointerType` が mouse 以外の `pointerdown` はユーザーの活性化（user activation）を
起こす入力に入っておらず、タッチでは `pointerup` / `touchend` が起こす。そのため
タッチの最初の 1 回では AudioContext が suspended のまま残る可能性がある。2 回目以降の
タップでは `unlock()` がまた `resume()` を呼ぶので戻るはず。実機では確かめていない。

### 5. 参考 — src/game/game.ts:742, 763-767（ゲームオーバー直後のタップですぐ始まる）

キーボードでは Enter でしかやり直さないが、タッチでは FIRE か画面のタップでやり直す。
連打している最中にゲームオーバーになると、GAME OVER の画面を見ずに次のゲームが始まる。
実害は未確認（遊び方の好みの範囲とも言える）。

### 6. 参考 — src/game/game.ts:258-267（ウェーブが変わってもシールドは戻らない）

`newWave()` はシールドを作り直さず、`makeShields()` は `newGame()` でだけ呼ぶ。
仕様には書かれていないので、意図どおりかの確認だけ。

### 7. 参考 — src/pages/index.astro:137（タッチのボタンは `pointer: coarse` でだけ出る）

主な入力がマウスのタッチ対応ノート PC などでは、ボタンが出ない。キーボードがあるので
遊べなくはない。`any-pointer: coarse` にするかは判断の範囲。
また viewport に `viewport-fit=cover` を付けたが、`env(safe-area-inset-bottom)` の余白は
取っていないので、iPhone のホームインジケータとボタンが重なる可能性がある（未確認）。

### 8. 参考 — src/game/game.ts:8-9, 41, 51, 97-98, 123, 132, 142, 149（使われない export）

`W` `H` `MARGIN` `COLS` `ROWS` `enemyRect` `loadHigh` `saveHigh` `HudEls` `TouchEls` `Rect` は
export しているが、tests/ からも index.astro からも import されていない（`rg -w` で確認）。
害は無い。指摘 3 でテストを足すなら `enemyRect` は使われるようになる。

## 問題なかった観点

- ゲームループ: rAF の dt を 0.25 秒で頭打ちにし 1/120 秒の固定ステップで回す。負の dt は捨てる（game.ts:772-783）
- 弾のすり抜け: 1 ステップの移動は自機の弾 5.2px・敵の弾 (200+15×wave)/120px で、弾の長さ 12px・セル 4px・敵の高さ 18px より十分小さい。端での 16px の段下げと弾の移動を足しても 21px で、弾と敵の高さの和 30px を超えない。編隊の横の速さは wave 30 でも 1 ステップ 16px で、敵の幅と弾の幅の和 29px より小さい
- 編隊: 生きている敵の外枠で端を判定し、端に揃えて止め、1 段下げて向きを変える。次のステップで再び下がらない。数が減る・ウェーブが進むと速くなる（game.ts:44-95、364）
- 当たり判定の順番: 編隊を動かしてから弾を判定。敵を撃った弾・シールドに当たった弾はその場で消え、1 発で 2 体は倒さない
- 被弾・ゲームオーバー・ウェーブ遷移の分岐: 被弾で残機が 0 なら即 return し、全滅とゲームオーバーが同じステップで重ならない（game.ts:438-466）
- UFO: 左右どちらからでも画面外で消える。ウェーブが変わると消える
- localStorage: getter が投げる・undefined・getItem/setItem が投げる・値が `abc` `-5` `1e400` `""` のとき、`loadHigh()` は 0 を返し `saveHigh()` は投げない（node で実測）
- AudioContext: `window` が無い・AudioContext が無い・コンストラクタが投げる・`resume()` が reject する、のどれでも `unlock()` と効果音の呼び出しは投げず、unhandled rejection も出ない（node で実測）
- モジュールの読み込み時に window / document に触らない（tests から import でき、`npm test` 10 件 pass・終了コード 0 を確認）
- 操作キー: ← → / A D / Space / P / Enter はすべてある。ゲームパッドは入っていない
- ネオン調の描画: `shadowBlur` のグロー、撃破時のパーティクル、被弾時の揺れ、流れる星空、すべてある
- 範囲: 変わったのは依頼の対象ファイルだけ。依存関係は足していない
- コメント: 「なぜ」を書いている（自動再生の制限、端の判定、自動の一時停止など）
- 過剰な作り: 設定の層や一度しか使わない抽象は無い（指摘 8 の export だけ）

## 未確認

- Node 22.18 で `node --test tests/`（ディレクトリ指定）が `.test.ts` を拾うか。手元は Node 26.10.0 だけで、22.x で試せていない

## 2 回目

対象: implementer-request-2.md の 7 項目で変わった部分だけ。直すべき 0 件、直すとよい 0 件、参考 0 件。

### 確かめたこと

- 一時停止からの再開: Enter・FIRE・画面のタップはすべて `startOrContinue()`（game.ts:683-687）を通り、paused なら playing に戻る。P は `togglePause()` のまま。title / playing / gameover で P を押しても分岐は変わらない。文言は `P / ENTER / TAP TO RESUME`（:655）
- ゲームオーバー後の待ち: `overAt` は `gameOver()`（:300）でだけ入り、被弾で残機 0 と、敵が自機の高さまで来た場合の両方がここを通る。`newGame()` を呼ぶのは `startOrContinue()` だけで、gameover では `time - overAt >= RESTART_LOCK` のときだけ。`time` は gameover の間も `update()` の先頭で進む。`PRESS ENTER / TAP FIRE` も同じ条件で出る（:659）。Enter は `ev.repeat` を捨てるので、押しっぱなしでも 1 秒後に勝手に始まらない
- シールドの作り直し: `newWave()`（:262）で作り直し、`newGame()` は `newWave()` を通るので最初のウェーブにもある。ウェーブ 7 以降の編隊の開始位置（下端 308）はシールド（490）より上
- `pointerup` での `sfx.unlock()`（:764-767, :780）: 押している間の解除（`up()`）は変わらない。コメントは理由を書いている
- CSS（index.astro）: `any-pointer: coarse` にした。`.touch` は border-box で、`--touch-h` と下の padding の両方に `env(safe-area-inset-bottom, 0px)` を足しているので、ボタンの高さは変わらない
- export を外したもの: 残った export（`overlaps` `Enemy` `Formation` `DROP` `formationSpeed` `enemyRect` `formationBounds` `stepFormation` `makeEnemies` `startFormation` `startGame`）は、どれも tests か index.astro から使われている。import しているのは tests/logic.test.ts と index.astro:31 だけで、外した名前を import している箇所は無い。`npm test` 14 件 pass、`npm run build` 終了コード 0、1 回目と同じオプションの `tsc --noEmit` 終了コード 0（npx のキャッシュに typescript@5.9.3 を入れた。package.json は変えていない）
- README: 表を「開始・やり直し」「一時停止」「一時停止からの再開」に分け、挙動と合っている

### 壊すと落ちるか（scratchpad のコピーで、前回と同じ壊し方）

| 壊した箇所（game.ts） | 1 回目 | 2 回目 |
|---|---|---|
| `enemyRect` の y から `f.oy` を外す | なし | enemyRect |
| `enemyRect` の x から `f.ox` を外す | なし | enemyRect |
| 右端 `>=` → `>` | なし | 端にちょうど接したら〜 |
| 左端 `<=` → `<` | なし | 端にちょうど接したら〜 |
| `formationBounds` の maxY に高さを足さない | なし | formationBounds |
| `formationBounds` の minY を 0 にする | なし | formationBounds |
| `DROP = 0` | 1 件 | 2 件 |
| `overlaps` の y を `<=` | 1 件 | 1 件 |
| `formationSpeed` のウェーブの項を外す | 1 件 | 1 件 |

今回足した壊し方: `formationBounds` で死んだ敵も数える → 2 件、全滅でも null を返さない → 1 件、
右端で下がる量を `DROP` でなく 8 にする → 2 件。すべて落ちた。リポジトリのファイルには触れておらず、
終わった後の `git status --short` は開始時と同じ。
