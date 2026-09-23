# TODO

**残っている項目: TODO-009。** これまでに 8 件を決着させた。
新しく足すときは「完了済み」の上に節を作る。**番号は `TODO-010` から。**

---

## TODO-009. 型チェックのコマンドを入れる

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | main（実装）+ verifier（Sonnet 5 / medium）。型エラーを直してコードが変わるなら reviewer（Opus 5.5 / high）も入れる |

- [ ] `@astrojs/check` と `typescript` を devDependencies に入れる
- [ ] `package.json` に `"check": "astro check"` を足す
- [ ] `npm run check` を実行し、出た型エラーを直す
- [ ] `CLAUDE.md` の「実行」に `npm run check` を足す

いまは型エラーがどこでも引っかからない。`npm run build`（Vite / esbuild）は
型を消すだけでチェックしない。`typescript` も `node_modules` に入っていない。
`tsconfig.json` は `astro/tsconfigs/strict` を継承しているので、.ts と .astro の
両方を strict で見ることになる。

確認では、`npm run check` が通ることと、わざと型を壊すと落ちることを見る。

**決めること:** 最初の `npm run check` で型エラーが多く出た場合に、この項目で
全部直すか、直す分を別の項目に分けるか。実行して件数を見てから聞く。

LSP（`typescript-lsp` プラグイン）はこの項目では入れない。この項目で
`typescript` がローカルに入ってから、要るかを改めて考える。

---

## 完了済み

決着した項目は `archives/todo/` にある（1 項目 1 ファイル）。
一覧は [archives/index.md](archives/index.md)（新しい順）。やらないと決めたものは
ファイル名に（対応しない）が付いていて、理由も書いてある。蒸し返す前に読むこと。
