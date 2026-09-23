# TODO-008. game.ts をファイルに分け、処理を整理する

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | main（設計）+ implementer（Opus 5.5 / medium）+ reviewer（Opus 5.5 / high）+ verifier（Sonnet 5 / medium） |
| 実施 | Opus 5.5 / effort high | main（設計）+ implementer（Opus 5.5 / medium）+ reviewer（Opus 5.5 / high）+ verifier（Sonnet 5 / medium） |

| 担当 | モデル | effort | output | cache_creation | 料金の割合 |
|------|--------|--------|--------|----------------|-----------|
| main | Opus 5.5 | high | 14,961 | 94,822 | 43% |
| implementer | Opus 5.5 | medium | 11,722 | 58,018 | 21% |
| reviewer | Opus 5.5 | high | 4,439 | 77,280 | 25% |
| verifier | Sonnet 5 | medium | 3,511 | 66,386 | 10% |
| 合計 |  |  | 34,633 | 296,506 | 概算 $5.2 |

- main の effort は `~/.claude/settings.json` の `claude-opus-5-5` の値
- implementer は定義のモデルが sonnet。状態の読み書きの順番を保つ込み入った作業なので Opus 5.5 に上書きした
- reviewer は定義のモデルが sonnet。コードレビューには Opus を充てる規約なので Opus 5.5 に上書きした
- 集計は決着のコミットの前に取った（終点は現在時刻）

分担の理由と各担当の報告は [archives/agents/TODO-008/](../agents/TODO-008/README.md)。

## きっかけ

TODO-007 のあとに、利用者から「コード全体のリファクタリング」を頼まれた。範囲は
「ファイル分割 + 処理の整理」に決めた。`game.ts` は 829 行で、`startGame` が状態・更新・
描画・入力をすべて抱えていた。挙動は変えない。

## やったこと

`src/game/game.ts` を 5 ファイルに分けた（計 973 行。`audio.ts` は変えていない）。

| ファイル | 行数 | 中身 |
|----------|-----:|------|
| `logic.ts` | 159 | DOM・Canvas に触らない関数と定数。tests はここから import する |
| `state.ts` | 401 | `State` 型と `createState()`、ハイスコアの読み書き、`update()` と処理ごとの関数、`startOrContinue` / `togglePause` / `pause` |
| `render.ts` | 202 | `render(ctx, dpr, s)` と描画の関数 |
| `input.ts` | 142 | キー・FIRE・レバー・Canvas のタップ、blur・visibilitychange の登録（`bindInput`） |
| `game.ts` | 69 | `startGame`。Canvas の用意、HUD、固定刻みのループ |

- `startGame` の中の `let` の並びを `State` の 1 つのオブジェクトにまとめた。名前は変えていない
- 入力は `{ left, right, fire, axis, fireQueued }` の 1 つのオブジェクトにし、`update` に引数で渡す。
  `input.ts` はゲームの状態を直接触らず、開始・一時停止・フォーカスが外れたときの処理をコールバックで受け取る
- `update()` は、背景 → 自機 → 編隊 → 敵の射撃 → UFO → 自機の弾 → 敵の弾 → 編隊の到達と全滅の
  関数に分けた。呼ぶ順番と途中の `return` は前と同じ
- `Sfx` は状態に入れず、要る関数に引数で渡す
- reviewer の指摘で、`state.ts` の「遊んでいれば止める」関数を `suspend` から `pause` に改名した
  （`input.ts` の内側の `suspend()` と名前が重なっていた）
- `tests/logic.test.ts` の import 先を `logic.ts` に、`index.astro` のコメント（`moveLever` の場所）と
  `README.md` のソースの説明を新しいファイルに合わせた

## 確かめたこと

- `npm test`（15 件）と `npm run build` が通る
- reviewer: 変更前後を node で同じ入力を与えて動かし、Canvas の呼び出し・効果音・HUD・`localStorage` の
  記録と `Math.random` の回数を突き合わせた。40000 フレームと、敵を減らしてウェーブ 3 まで進む
  12000 フレームで、どちらも完全に一致した。`PLAYER_SPEED` を 1 変えると記録が変わり、差を拾えることも確かめた。
  読み合わせでも、`update()` の順番、状態の初期化、入力の分岐、描画が前と同じ
- verifier: 変更前（HEAD を worktree に出したもの）と変更後を、`archives/agents/TODO-007/measure.mjs` で比べた。
  キーの `defaultPrevented`、移動の向き、弾、PAUSED の画素数、タッチのレバーと FIRE、エラー 0 件が前後で一致。
  差は星の 1px と自機の x の数 px だけで、TODO-007 のときと同じフレームのばらつき。
  タイトル・遊んでいる画面・タッチ画面のスクリーンショットも、星の位置以外は同じ

## 分担の振り返り

- implementer は依頼どおりに分け、名前の決まっていなかった `createInput()` を足した。報告に
  「`state.ts` と `input.ts` が互いに import している」と事実と違う記述があった
- reviewer は、変更前後を node のスタブの上で動かし、記録の sha256 で比べる方法を自分で作った。
  読み合わせだけより強い確かめ方で、要修正 0 件の根拠になった。そのスクリプト
  （`archives/agents/TODO-008/harness.mjs`）も残した。名前の重なり（`suspend`）を見つけた
- verifier は前後比較を 1 回ずつで済ませた。reviewer の差分実行で一致が分かっていたので、
  ブラウザでの比較は配線（イベントの登録、画面に出るか）の確認として足りた
- 見込みと実施は同じだった
- 次に同じ規模の、挙動を変えない構造の変更をやるなら、reviewer に最初から「変更前後を node で
  動かして記録を比べる」を依頼に書き、`harness.mjs` を使い回させる。そのうえで verifier の
  ブラウザでの比較は、タイトル・遊んでいる画面・タッチの 1 回ずつに絞ってよい
