# TODO-005 reviewer の報告

対象: `git diff`（`src/game/game.ts`、`src/pages/index.astro`、`tests/logic.test.ts`）。
`npm test` は 16 件すべて通過。`leverAxis` の値は node で直接呼んで確かめた
（スクリプトは scratchpad に置いた一時ファイル。残していない）。

要修正: 0 件 / 検討: 3 件 / 好みの範囲: 2 件

## 検討

### 1. 画面の左端近くを触ると、左へ全速で動かせない

- 場所: `src/game/game.ts` の `moveLever`（`clientX - leverX`）と、`index.astro` の `.lever`
- 何が問題か: 中心は触った所になり、左へ倒せる量は「触った x 座標 − 画面の左端」までになる。
  指は画面の外まで動かせないので、左端の近くを触ると左の最高速に届かない。
  右側は FIRE の上まで指を動かせる（pointer capture 中なので効く）ので、この問題は無い
- 起きる条件: 縦向き 390px 幅の場合、`--w` = 100vw、台座の半径は 64px（8rem / 2）。
  node で `leverAxis(-x, 64)` を測った値（x は触った clientX）:

  | 触った x | 左の最大の倒し量 |
  |---:|---:|
  | 10 | -0.01 |
  | 30 | -0.38 |
  | 50 | -0.74 |
  | 74 | -1.00 |

  レバーの範囲はおよそ x = 10〜191 なので、左の約 1/3 では左へ全速が出ない。
  ヒントの「◀ MOVE ▶」は中央にあるが、左手の親指は左寄りを触りやすい。
  実害は未確認（実機での遊びやすさの判断になる。境界線上なので報告だけ）

### 2. 台座の幅が 0 になると、レバーが「入/切」だけになる（未確認）

- 場所: `index.astro` の `.lever-base`（`height: min(8rem, 90%)` + `aspect-ratio: 1`、幅は auto）と、
  `game.ts` の `leverRadius = Math.max(1, touch.leverBase.offsetWidth / 2)`
- 何が問題か: 半径は台座の `offsetWidth` から取る。幅は `aspect-ratio` で高さから決まる前提だが、
  絶対配置・中身が空・幅 auto の要素で、ブラウザがこの比率を使わず幅 0 にすると、
  半径は `Math.max(1, …)` で 1px になる。node で `leverAxis(10, 1)` = 1 を確認した。
  つまり 1px 動かすだけで全速になり、「倒した量に比例」が崩れる。見た目も台座が出ない
- 起きる条件: `aspect-ratio` を絶対配置の幅に効かせないブラウザ。Chrome / Safari の現行版では
  効くはずだが、実測していない。**verifier に `#lever-base` の `offsetWidth` / `offsetHeight` を
  縦向き・横向きの両方で測らせるとよい**

### 3. タッチ画面付きのノート PC でも、ゲーム画面が大きく縮む

- 場所: `index.astro` の `@media (any-pointer: coarse)` の `--touch-h: calc(25dvh + …)`
- 何が問題か: 媒体クエリは前と同じ（タッチ画面があれば出す）なので、主な入力がマウスの
  タッチ画面付きノート PC でも操作欄が 25dvh になる。高さ 1080px の画面では、操作欄が
  88px（5.5rem）から 270px に増え、canvas の高さは 960px から約 778px に減る（計算値）
- 起きる条件: `any-pointer: coarse` に当たるデスクトップ環境。
  背景の「ゲーム画面は小さくなってよい」がここまで含むかは判断が要る。境界線上なので報告だけ

## 好みの範囲

### 4. `bindHold` の `'left' | 'right'`（依頼 6 への意見）

- 場所: `game.ts` の `bindHold(el, key: 'left' | 'right' | 'fire')`
- 意見: 呼び出しは `bindHold(touch.fire, 'fire')` の 1 か所だけになり、`if (key === 'fire')` は
  常に真。型に `'left' | 'right'` を残すと、中の分岐が生きているように読める。
  引数 `key` を外して FIRE 専用にするほうが読みやすい。ただし残しても動きは変わらない

