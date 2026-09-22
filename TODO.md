# TODO

**残っている項目: TODO-001。** これまでに 0 件を決着させた。
新しく足すときは「完了済み」の上に節を作る。**番号は `TODO-002` から。**

---

## TODO-001. 最初の版を作る

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | implementer + reviewer + verifier |

- [ ] `src/game/game.ts` — ループ、自機、敵の編隊、弾、シールド、UFO、当たり判定、ウェーブ
- [ ] `src/game/audio.ts` — WebAudio で効果音を合成する（音声ファイルは使わない）
- [ ] `src/pages/index.astro` — Canvas、HUD、タッチ操作のボタン、CSS
- [ ] ハイスコアを localStorage に保存する（読めないときも動く）
- [ ] `tests/` — 当たり判定と編隊の動きを `node --test` で確かめる。`npm test` で走らせる
- [ ] README に遊び方と開発の手順を書く

背景（決まったこと）:

- Astro + Canvas 2D。ゲームエンジンや描画ライブラリは入れない
- 昔のインベーダーと同じにはしない。ドット絵ではなく発光するベクター図形
  （ネオン調の配色、`shadowBlur` のグロー）、撃破時のパーティクル、
  被弾時の画面の揺れ、流れる星空の背景
- 敵は横に動き、端で 1 段下がって向きを変える。数が減るほど速くなる
- 操作: ←→ / A D で移動、Space で射撃、P で一時停止、Enter で開始。
  タッチ操作は画面下の左右ボタンと射撃ボタン
- ゲームパッドは入れない

分担: implementer が実装とテスト、reviewer が差分を見る、そのあと verifier が
`npm run build` と `npm test` を走らせ、Playwright で開いてスクリーンショットを撮り、
描画が欠けていないか・操作で動くかを確かめる。

---

## 完了済み

決着した項目は `archives/todo/` にある（1 項目 1 ファイル）。
一覧は [archives/index.md](archives/index.md)（新しい順）。やらないと決めたものは
ファイル名に（対応しない）が付いていて、理由も書いてある。蒸し返す前に読むこと。
