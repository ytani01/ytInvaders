# TODO

**残っている項目: TODO-007。** これまでに 6 件を決着させた。
新しく足すときは「完了済み」の上に節を作る。**番号は `TODO-008` から。**

---

## TODO-007. 要らない分岐や重複した記述を削る

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | main（実装）+ reviewer（Opus 5.5 / high）+ verifier（Sonnet 5 / medium） |

- [ ] `game.ts`: `keydown` と `keyup` の switch を、キーから `input` の項目を引く表 1 つにまとめる
      （switch に残すのは Space の `fireQueued`、P、Enter だけ）
- [ ] `game.ts`: `setPointerCapture` を囲む try/catch を外す（2 か所）
- [ ] `game.ts`: 呼び出しが 1 か所だけの `bindFire` を展開する
- [ ] `game.ts`: `stepFormation` の `width` と `margin` の引数を外し、テストを `W` と `MARGIN`（480、12）に合わせる
- [ ] `index.astro`: 中身の無い frontmatter を消す
- [ ] `index.astro`: `.touch button` と `.touch .fire` を 1 つのルールにする（button は FIRE だけ）
- [ ] `index.astro`: `.game` の `align-items: stretch`（flex のデフォルト）を消す
- [ ] `index.astro`: `--hud-h` を消し、`.hud` の高さを `2.6em` にする
- [ ] `audio.ts`: `webkitAudioContext` への切り替えを外す
- [ ] `tests/logic.test.ts`: 「下がる量は DROP で、0 ではない」の test を消し、`assert.ok(DROP > 0)` を右端の test へ移す
- [ ] `npm test` と `npm run build` が通る
- [ ] reviewer: キー入力、FIRE、レバーの挙動が前と同じか
- [ ] verifier: キー（←→ A D Space P Enter）、タッチの FIRE とレバー、ヘッダと操作欄の見た目を Playwright で前と比べる

ponytail-review（2026-09-23）で見つけたもの。見込みは約 -50 行。
挙動は変えない。

`index.astro` の `$` ヘルパー（要素が無いと throw）は今のまま残す。
`getElementById(id)!` の 1 行にすると、id を書き間違えたときに原因を探しにくくなるため（利用者と決めた）。

---

## 完了済み

決着した項目は `archives/todo/` にある（1 項目 1 ファイル）。
一覧は [archives/index.md](archives/index.md)（新しい順）。やらないと決めたものは
ファイル名に（対応しない）が付いていて、理由も書いてある。蒸し返す前に読むこと。
