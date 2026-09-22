# TODO-002 の分担

| 担当 | モデル | 見るところ |
|------|--------|-----------|
| main | Opus 5.5 | `src/game/game.ts` の射撃の入力と条件の実装 |
| reviewer | Opus 5.5（定義は sonnet） | main の差分。射撃の条件式、押下を捨てる箇所の漏れ |
| verifier | Sonnet 5 | 直す前の再現と直した後の確認（Playwright） |

分担にした理由:

- 変更は `game.ts` の数か所なので、実装の担当は分けず main が書く
- 射撃の条件式が変わるので reviewer を入れる。込み入ってはいないが、TODO-001 と同じく Opus にした
- verifier は TODO-001 の計測（`archives/agents/TODO-001/verify.mjs`）を作った担当に続けて頼む
- 原因の見立て（1 フレームより短い押下が消える）は、直す前に verifier に実測させる

報告:

- [verifier-request.md](verifier-request.md) / [verifier-report.md](verifier-report.md)
- [reviewer-report.md](reviewer-report.md)
