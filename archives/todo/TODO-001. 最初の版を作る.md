# TODO-001. 最初の版を作る

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | implementer（Opus）+ reviewer（Opus）+ verifier（Sonnet） |
| 実施 | Opus 5.5 / effort 不明 | implementer（2 回）+ reviewer（2 回）+ verifier（2 回） |

| 担当 | モデル | effort | output | cache_creation | 料金の割合 |
|------|--------|--------|--------|----------------|-----------|
| main | Opus 5.5 | 不明 | 16,470 | 96,235 | 35% |
| implementer | Opus 5.5 | medium | 19,210 | 82,988 | 31% |
| verifier | Sonnet 5 | medium | 5,228 | 248,028 | 18% |
| reviewer | Opus 5.5 | high | 5,090 | 79,958 | 16% |
| 合計 |  |  | 45,998 | 507,209 | 概算 $6.9 |

- implementer と reviewer は定義のモデルが sonnet。ゲームループや当たり判定など込み入ったロジックが中心なので、呼び出し時に Opus 5.5 に上書きした
- effort は `~/.claude/agents/*.md` の当時の値（implementer medium、reviewer high、verifier medium）
- main の effort は利用者の設定で、main からは確かめられない
- 集計は `token-usage.py TODO-001`（立てたコミットから決着のコミットの直前まで）

## きっかけ

最初の版として、インベーダー風のシューティングを Astro の 1 ページに Canvas 2D で作る。
昔のインベーダーの再現ではなく、ネオン調のモダンなデザインにする。

決まっていたこと:

- ゲームエンジンや描画ライブラリは入れない
- ドット絵ではなく発光するベクター図形（`shadowBlur` のグロー）、撃破時のパーティクル、
  被弾時の画面の揺れ、流れる星空の背景
- 敵は横に動き、端で 1 段下がって向きを変える。数が減るほど速くなる
- 操作: ←→ / A D で移動、Space で射撃、P で一時停止、Enter で開始。
  タッチは画面下の左右ボタンと射撃ボタン。ゲームパッドは入れない

## やったこと

- `src/game/game.ts` — ループ（rAF の dt を 0.25 秒で頭打ちにし、1/120 秒の固定ステップ）、
  自機、敵の編隊、弾、シールド、UFO、当たり判定、ウェーブ、描画。当たり判定と編隊の
  更新は DOM に触らない関数にして、テストから import できるようにした
- `src/game/audio.ts` — WebAudio で効果音を合成する。AudioContext はキー・タッチの後に
  作る／resume する（`pointerdown` と `pointerup` の両方）。使えなくても落ちない
- `src/pages/index.astro` — Canvas（論理解像度 480x640 を拡大縮小）、HUD、タッチの
  ボタン（`any-pointer: coarse` で出す。下に `env(safe-area-inset-bottom)` の余白）、CSS
- ハイスコアは localStorage。読み書きを try/catch で囲み、使えないときは 0 として動く
- `tests/logic.test.ts` — 当たり判定の境界、`enemyRect`、`formationBounds`、
  編隊の横移動・端での段下げと反転・端にちょうど接したとき・数が減ると速くなる（14 件）。
  `package.json` に `"test": "node --test tests/"` を足した
- `package.json` の `engines` を `>=22.18.0` にした（`.ts` の型を落とす機能が既定で
  効くのが 22.18 から）
- README に遊び方と開発の手順を書いた

依頼に無かったが足したもの:

- フォーカスが外れたとき・タブが隠れたときの自動の一時停止（残すと決めた）
- 一時停止中は P のほか Enter・FIRE・画面のタップでも再開する。FIRE で再開すると
  同時に 1 発撃つが、許容した
- ゲームオーバーから 1 秒はやり直しを受け付けない（連打で GAME OVER を見ずに始まるのを防ぐ）
- ウェーブごとにシールドを作り直す

## 確かめたこと

- `npm test` 14 件 pass、`npm run build` 成功（どちらも終了コード 0）。`tsc --noEmit` も通る
- テストの強さ: 当たり判定・`enemyRect`・`formationBounds`・`DROP`・端の判定を
  1 か所ずつ壊し、どれもテストが落ちることを reviewer が確かめた
- localStorage の getter や getItem/setItem が投げる・値が壊れている、AudioContext が
  無い・投げる、のどれでも落ちないことを reviewer が node で確かめた
- Playwright（デスクトップ 1280x800、スマホ 390x844 の hasTouch）で、console error と
  pageerror が 0、描画に欠けが無い、←→ とタッチのボタンで自機が動く、Space で弾が出る、
  P で止まって戻る、blur で自動の一時停止に入り FIRE で戻る、横スクロールが出ない、
  localStorage が使えなくても動く、を verifier が確かめた。スクリプトは
  `archives/agents/TODO-001/verify.mjs`

## 残ること

- Node 22.18〜22.x で `npm test` が走るかは試していない（手元は Node 26.10 だけ）
- 被弾後の無敵の点滅中に一時停止すると、自機が消えたコマで止まることがある。
  点滅の仕様どおりなので直していない

## 分担の振り返り

- **implementer** は 1 回目で仕様をひととおり満たした。自動の一時停止と、engines の
  下限が足りないことを自分から報告した
- **reviewer** は直すべき 0 件・直すとよい 3 件・参考 5 件。一番効いたのは、コピーを
  壊してテストの穴（`enemyRect` と `formationBounds` の y が試されていない）を表にしたこと。
  README と一時停止の文言の食い違い、タッチでの最初の音も拾った。2 回目は指摘 0 件
- **verifier** は描画・操作・エラー 0 を実測で確かめた。← の移動量が小さいという
  食い違いを報告し、測り直しで被弾による測り違いと分かった。saveHigh の経路は
  通せなかった（reviewer の node での確認で足りた）
- 見込みとの食い違い: 担当の組み方は見込みどおり。reviewer の指摘で implementer と
  reviewer がもう 1 回ずつ、verifier の食い違いで測り直しが 1 回増えた。
  verifier の cache_creation が大きい（248k）のは、スクリーンショットを何枚も読んだのと、
  測り直しに約 28 分かかったため
- 次に同じ規模をやるなら: implementer への依頼に「壊すと落ちること」を確かめる対象を
  名指しで書く（今回は「端の判定」を例に挙げただけで、`enemyRect` などが漏れ、
  2 回目の往復になった）。verifier への依頼では、操作の測定を「被弾しない条件で」
  （開始直後に測る）と最初から指定し、測り直しを省く
