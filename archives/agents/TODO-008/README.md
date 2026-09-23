# TODO-008 の分担

| 担当 | モデル | やること |
|------|--------|----------|
| main | Opus 5.5 | 分け方の設計 |
| implementer | Opus 5.5（定義は sonnet） | ファイル分割、状態オブジェクト、`update()` の分割 |
| reviewer | Opus 5.5（定義は sonnet） | 分けた前後で、状態の読み書きと処理の順番が同じか |
| verifier | Sonnet 5 | テストとビルド、TODO-007 の `measure.mjs` で前後を比べる |

- 829 行を 5 ファイルへ分け、状態の持ち方も変わるので、実装を分けた。
  状態の読み書きの順番を保つ込み入った作業なので、implementer は定義の sonnet から Opus に上書きした
- 処理の順番や途中の `return` の位置が変わりうるので reviewer を入れた。
  コードレビューは Opus を充てる規約なので、定義の sonnet から上書きした
- reviewer を先、verifier を後に回す

## 依頼と報告

- [implementer-request.md](implementer-request.md) / [implementer-report.md](implementer-report.md)
- [reviewer-request.md](reviewer-request.md) / [reviewer-report.md](reviewer-report.md)
- [verifier-request.md](verifier-request.md) / [verifier-report.md](verifier-report.md)

## 残したスクリプト

- `harness.mjs` / `h2.mjs` / `stub-audio.ts`: reviewer が変更前後を node で同じ入力を与えて動かし、
  描画・効果音・HUD の記録と `Math.random` の回数を突き合わせたもの。作業時は scratchpad に
  変更前（`old/`）と変更後（`new/`）の `src/game` を写して使った
- reviewer の指摘（検討 2）を受け、main が `state.ts` の `suspend(s)` を `pause(s)` に改名した
  （`input.ts` の内側の `suspend()` と名前が重なるため）。implementer の報告にある
  「`state.ts` と `input.ts` が互いに import している」は誤り（reviewer の検討 1）
