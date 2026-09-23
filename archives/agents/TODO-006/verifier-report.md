# TODO-006 verifier report

## 検証方法

- `npx astro dev --background` で dev サーバを起動（AGENTS.md の手順どおり）。
- Playwright（`node`、chromium）で 4 条件を計測。スクリプトは
  `archives/agents/TODO-006/measure.mjs`。生の出力は
  `archives/agents/TODO-006/measure-output.json`。
- 各条件で `#hud-score` / `#hud-hi` を `99999`、`#hud-wave` を `10` に
  書き換えた直後に計測。
- スクリーンショットは `~/tmp/playwright-mcp/todo006-<条件>.png` に保存し、
  目で確認した。
- Playwright は本プロジェクトの依存関係に無かったため、
  `npm install --no-save --no-audit --no-fund playwright` で一時的に
  導入した。`package.json` / `package-lock.json` は変更していない
  （`git status --short` で確認済み、`node_modules/` は `.gitignore` 対象）。
- 確認後、`npx astro dev stop` で dev サーバを停止した（PID 163717 の消滅を確認）。

## 差分（`git diff src/pages/index.astro`）

指示どおりの2点のみ変更されている。

- `--hud-h`: `2rem` → `2.8rem`
- `.hud` の `font-size`: `clamp(0.65rem, 2.8vw, 0.95rem)` →
  `min(1.9rem, calc(var(--w) * 0.038))`（コメント追加あり）

他のファイルは変更されていない（`git status` で `src/pages/index.astro` のみ）。

## 測定結果

いずれの条件も、1 行に収まり（`oneLine: true`）、右端の span が
`.hud` の右端（padding 内）を超えず（`rightEdgeOverflow: 0`）、
ページ全体の縦横スクロールも出ていない（`scrollOverflowX`/`scrollOverflowY`
とも `false`）。canvas の縦横比は全条件で `480:640 = 0.75`（3:4）。
問題なし。

| 条件 | フォントサイズ(px) | 旧式との比 | 1行 | 右端はみ出し(px) | HUD幅(clientWidth/scrollWidth) | canvas 3:4 | ページのスクロール |
|---|---|---|---|---|---|---|---|
| 1280x800 マウス | 21.52 | 1.42 | true | 0 | 566/566 | 480:640 ✓ | 無し |
| 1280x600 マウス | 15.82 | 1.04 | true | 0 | 416/416 | 480:640 ✓ | 無し |
| 360x740 タッチ/モバイル | 13.68 | 1.32 | true | 0 | 360/360 | 480:640 ✓ | 無し |
| 320x568 タッチ/モバイル | 10.86 | 1.04 | true | 0 | 286/286 | 480:640 ✓ | 無し |

- 旧式との比（`fontRatio`）は「変更前の `clamp(0.65rem, 2.8vw, 0.95rem)` の
  px 値（1rem=16px 前提の推定値）」に対する新しいフォントサイズの比。
  全条件で 1.0〜1.42 倍に大きくなっており、指示どおり「大きくする」変更の
  効果が出ている。
- `hudClientWidth === hudScrollWidth` なので、HUD 自体は横方向にはみ出して
  いない。

## スクリーンショットの目視確認

4 条件すべてで、ヘッダの文字（SCORE / HI / WAVE / LIVES とその数値）が
欠けておらず、重なっておらず、余計なものも映っていない。
- 1280x800: ヘッダが 1 行で収まり、右端の `LIVES 3` の直後にわずかな余白あり。
- 1280x600: 同様に 1 行で収まる。
- 360x740（スマホ、操作欄あり）: レバー型の操作欄が正しく表示され、
  ヘッダも 1 行で収まる。
- 320x568（最小のスマホ想定）: 同上、文字がやや小さくなるが欠けや重なりは無い。

デザインの良し悪し（配色・余白の美観など）は評価していない。

## 判断が要る点・確認できなかったこと

- `fontRatio` の「旧式の px 値」は `1rem = 16px` という一般的な既定値を
  前提にした推定値。実ブラウザの既定フォントサイズがそれと異なる環境
  （利用者がブラウザ側でフォントサイズ設定を変えている場合など）では
  この比は変わる。ただし新しい式は `rem` ではなく `--w`（HUD の実際の
  幅）を基準にしているため、そうした環境依存の影響は変更前より小さい
  と考えられる（推定であり実測はしていない）。
- 指示された 4 条件（1280x800, 1280x600, 360x740, 320x568）以外の
  画面サイズ・実機のブラウザでの確認はしていない。
- ゲームの挙動・音・操作欄の中身・`tests/` の実行は指示により対象外とした。
