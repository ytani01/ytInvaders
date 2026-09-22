# TODO-004 の分担

| 担当 | モデル | 見るところ |
|------|--------|-----------|
| main | Opus 5.5 | `astro.config.mjs`、`index.astro` の favicon、`.github/workflows/deploy.yml`、README と CLAUDE.md、`gh api` での Pages の有効化 |
| verifier | Sonnet 5 | README の手順の再現（dev・build・preview）と、`/ytInvaders/` の下で 404 が出ないかの実測。push のあと公開先でも同じことを測る |

分担にした理由:

- 設定ファイルとワークフローを足すだけで分岐は変わらないので、実装は main、reviewer は入れない
- README の手順は書いたとおりに試せるので、その再現は verifier に分ける
- TODO-002 の verifier は文脈が長くなったので、立て直した（計測の中身も違う）

報告: [verifier-request.md](verifier-request.md) / [verifier-report.md](verifier-report.md)
