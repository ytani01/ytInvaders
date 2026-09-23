# TODO-008 reviewer への依頼

## 目的

`src/game/game.ts` を 5 ファイル（`logic.ts` / `state.ts` / `render.ts` / `input.ts` /
`game.ts`）に分けた未コミットの差分が、**挙動を変えていないか**を見る。
設計と依頼は `archives/agents/TODO-008/implementer-request.md`、実装の報告は
`implementer-report.md` にある。変更前は `git show HEAD:src/game/game.ts`。

## 見ること

1. `update()`: 変更前の 341〜484 行と、各処理の呼ぶ順番、途中の `return` の位置、
   状態を読み書きする順番が同じか。特に
   - `alive` を出す時点と、敵の射撃でそれを使う時点
   - 敵の弾で `hitPlayer` したあとに戻る条件
   - 編隊の外枠の判定（シールド削り → 自機の高さ → 全滅）の順と `return`
   - 配列を作り直す（`filter`）か、その場で書き換える（`splice`・`e.alive = false`）か
2. `Math.random()` を呼ぶ順番と回数（update → render の順も含む）
3. 状態オブジェクトに移したとき、読み落とし・書き落とし（ローカル変数に写して
   書き戻していない、など）が無いか。`newGame` / `newWave` が初期化する項目が同じか
4. 入力: キー・FIRE・レバー・Canvas のタップ・blur・visibilitychange の分岐と、
   その中の処理の順番が同じか。`fireQueued` の読み書き
5. 描画: `render` が読む状態と、描く順番・色・座標が同じか
6. モジュールの読み込み時に `window` / `document` に触っていないか
7. tests の import 先、`index.astro` のコメント、`README.md` の説明が新しいファイルと合っているか

## 見なくてよいもの

- 画面での実測（verifier がやる）
- 関数名・ファイルの分け方そのものの良し悪し（main が決めた）
- 変更前からあった挙動の問題（見つけたら「検討」に 1 行だけ）

## 報告

`archives/agents/TODO-008/reviewer-report.md` に、「要修正」と「検討」に分けて書く。
変更前と同じだったものは項目ごとに 1 行、食い違いだけ詳しく（ファイル:行、変更前の該当行）。
コードは直さない。原因の切り分けや、境界線上の判断はせず、「実害は未確認」と添えて報告だけする。
返事は「終わったか・報告ファイルのパス・判断が要る点」の 5 行以内。
