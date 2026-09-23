# TODO-006 の分担

- main（Opus 5.5）: 実装。CSS の値だけの変更なので実装の担当は分けなかった
- verifier（Sonnet 5 / medium）: Playwright で 4 つの画面の大きさ（1280x800、1280x600、360x740、320x568）を実測。2 回（1 行版と 2 行版）、同じ担当に続けて頼んだ
- reviewer は入れなかった。見た目の値だけで、分岐や条件式が変わらないため

## 報告

- [verifier-report.md](verifier-report.md) — 1 行版。1.04〜1.42 倍にしかならなかった
- [verifier-report-2.md](verifier-report-2.md) — 2 行版。1.71〜2.28 倍で、4 条件とも収まった
- 計測スクリプト: `measure.mjs`（1 行版）、`measure-2row.mjs`（2 行版）。`measure-2row.mjs` の `totalFits` は操作欄の高さを二重に足していて使えない
