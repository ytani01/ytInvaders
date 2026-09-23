# TODO

**残っている項目: TODO-008。** これまでに 7 件を決着させた。
新しく足すときは「完了済み」の上に節を作る。**番号は `TODO-009` から。**

---

## TODO-008. game.ts をファイルに分け、処理を整理する

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | main（設計）+ implementer（Opus 5.5 / medium）+ reviewer（Opus 5.5 / high）+ verifier（Sonnet 5 / medium） |

- [ ] 分け方を決める（main）。案: 純粋な関数と定数（tests から import する）、描画、入力（キー・タッチ）、状態とループ
- [ ] `startGame` の中の `let` の並びを、1 つの状態オブジェクトにまとめる
- [ ] `update()` を自機・編隊・敵の射撃・UFO・弾・終わりの判定などの関数に分ける
- [ ] tests の import 先を直す。今のテストはそのまま通る
- [ ] `npm test` と `npm run build` が通る
- [ ] reviewer: 分けた前後で、状態の読み書きと処理の順番が同じか
- [ ] verifier: `archives/agents/TODO-007/measure.mjs` を使い回し、変更前と変更後を Playwright で比べる

挙動は変えない。`game.ts` は約 840 行で、`startGame` が状態・更新・描画・入力をすべて抱えている。
TODO-007 のあとに、利用者から「コード全体のリファクタリング」を頼まれた。範囲は「ファイル分割 + 処理の整理」に決めた。

---

## 完了済み

決着した項目は `archives/todo/` にある（1 項目 1 ファイル）。
一覧は [archives/index.md](archives/index.md)（新しい順）。やらないと決めたものは
ファイル名に（対応しない）が付いていて、理由も書いてある。蒸し返す前に読むこと。
