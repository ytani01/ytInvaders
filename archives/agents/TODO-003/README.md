# TODO-003 の分担

| 担当 | モデル | 見るところ |
|------|--------|-----------|
| main | Opus 5.5 | `src/game/game.ts` の星の描画（1 行） |
| verifier | Sonnet 5 | 星の大きさの実測（fillRect の記録）とスクリーンショット |

分担にした理由:

- 変更は描画の数値 1 か所なので、実装は main が書く
- 分岐は変わらないので reviewer は入れない
- 見た目の変更なので、数値だけでなくスクリーンショットでも確かめさせる

報告:

- [verifier-request.md](verifier-request.md) / [verifier-report.md](verifier-report.md)
- 計測スクリプト: [verify-stars.mjs](verify-stars.mjs)
