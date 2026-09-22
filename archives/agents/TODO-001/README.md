# TODO-001 の分担

| 担当 | モデル | 見るところ |
|------|--------|-----------|
| implementer | Opus 5.5（定義は sonnet） | `src/game/`、`src/pages/index.astro`、`tests/`、`package.json`、README |
| reviewer | Opus 5.5（定義は sonnet） | implementer の差分。ゲームループ・当たり判定・編隊の分岐、テストの強さ |
| verifier | Sonnet 5 | `npm run build` / `npm test`、Playwright での描画と操作の実測 |

分担にした理由:

- ゲームループ、当たり判定、編隊の動きなど込み入ったロジックが中心なので、
  implementer と reviewer は Opus に上書きした
- verifier は手順が決まった実測なので定義のまま Sonnet
- 順番は reviewer を先、verifier を後（指摘で実装が変わると実測が古くなるため）

報告:

- [implementer-request.md](implementer-request.md) / [implementer-report.md](implementer-report.md)
- [reviewer-report.md](reviewer-report.md)
- [verifier-report.md](verifier-report.md)
