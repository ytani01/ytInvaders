# TODO-001 implementer への依頼（2 回目: reviewer の指摘への対応）

reviewer の報告 `archives/agents/TODO-001/reviewer-report.md` の指摘を、管理者の判断で次のとおり直す。
保つもの・変えないものは 1 回目の依頼（implementer-request.md）のまま。

1. 指摘 1・2: 一時停止中は P に加えて Enter・FIRE ボタン・画面のタップでも再開する。
   一時停止の画面の文言をタイトルと揃える（例 `P / ENTER / TAP TO RESUME`）。README の表を実際の挙動に合わせる
2. 指摘 3: tests に足す。`enemyRect` の x・y（編隊の原点が効いていること）、`formationBounds` の minY・maxY、
   端で下がる量が `DROP` と等しく 0 でないこと、端にちょうど接したときの判定。
   `update()` までは広げない。足したあと、reviewer の表の「落ちたテスト: なし」の壊し方を
   自分でもう一度試し、今度は落ちることを報告に書く
3. 指摘 4: `sfx.unlock()` を `pointerup` でも呼ぶ（タッチの最初の 1 回で音が出るように）
4. 指摘 5: ゲームオーバーになってから短い間（1 秒前後）は、Enter・タップでのやり直しを受け付けない
5. 指摘 6: 新しいウェーブでシールドを作り直す
6. 指摘 7: タッチのボタンは `any-pointer: coarse` で出す。ボタンの下に `env(safe-area-inset-bottom)` の余白を取る
7. 指摘 8: tests からも index.astro からも使われない `export` を外す（`rg -w` で確かめる）

完了条件: `npm test` と `npm run build` が終了コード 0。コミットはしない。
報告は `archives/agents/TODO-001/implementer-report.md` の末尾に「2 回目」の節として足す。
返事は 5 行以内。
