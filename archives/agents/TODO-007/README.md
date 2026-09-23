# TODO-007 の分担

| 担当 | モデル | やること |
|------|--------|----------|
| main | Opus 5.5 | 実装 |
| reviewer | Opus 5.5（定義は sonnet） | キー入力・FIRE・レバーの分岐が前と同じか |
| verifier | Sonnet 5 | テストとビルド、Playwright で前後を比べる |

- キー入力の switch を表に書き換えて分岐の形が変わるので、reviewer を入れた。
  コードレビューは Opus を充てる規約なので、定義の sonnet から上書きした
- reviewer を先、verifier を後に回す

## 報告

- [reviewer-report.md](reviewer-report.md)
- [verifier-report.md](verifier-report.md)
