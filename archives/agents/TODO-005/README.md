# TODO-005 の分担

| 担当 | モデル | 見るところ |
|------|--------|-----------|
| main | Opus 5.5 | `game.ts` のレバーの入力と移動、`index.astro` の操作欄、テスト |
| reviewer | Opus 5.5（定義は sonnet） | main の差分。倒し量の式、指を離したときに止まるか、同時押し（2 回） |
| verifier | Sonnet 5 | Playwright と CDP のタッチ操作で、速さ・高さ・同時押し・見た目を実測 |

分担にした理由:

- 変更は 2 ファイルとテストで、main が入力の処理をもう読んでいたので、実装は main が書く
  （規則の目安では implementer に分けてもよい規模。利用者と相談して main のままにした）
- 移動の処理と入力の分岐が変わるので reviewer を入れる。挙動の変更なので Opus にした
- reviewer を先、verifier を後にした。reviewer の指摘で仕様を 2 点決め直したので、
  verifier は決め直した後の差分だけを測った

報告:

- [reviewer-request.md](reviewer-request.md) / [reviewer-report.md](reviewer-report.md)（1 回目と 2 回目）
- [verifier-request.md](verifier-request.md) / [verifier-report.md](verifier-report.md)
- 計測スクリプト: [verify-lever.mjs](verify-lever.mjs)