### 5. `leverAxis` に radius ≤ 0 を渡したときの扱いが呼び出し側任せ

- 場所: `game.ts` の `leverAxis`
- 実測（node）:
  - `leverAxis(0, 0)` = NaN、`leverAxis(10, 0)` = 1、`leverAxis(-10, 0)` = -1
  - `leverAxis(10, -64)` = -0.007、`leverAxis(64, -64)` = -1（向きが逆になる）
  - `leverAxis(NaN, 64)` = NaN、`leverAxis(±Infinity, 64)` = ±1
- NaN が `input.axis` に入ると `mv` も NaN になり、`px` は `Math.max(MARGIN, NaN)` = NaN のまま
  次の `newGame` まで戻らない（自機が消える）。今は呼び出し側の `Math.max(1, …)` で防げていて、
  呼び出しは 1 か所なので実害は無い。関数の側で `radius <= 0` を弾くかは好みの範囲

## 問題が無かった点

- `leverAxis` の境目: `leverAxis(0.15r, r)` = 0、少し外で 1.8e-8、端で ±1（ちょうど 1）、半径の外は ±1 に留まる
- `mv`: キーだけのとき `input.axis` は 0 なので、`(right) - (left)` は -1 / 0 / 1 のまま。clamp は効かず、前と同じ
- `mv` の計算は `mode !== 'playing'` の早期 return の後にあり、止まっている間は倒しても動かない（前の ◀▶ と同じ）
- 1 本の指だけを追う: 2 本目の pointerdown は `leverPointer !== null` で無視され、その指の up / cancel も `pointerId` の比較で無視される
- 離したとき: pointerup・pointercancel・lostpointercapture のどれでも、追っている指なら `releaseLever` で `input.axis = 0`。pointerup 後の lostpointercapture は `leverPointer` が null なので何もしない
- `suspend`: `releaseLever` で `input.axis = 0`。そのあと指を離しても、別の指で触り直しても壊れない（`leverPointer` が null に戻るため）
- レバーと FIRE の同時押し: どちらも自分の要素で pointer capture を取り、レバーは `pointerId` で絞っているので互いに影響しない。FIRE の `up` が `pointerId` を見ないのは前からの挙動
- TDZ: `suspend` を呼ぶのは blur / visibilitychange のリスナーだけ（`rg 'suspend\('`）。`startGame` の中に `focus()` / `blur()` / `dispatchEvent` は無く、イベントは同期中の `startGame` に割り込まないので、`let leverPointer` より前に呼ばれる経路は無い
- 操作欄の高さ: `.touch` の高さも `--w` の式も同じ `--touch-h` を使い、下の余白に safe-area を足しているので、中身の高さは `25dvh - 1rem` で揃う
- 台座の大きさ（計算値）: 縦 390x844 で高さ 128px（8rem が効く）、横 667x375 でレバーの内側は約 74px 高・78px 幅に対し台座 66px で収まる
- `.touch > *` にまとめた指定: `flex: 1`、`touch-action: none`、`user-select`、`-webkit-touch-callout` がレバーの div と FIRE の両方に付く。台座は `pointer-events: none`、ヒントの span は親の `touch-action` を引き継ぐ
- `.touch button:active` → `.touch .fire:active`: ボタンは FIRE だけになったので同じ意味
- 左右半分: FIRE の `flex: 1.4` を消して両方 `flex: 1`。仕様どおり
- テスト: 動かない範囲の内側・境目・端・中間・半径の外を押さえていて、式の係数や clamp を壊せば落ちる形になっている
- コメント: `LEVER_DEAD` に「触れただけで流れないように」と理由がある
- 範囲: 指示に無い変更は無い

## 2 回目

