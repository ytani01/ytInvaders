# TODO-009 の分担

| 担当 | 範囲 | 理由 |
|------|------|------|
| main | 依存関係の追加、`check` スクリプト、`tsconfig.json`、`CLAUDE.md` | 設定ファイルだけの小さな変更で、実装を分けるほどではない |
| verifier（Sonnet 5 / medium） | `npm run check` が通るか、壊すと落ちるか、`archives/` が対象から外れているか、`npm test` と `npm run build` | 実装と確認を分ける決まりによる。手順が決まった確認なので Sonnet |

reviewer は入れていない。型エラーを直すときにソースコードを変えずに済み
（`@types/node` を足しただけ）、挙動や分岐が変わらなかったため。

- [verifier-report.md](verifier-report.md)
