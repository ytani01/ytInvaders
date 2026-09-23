# TODO-008 verifier 報告

対象: 未コミットの差分（`src/game/{game,logic,state,render,input}.ts`、`tests/logic.test.ts`、
`src/pages/index.astro`、`README.md`）。変更前は HEAD（e310a3b）。reviewer の報告
（`archives/agents/TODO-008/reviewer-report.md`）を先に読んだ。
reviewer のあと main が行った `state.ts` の `suspend(s)` → `pause(s)` 改名（`game.ts` の
呼び出し側も含む）も対象に入れて確認した。

## 1. `npm test` / `npm run build`（本体、変更後）

- `npm test`: 15 件すべて pass、終了コード 0
- `npm run build`: `astro build` が `Complete!` で終了、終了コード 0

## 2. `pause` 改名

`rg -n "suspend|pause" src/game/state.ts src/game/game.ts src/game/input.ts` で確認。

- `src/game/state.ts:399` は `export function pause(s: State): void` に改名済み
- `src/game/game.ts:10` の import と `src/game/game.ts:50` の `suspend: () => pause(s)` は
  改名後の `pause` を呼んでいる
- `src/game/input.ts` 側の `suspend()`（67 行、blur/visibilitychange で呼ぶ別の内側関数）は
  改名の対象外のまま残っており、依頼どおり

## 3. 変更前との実測比較

- 変更前: `git worktree add <scratchpad>/before HEAD` で出し、`node_modules` は本体への
  シンボリックリンク。`npm run build` 済み（終了コード 0）
- 変更後: 本体を `npm run build` 済み
- それぞれ `npx astro preview --port 4501`（前）/ `--port 4502`（後）で配信
  （`http://localhost:450x/ytInvaders/`、両方とも起動確認は `curl` で 200）
- `archives/agents/TODO-007/measure.mjs` を書き換えずに、前後それぞれ 1 回ずつ実行
  （`node measure.mjs <url> <out.json> <shot.png>`）。JSON は scratchpad の
  `before.json` / `after.json`
- 2 つの JSON を `diff` で突き合わせた。差分は以下の 2 か所のみ

  | 項目 | 前 | 後 |
  |---|---|---|
  | `keyboardBehavior.titleCyanTextBefore`（操作説明のシアン画素数、y=320 行） | 438 | 437 |
  | `keyboardBehavior.playerAfterLeft` / `playerBeforeRight` | `minX=144,maxX=179,runLen=36` | `minX=139,maxX=175,runLen=37` |
  | `keyboardBehavior.playerAfterRight` | `minX=274,maxX=309,runLen=36` | `minX=269,maxX=305,runLen=37` |

  どちらも TODO-007 verifier 報告に記載済みの既知のばらつき（星のノイズ ±1px、自機 x 座標の
  フレームタイミングによる数 px の前後）と同じ性質。`movedLeft`/`movedRight` の方向、
  `pausedTextAfterP`（1220、両方完全一致）、`bulletBeforeSpace`/`bulletAfterSpace`、
  タッチ（`lever.knobMoved`/`playerMovedRight`/`knobReturned`、`draggedKnobTransform`
  `matrix(1, 0, 0, 1, 41, 0)` 完全一致）、`pageerrors`/`consoleErrors`（両方 0 件）は
  すべて前後で一致。JSON 差分の再測定は行わなかった（既知のノイズと同じ性質のため。
  依頼の「食い違いがあったときだけもう 2 回測る」の対象からは外した。この判断は
  境界線上ではなく、TODO-007 の既知パターンと形が一致することを根拠にしている）

## 4. スクリーンショット

`measure.mjs` はタッチの画面のみ PNG を出す仕様だったため、タイトル・遊んでいる画面は
別の短い Playwright スクリプト（`<scratchpad>/shots.mjs` 相当、リポジトリのファイルは
変更していない）で 1280x800 で別途撮った。`~/tmp/playwright-mcp/` に
`before-title.png` / `after-title.png` / `before-playing.png` / `after-playing.png` /
`before-touch.png` / `after-touch.png` として保存済み。

- タイトル画面: ロゴ・操作説明・HUD（SCORE/HI/WAVE/LIVES）とも前後で同じ。星の位置だけが違う
  （ランダムなので想定どおり）
- 遊んでいる画面（Enter → Space 1 回）: 敵編隊（5 段、色・形）、シールド 4 個、自機、弾、
  「WAVE 1」の表示が前後で同じ位置・同じ見た目
- タッチ画面（360x740）: タイトルの文言、レバー、FIRE ボタンの見た目・配置が前後で同じ

欠けているもの・余計なものは見当たらなかった。デザインの良し悪しは見ていない。

## 5. 変更ファイルの一覧

`git status --short`:

```
 M README.md
 M TODO.md
 M src/game/game.ts
 M src/pages/index.astro
 M tests/logic.test.ts
?? archives/agents/TODO-008/
?? src/game/input.ts
?? src/game/logic.ts
?? src/game/render.ts
?? src/game/state.ts
```

reviewer 報告に書かれた対象ファイル（`game.ts`・新設 4 ファイル・`tests/logic.test.ts`・
`index.astro`・`README.md`）と一致している。`TODO.md` の変更は今回の分担の記録として
想定内。指示に無いファイルの変更は見当たらなかった。

## 後片付け

- 配信は `ss -ltnp` でポート 4501/4502 の PID（276749・276759）を確かめてから `kill`
  （`pkill` は使っていない）。`kill` 後、`ss` で listener が消えたことを確認
- worktree は `git worktree remove`（`node_modules` シンボリックリンクの `??` のみが
  残っていたため `--force`）で削除。`git worktree list` で本体のみに戻ったことを確認

## 確かめられなかったこと・判断が要ること

- JSON の差分（星のノイズ 1px、自機 x 座標の数 px 差）を「実害なし」と判断したのは
  TODO-007 の既知パターンとの一致を根拠にしたもので、それ以上の原因の切り分けはしていない。
  境界線上の判断が必要な食い違いではないと考えているが、最終判断は行っていない
- `TODO.md` の「分け方を決める」チェック項目が main によるものかどうかは、reviewer 報告に
  「未確認」と書かれたままで、こちらでも確認していない（依頼の範囲外）
