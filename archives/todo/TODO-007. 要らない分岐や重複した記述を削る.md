# TODO-007. 要らない分岐や重複した記述を削る

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | main（実装）+ reviewer（Opus 5.5 / high）+ verifier（Sonnet 5 / medium） |
| 実施 | Opus 5.5 / effort high | main（実装）+ reviewer（Opus 5.5 / high）+ verifier（Sonnet 5 / medium） |

| 担当 | モデル | effort | output | cache_creation | 料金の割合 |
|------|--------|--------|--------|----------------|-----------|
| main | Opus 5.5 | high | 12,769 | 40,724 | 57% |
| reviewer | Opus 5.5 | high | 4,732 | 46,890 | 21% |
| verifier | Sonnet 5 | medium | 12,494 | 76,667 | 22% |
| 合計 |  |  | 29,995 | 164,281 | 概算 $3.0 |

- main の effort は `~/.claude/settings.json` の `claude-opus-5-5` の値
- reviewer は定義のモデルが sonnet。コードレビューには Opus を充てる規約なので Opus 5.5 に上書きした

## きっかけ

ponytail-review（2026-09-23）でコード全体を見て、要らない分岐や重複した記述を挙げた。
挙動は変えずに削る。

`index.astro` の `$` ヘルパー（要素が無いと throw）は今のまま残した。
`getElementById(id)!` の 1 行にすると、id を書き間違えたときに原因を探しにくくなるため（利用者と決めた）。

## やったこと

4 ファイル、67 行足して 123 行消した（差し引き -56 行）。

- `src/game/game.ts`
  - `keydown` と `keyup` の switch を、キーから `input` の項目を引く表 `KEYS` にまとめた。
    switch に残していた Space の `fireQueued`、P、Enter は if の並びにした
  - `setPointerCapture` を囲む try/catch を外した（FIRE とレバーの 2 か所）
  - 呼び出しが 1 か所だけの `bindFire` を展開した
  - `stepFormation` の `width` と `margin` の引数を外し、`W - MARGIN` と `MARGIN` を直接使うようにした
- `src/pages/index.astro`
  - 中身の無い frontmatter を消した
  - `.touch button` と `.touch .fire` を `.touch .fire` の 1 つのルールにした（button は FIRE だけ）
  - `.game` の `align-items: stretch`（flex のデフォルト）を消した
  - `--hud-h` を消し、`.hud` の高さを `2.6em` にした（font-size が幅の 0.065 倍なので、前と同じ幅の 0.169 倍）
- `src/game/audio.ts`: `webkitAudioContext` への切り替えを外した
- `tests/logic.test.ts`: テストを `W`/`MARGIN`（480、12）に合わせて数値を直した。
  「下がる量は DROP で、0 ではない」の test を消し、`assert.ok(DROP > 0)` を右端の test へ移した

## 確かめたこと

- `npm test`（15 件）と `npm run build` が通る
- reviewer: キーごとに repeat のあり・なしで、`input`・`fireQueued`・呼び出し・`preventDefault` が前と同じ。
  テストの境目の値は前と同じ位置関係を確かめていて、壊すと落ちる。`2.6em` は前の値と同じ
- verifier: 変更前（HEAD を worktree に出したもの）と変更後を Playwright で比べた
  - 1280x800: 9 つのキーの `defaultPrevented` が repeat のあり・なしとも前後で一致。
    Enter で開始、P で PAUSED と再開、←/A と →/D の移動、Space の弾が前後で同じ
  - 360x740 タッチ: FIRE のタップで開始と弾、レバーのドラッグでつまみ（`translateX(41px)`）と自機が動き、離すと戻る。
    pageerror とコンソールのエラーは 0 件
  - `.hud` の height（60.83px）、FIRE とレバーのスタイルが前後で一致。タイトル画面のスクリーンショットも、星の位置以外は同じ
  - 自機の x が前後で最大 4px ずれたのは、別のページで同じ入力を再生したときのフレームのずれ。移動の向きと幅は一致

## 残ること

- `webkitAudioContext` しか無いブラウザ（Safari 14.1 より前）では音が出なくなった。対象外とする
- `setPointerCapture` の例外は、実在しない pointerId で合成したイベントでだけ出る（Chromium で確認）。
  実際のタップでは出ない。Firefox と Safari では確かめていない

## 分担の振り返り

- reviewer は、try/catch を外したことで、合成イベントで確かめると例外が出ることを実測で見つけた。
  verifier の依頼に「実際のポインタを使う」と書けたので、前後比較で余計なエラーを追わずに済んだ
- verifier は、自機の位置を画素で取る方法がパーティクルを拾って一度外れ、自分で直してから測り直した。
  計測の方法は依頼に書いたが、パーティクルと同じ色になることまでは書いていなかった
- 見込みと実施は同じだった
- 次に同じ規模（挙動を変えない削除が 10 件ほど）をやるなら、同じ組み方でよい。
  verifier の依頼には、画素で位置を取るときに同じ色のものが無いかを先に書いておく。
  前後比較の計測スクリプト（`archives/agents/TODO-007/measure.mjs`）は次の項目でも使い回す
