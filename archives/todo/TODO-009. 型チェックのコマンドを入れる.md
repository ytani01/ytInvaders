# TODO-009. 型チェックのコマンドを入れる

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | main（実装）+ verifier（Sonnet 5 / medium）。型エラーを直してコードが変わるなら reviewer（Opus 5.5 / high）も入れる |
| 実施 | Opus 5.5 / effort high | main（実装）+ verifier（Sonnet 5 / medium） |

| 担当 | モデル | effort | output | cache_creation | 料金の割合 |
|------|--------|--------|--------|----------------|-----------|
| main | Opus 5.5 | high | 3,508 | 10,222 | 66% |
| verifier | Sonnet 5 | medium | 1,890 | 31,270 | 34% |
| 合計 |  |  | 5,398 | 41,492 | 概算 $0.6 |

- reviewer は入れていない。ソースコードを変えずに型エラーが消えたため（見込みで付けた条件に当たらなかった）
- 集計の終点は決着のコミットの直前（現在時刻）

## きっかけ

TypeScript の LSP を入れるかという相談から。調べると、型エラーがどこでも
引っかからない状態だった。`npm run build`（Vite / esbuild）は型を消すだけで
チェックしない。`typescript` も `node_modules` に入っていなかった。LSP より先に、
確認の手順に組み込める型チェックのコマンドを入れることにした。

## やったこと

- `@astrojs/check`、`typescript`、`@types/node` を devDependencies に入れた
- `package.json` の scripts に `"check": "astro check"` を足した
- `tsconfig.json` の `exclude` に `archives` を足した。`include` が `**/*` なので、
  `archives/agents/` の検証用スクリプトまで検査の対象に入っていた
  （未使用変数の hint が 13 件出ていた）
- `CLAUDE.md` の「実行」に `npm run check` を足した

最初の `npm run check` で出た型エラーは 2 件だけだった。どちらも
`tests/logic.test.ts` の `node:test` と `node:assert/strict` に型定義が無い
というもので、`@types/node` を入れて消えた。ソースコードは変えていない。
件数が少なかったので、「全部直すか、別の項目に分けるか」は利用者に聞かず、
この項目で直した。

LSP（`typescript-lsp` プラグイン）は入れていない。`typescript` がローカルに
入ったので、要るようになったら mise で node のバージョンを決め、プラグインを
有効にすれば使える。

## 確かめたこと

verifier の報告は [archives/agents/TODO-009/verifier-report.md](../agents/TODO-009/verifier-report.md)。

- `npm run check` が終了コード 0、10 ファイルで 0 errors / 0 warnings / 0 hints
- 型の合わない代入を足すと、終了コード 1 で落ちる。`src/game/logic.ts`、
  `src/pages/index.astro` の `<script>`、`tests/logic.test.ts` の 3 か所で確かめた。
  `index.astro` には frontmatter が無いので、frontmatter 側は試していない
- `archives/` の下に型エラーを足しても 0 errors のまま（対象から外れている）
- `npm test` と `npm run build` が通る

## 分担の振り返り

- **verifier が見つけたこと:** 食い違いは無かった。`index.astro` に frontmatter が
  無く、依頼に書いた確かめ方のうち 1 つが試せないことを報告した。これは依頼を
  書く前にファイルを見ていれば避けられた
- **見込みとの食い違い:** reviewer を入れなかった点だけ。見込みで「コードが
  変わるなら」と条件を付けておいたので、着手してから迷わずに済んだ
- **次に同じ規模の項目をやるなら:** 同じく main（実装）+ verifier（Sonnet 5）
  で組む。依頼文の確認対象は、実際のファイルの形（frontmatter の有無など）を
  見てから書く
