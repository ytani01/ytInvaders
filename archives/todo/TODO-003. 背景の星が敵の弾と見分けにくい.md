# TODO-003. 背景の星が敵の弾と見分けにくい

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | main（実装）+ verifier（Sonnet 5 / medium） |
| 実施 | Opus 5.5 / effort high | main（実装）+ verifier（Sonnet 5 / medium） |

| 担当 | モデル | effort | output | cache_creation | 料金の割合 |
|------|--------|--------|--------|----------------|-----------|
| main | Opus 5.5 | high | 12,577 | 36,365 | 77% |
| verifier | Sonnet 5 | medium | 6,267 | 53,793 | 23% |
| 合計 |  |  | 18,844 | 90,158 | 概算 $2.1 |

- 立ててから着手まで空いたので、着手した時刻から `--since` で数えた
- main の effort は `~/.claude/settings.json` の `claude-opus-5-5` の値
- main の分には、TODO-005 のコードを読んだ分と、todo-workflow skill の見込みの行の
  書き方（担当のモデルと effort を書く）を直した分も入っている

## きっかけ

手前の星が幅 2.4px × 高さ 6px の縦長で、水色・ほぼ不透明のまま下へ流れるので、
敵の弾と見間違える。

## やったこと

`src/game/game.ts` の星の描画を、一辺 `0.5 + z * 0.5`（奥 1px〜手前 2px）の正方形にした。
色・透明度・数・流れる速さは変えていないので、手前ほど明るく速いのはそのまま。

## 確かめたこと

verifier が `npm run preview` で、1280x800 と 390x844（hasTouch）の 2 通りを測った
（[archives/agents/TODO-003/verifier-report.md](../agents/TODO-003/verifier-report.md)）。

- fillRect を記録して、星はすべて w === h、w は 1.01〜2.00
- タイトルとプレイ画面のスクリーンショットと 4 倍の切り抜きで、縦長の星が残っていないこと、
  欠けや余計な描画が無いことを見た。main も切り抜きを 1 枚見て、点になっていることを確かめた
- `npm test` は 14 件 pass

## 分担の振り返り

- verifier: 星の大きさを数値と画像の両方で確かめた。不具合は見つからなかった。
  報告に「星は 360 個で、game.ts 側の個数そのもの」とあるが、game.ts が作る星は 90 個で、
  記録したのは 4 フレーム分と見られる。大きさの判定には響かない
- 見込みどおりの分担だった
- 次に描画の数値だけを変える項目なら、Playwright を入れる手間（今回は `/tmp` に
  入れて一時的にリンクした）が verifier の大半を占めるので、依頼に Playwright の置き場所を
  書いておく。数値の記録は fillRect のラップで足り、画像は切り抜き 1 枚で足りた
