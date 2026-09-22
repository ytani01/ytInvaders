# TODO-005 reviewer への依頼

仕様は `TODO.md` の TODO-005 の節。差分は `git diff`（`src/game/game.ts`、`src/pages/index.astro`、
`tests/logic.test.ts`）。コードは直さない。

## 見るところ

1. `leverAxis` の式: 動かない範囲の境目で 0 から連続して始まるか、端で ±1 か、半径より外で
   ±1 に留まるか、radius が 0 や負のときに何が起きるか（呼び出し側は `Math.max(1, …)` にしている）
2. 自機の移動: `mv` はキーの左右とレバーの倒し量を足して ±1 に収めている。キーだけのときの挙動が
   前と変わっていないか
3. レバーのポインタ処理: 1 本の指だけを追う条件、指を離したとき・pointercancel・
   lostpointercapture・フォーカスが外れたとき（`suspend`）に必ず倒し量が 0 に戻るか。
   レバーと FIRE を別の指で同時に押したときに互いを邪魔しないか
4. `suspend` から、後で `let` で宣言される変数を使う `releaseLever` を呼んでいる。
   startGame の実行中に呼ばれる経路が無いか（TDZ）
5. `index.astro`: 操作欄の高さ（`25dvh` + safe-area）、台座の大きさ（高さで決め、
   横向きなど低い操作欄でもはみ出さないか）、`.touch > *` にまとめた touch-action などの指定の漏れ
6. `bindHold` は FIRE にしか使わなくなったが、引数の型に `'left' | 'right'` が残っている。
   残してよいかの意見

## 見なくてよいもの

見た目の良し悪し、色。実機での動作の確認（verifier が後で Playwright で測る）。

## 報告

`archives/agents/TODO-005/reviewer-report.md` に、指摘ごとに「場所・何が問題か・起きる条件」を書く。
問題が無かった点は 1 行ずつ。実害を確かめていない指摘は「実害は未確認」と添える。
境界線上の判断は報告だけ。返事は「終わったか・報告ファイルのパス・判断が要る点」の 5 行以内。
