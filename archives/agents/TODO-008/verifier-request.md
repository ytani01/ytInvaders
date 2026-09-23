# TODO-008 verifier への依頼

## 目的

`src/game/game.ts` を 5 ファイルに分けた未コミットの差分で、**挙動が変わっていないか**を
実測で確かめる。変更前は HEAD。reviewer の報告 `archives/agents/TODO-008/reviewer-report.md`
を先に読むこと。
reviewer のあと、main が `state.ts` の `suspend(s)` を `pause(s)` に改名した（`game.ts` の呼び出しも）。これも対象に入る。

## やること

1. 変更後の本体で `npm test` と `npm run build` を走らせ、終了コードと件数を書く
2. 変更前を `git worktree add <scratchpad>/before HEAD` で出し（`node_modules` は本体への
   シンボリックリンク）、`npm run build` する
3. 前後をそれぞれ `npx astro preview --port 4501`（前）/ `--port 4502`（後）で配信し
   （URL は `http://localhost:450x/ytInvaders/`）、
   `archives/agents/TODO-007/measure.mjs` を**書き換えずに**両方へ実行する
   （`node archives/agents/TODO-007/measure.mjs <url> <out.json> <shot-prefix>`。
   出力の JSON とスクリーンショットは scratchpad に置く）
4. 2 つの JSON を比べる。TODO-007 の verifier 報告
   （`archives/agents/TODO-007/verifier-report.md`）にあるとおり、自機の x は
   フレームのばらつきで数 px 前後する。方向・有無・画素数を比べる
5. スクリーンショット（前後のタイトル・遊んでいる画面・タッチ）を開いて見て、
   欠けているもの・余計なものが映っていないかを確かめる。デザインの良し悪しは見ない
6. 終わったら、配信を止め（`pgrep` で PID を確かめてから `kill`。`pkill` は使わない）、
   worktree を `git worktree remove` で消す

## 回数

`measure.mjs` は前後それぞれ 1 回ずつ。食い違いがあったときだけ、その項目をもう 2 回測る。

## 見なくてよいもの

- コードの読み合わせ（reviewer が済ませた）
- レイアウトの測り直し（今回は CSS を変えていない）

## 報告

`archives/agents/TODO-008/verifier-report.md` に書く。一致したものは 1 行、食い違いだけ
詳しく（前後の値を載せる）。修正はしない。原因の切り分けや、境界線上の判断はせず、
「実害は未確認」と添えて報告だけする。
返事は「終わったか・報告ファイルのパス・判断が要る点」の 5 行以内。
