# TODO-006 再確認（ヘッダを 2×2 の 2 行に作り直した変更）

## 検証方法

- `npx astro dev --background` で dev サーバを起動。
- Playwright（`node`、chromium）で同じ 4 条件を計測。スクリプトは
  `archives/agents/TODO-006/measure-2row.mjs`（`measure.mjs` を使い回し、
  2 行判定と左右列の重なり判定を追加）。生の出力は
  `archives/agents/TODO-006/measure-2row-output.json`。
- 各条件で `#hud-score` / `#hud-hi` を `99999`、`#hud-wave` を `10` に
  書き換えた直後に計測（前回と同じ）。
- スクリーンショットは `~/tmp/playwright-mcp/todo006-2row-<条件>.png` に保存し、
  目で確認した。
- 確認後 `npx astro dev stop` で dev サーバを停止（PID 172069 の消滅を確認）。

## 差分（`git diff src/pages/index.astro`）

指示どおりの変更のみ。`.hud` を `display: grid`（2 列）にし、偶数番目の
`span`（HI・LIVES）を `justify-self: end` で右寄せ、`font-size` を
`calc(var(--w) * 0.065)`、`--hud-h` を `calc(var(--w) * 0.169)`、`--w` を
`min(100vw, calc((100dvh - var(--touch-h)) * 0.75 / 1.12675))` にしている。
他のファイルは `TODO.md`（項目管理、指示の範囲内）のみで、コードは
`src/pages/index.astro` だけが変わっている。

## 測定結果

4 条件すべて問題なし。ちょうど 2 行（SCORE・HI が 1 行目、WAVE・LIVES が
2 行目）、左右の列は重ならず（`overlapRow1`/`overlapRow2` とも `false`）、
右の列（HI・LIVES）は `.hud` の右端（padding 内）を超えず
（`rightEdgeOverflow: 0`）、2 行目の下端は `.hud` の下端を超えず
（`row2BottomOverflowsHud: false`）、`.hud` の下端は canvas の上端と
一致していて食い込んでいない（`hudBottomOverflowsIntoCanvas: false`）。
canvas は全条件で 480:640（3:4）、ページの縦横スクロールも出ていない
（`scrollOverflowX`/`scrollOverflowY` とも `false`）。

| 条件 | フォントサイズ(px) | 前回報告と同じ式での変更前との比 | 2行か | 左右列の重なり | 右端はみ出し(px) | canvas 3:4 | ページのスクロール |
|---|---|---|---|---|---|---|---|
| 1280x800 マウス | 34.61 | 2.28 | true | 無し | 0 | 480:640 ✓ | 無し |
| 1280x600 マウス | 25.96 | 1.71 | true | 無し | 0 | 480:640 ✓ | 無し |
| 360x740 タッチ/モバイル | 23.40 | 2.25 | true | 無し | 0 | 480:640 ✓ | 無し |
| 320x568 タッチ/モバイル | 18.43 | 1.77 | true | 無し | 0 | 480:640 ✓ | 無し |

「前回報告と同じ式での変更前との比」は、前回報告（TODO-006 の 1 回目の
検証）で使った推定式（変更前 `clamp(0.65rem, 2.8vw, 0.95rem)`、1rem=16px
前提）に対する比。2 行化と同時に文字も一段と大きくなっている。

### `.hud` + canvas + 操作欄が画面の高さに収まるか

`scrollOverflowY: false` により、ページ全体としては縦スクロールが出て
いないことを確認した。合わせて用意した `totalFits`（`.game` の高さ＋
操作欄の高さ ≦ 画面の高さ）という指標は、360x740 と 320x568 で `false`
になったが、これは測定スクリプト側の不具合。`.game` は `height: 100dvh`
で画面いっぱいに広がる要素であり、その `getBoundingClientRect().height`
は常に画面の高さと等しくなる（操作欄はその `.game` の子要素なので、
すでに含まれている）。それに操作欄の高さを二重に足してしまっていたため、
実際には収まっているのに収まっていないという誤った値になった。
`scrollOverflowY: false` と、後述のスクリーンショット目視（操作欄が
画面内に完全に収まって見えている）の両方から、実際には画面の高さに
収まっていると判断した。

## スクリーンショットの目視確認

4 条件すべてで、ヘッダの文字（SCORE / HI / WAVE / LIVES とその数値）が
2 行できれいに分かれ、欠けておらず、重なっておらず、余計なものも
映っていない。1280x800・1280x600 はマウス向けでヘッダが画面上部に
1 行目 SCORE・HI、2 行目 WAVE・LIVES で収まっている。360x740・320x568
はスマホ向けで、ヘッダの下にレバー型の操作欄と FIRE ボタンが画面内に
完全に収まって表示されている。デザインの良し悪し（配色・余白の美観など）
は評価していない。

## 判断が要る点・確認できなかったこと

- 前回報告と同様、「変更前との比」は `1rem = 16px` 前提の推定値であり
  実測ではない。
- 指示の 4 条件以外の画面サイズ・実機のブラウザでの確認はしていない。
- `measure-2row.mjs` の `totalFits` 指標は上記のとおり二重カウントの
  不具合があり、参考値としても使えないと判断した（`scrollOverflowY` と
  目視で代替した）。修正するかどうかは判断していない。
- ゲームの挙動・音・操作欄の中身・`tests/` の実行は今回も対象外。
