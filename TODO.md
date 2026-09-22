# TODO

**残っている項目: TODO-002、TODO-003、TODO-004。** これまでに 1 件を決着させた。
新しく足すときは「完了済み」の上に節を作る。**番号は `TODO-005` から。**

---

## TODO-002. Space を押しても弾が出ないことがある

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | main（実装）+ reviewer + verifier |

- [ ] 押したことを覚えておき、撃てるようになった時点で 1 発出す（キーとタッチの FIRE の両方）
- [ ] 一時停止・ゲームの開始・フォーカスが外れたときに、覚えていた押下を捨てる
- [ ] 直す前に、すぐ離したとき弾が出ないことを Playwright で再現する
- [ ] 直した後に、すぐ離したとき・撃てない間に押したときに弾が出ることを確かめる

背景（決まったこと）:

- 原因は 2 つ。Space は押している間だけ `input.fire` が true になる作りで、押して
  離すまでが 1 フレームより短いと、ゲームの更新が見る前に false に戻る
  （`src/game/game.ts` の keydown / keyup と `update()` の射撃）。もう 1 つは、撃ってから
  0.35 秒（`FIRE_COOLDOWN`）と自機の弾 2 発の上限の間に押しても何も残らないこと
- 撃てない間の押下は捨てずに覚えておく（利用者が決めた）。間隔と上限は変えない
- 押しっぱなしで撃ち続ける今の挙動は保つ

分担: 変更は `game.ts` の数か所なので実装は main。射撃の条件式が変わるので
reviewer（Opus）を入れる。verifier（Sonnet）は直す前の再現と直した後の確認を
TODO-001 の `archives/agents/TODO-001/verify.mjs` を元に Playwright で測る。

---

## TODO-003. 背景の星が敵の弾と見分けにくい

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | main（実装）+ verifier |

- [ ] 星を縦長の長方形から正方形の点にし、奥は 1px、手前でも 2px にする
- [ ] 手前ほど明るく速い、は保つ

背景（決まったこと）:

- 手前の星は幅 2.4px × 高さ 6px の縦長で、水色・ほぼ不透明のまま下へ流れるので、
  敵の弾と見間違える（`src/game/game.ts` の星の描画）
- 大きさは最大 2px の点にする（利用者が決めた）。色と数、流れる速さは変えない

分担: 描画の数値だけの変更なので実装は main。分岐は変わらないので reviewer は入れない。
verifier（Sonnet）が Playwright のスクリーンショットで、星の大きさと、描画に欠けが無いかを見る。

---

## TODO-004. GitHub Pages で遊べるようにする

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | main（実装）+ verifier |

- [ ] `astro.config.mjs` に `site: 'https://ytani01.github.io'` と `base: '/ytInvaders'` を足す
- [ ] `index.astro` のルート始まりのパス（favicon など）に `import.meta.env.BASE_URL` を付ける
- [ ] `.github/workflows/deploy.yml` を置く（`withastro/action` でビルドし、Pages に公開する）
- [ ] `gh api` で repo の Pages を有効にする（Source は GitHub Actions）
- [ ] README と `CLAUDE.md` の dev の URL を `http://localhost:4321/ytInvaders/` に直し、公開先の URL を README に書く
- [ ] 利用者が push したあと、公開された URL で遊べることを確かめる

背景（決まったこと）:

- 公開先は `https://ytani01.github.io/ytInvaders/`（repo は public）
- `base` は手元の dev と preview にも常に効かせる（利用者が決めた）。パスの間違いに手元で気付けるように
- Pages の有効化は Claude が `gh api` でやる（利用者が決めた）。push は利用者がやる

分担: 設定ファイルとワークフローを足すだけで、分岐は変わらないので実装は main、
reviewer は入れない。verifier（Sonnet）が README の手順どおりに dev・build・preview を
試し、`/ytInvaders/` の下で JS・CSS・favicon が 404 にならないかを Playwright で測る。
push のあと、公開された URL でも同じことを測る。

---

## 完了済み

決着した項目は `archives/todo/` にある（1 項目 1 ファイル）。
一覧は [archives/index.md](archives/index.md)（新しい順）。やらないと決めたものは
ファイル名に（対応しない）が付いていて、理由も書いてある。蒸し返す前に読むこと。
