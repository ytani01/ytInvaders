# ytInvaders

インベーダー風のシューティングゲーム。Astro の 1 ページに Canvas 2D で描く。
ネオン調のベクター図形で、効果音は WebAudio で合成する。

https://ytani01.github.io/ytInvaders/ で遊べる。

## 遊び方

| 操作 | キーボード | タッチ |
|------|-----------|--------|
| 開始・やり直し | Enter | FIRE ボタンか画面をタップ |
| 移動 | ← → / A D | 画面下の ◀ ▶ ボタン |
| 射撃 | Space | FIRE ボタン |
| 一時停止 | P | （なし） |
| 一時停止からの再開 | P か Enter | FIRE ボタンか画面をタップ |

- 敵は横に動き、端で 1 段下がって向きを変える。数が減るほど速くなる
- 敵が自機の高さまで降りてくるか、残機が無くなると終わり
- 上を横切る UFO を撃つとボーナス
- ハイスコアはブラウザ（localStorage）に残る
- ゲームオーバーの後、1 秒ほどはやり直しを受け付けない（連打で GAME OVER を見逃さないため）
- ウィンドウからフォーカスが外れると、自動で一時停止する
- ウェーブが変わるとシールドが元に戻る
- タッチ操作のボタンは、タッチできる端末（`any-pointer: coarse`）でだけ出る

## 開発

```sh
npm install
npm run dev      # http://localhost:4321/ytInvaders/
npm run build    # dist/ に出力
npm test         # 当たり判定と編隊の動きのテスト（node --test）
```

master に push すると、GitHub Actions（`.github/workflows/deploy.yml`）がビルドして
GitHub Pages に公開する。

テストは Node の型を落とす機能で `.ts` を直接走らせる（Node 22.18 以降）。
ソースは `src/game/game.ts`（ゲーム本体）、`src/game/audio.ts`（効果音）、
`src/pages/index.astro`（画面と HUD）。