対象: 前回の指摘を受けて直した `git diff`（レバーの固定、台座の削除、`min(25dvh, 12rem)`、`bindFire`）。
`npm test` は 16 件すべて通過。寸法は CSS の指定から計算した値で、ブラウザでは測っていない。

要修正: 0 件 / 検討: 1 件 / 好みの範囲: 1 件

### 検討

#### 2-1. 端まで倒すと、つまみが 1/4 ほど欄の外に切れる（実害は未確認）

- 場所: `index.astro` の `.lever`（`overflow: hidden`）と `.lever-knob`（`height: min(4.5rem, 60%)`）、
  `game.ts` の `moveLever`（`radius = r.width * 0.4`）
- 何が問題か: 全速の位置は欄の端から 1 割の所で、つまみの中心がそこまで動く。つまみの半径が
  「欄の幅の 1 割」より大きいと、はみ出した分が `overflow: hidden` で切れる
- 起きる条件（計算値）:

  | 画面 | 欄の幅 | 端から 1 割 | つまみの直径 | 切れる幅 |
  |---|---:|---:|---:|---:|
  | 390x844 縦 | 183px | 18px | 72px | 約 18px |
  | 375x667 縦 | 164px | 16px | 72px | 約 20px |
  | 844x390 横 | 86px | 9px | 約 47px | 約 15px |

  横向きでは、溝の外に置いた ◀ ▶（1rem）も端から 1 割の隙間（約 8px）に収まらず、左の ◀ が
  欄の外に出て切れるはず。見た目の判断なので報告だけ。verifier の画像で確かめられる

### 好みの範囲

#### 2-2. 溝の端と全速の位置が 1.6px ずれる

- 場所: `moveLever` の `r.width * 0.4`（border-box の幅）と `.track` の `left/right: 10%`（padding-box の幅）
- 枠線が左右 2px ずつあるので、溝の半分の長さは `0.4 × (幅 − 4)` = 半径 − 1.6px。
  中心は左右対称なので一致する。目で分かる差ではない

### 判断が要ること（報告だけ）

- 操作欄の高さの上限 12rem（192px）は、スマホでも効く。844px の高さの端末では 25dvh = 211px が
  192px になり、画面の約 23% になる。「約 25%（上限 12rem）」の範囲と読めるが、
  スマホで上限を効かせる意図だったかは利用者の判断

### 問題が無かった点

- 中心: `r.left + r.width / 2` は border-box の中心。枠線は左右同じ太さなので、つまみの `left: 50%`（padding-box）の中心と一致する
- 半径と clamp: `dx` を ±radius に収めてから `leverAxis(dx, radius)` とつまみの `translateX(dx)` の両方に使うので、つまみの位置と倒し量は常に同じ `dx` から決まる。`Math.max(1, …)` で radius は 0 にならない
- 毎回 `getBoundingClientRect` を取るので、触っている間に向きや大きさが変わっても中心と半径が追従する
- 固定にして要らなくなったもの: `leverBase`・`leverX`・`leverRadius`・`.lever-base`・`.hint`・`btn-left`/`btn-right`・`bindHold`・`input[key]` は `src` と `tests` に残っていない（`rg` で確認）
- `.lever.active` は、つまみの強調でまだ使っている
- 台座を無くしたので、前回の指摘 2（幅 0 で半径 1px）は起きない。半径は欄の幅から取る
- `bindFire`: 前の `key === 'fire'` の分岐と同じ処理（`startOrContinue`、`fireQueued`、`input.fire`）。up で `input.fire = false` も同じ
- 前回の「問題が無かった点」は崩れていない: `leverAxis` とテストは変わらず、`mv` の式、1 本の指だけを追う条件、up / cancel / lostpointercapture / `suspend` で `input.axis = 0` に戻ること、FIRE との同時押し、TDZ の経路が無いこと（`suspend(` の呼び出しはリスナーの 2 か所だけ）、`.touch > *` の指定は前回と同じ
- `--touch-h` のコメントに上限を付けた理由がある
- 範囲: 指示に無い変更は無い
