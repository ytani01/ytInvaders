# TODO-004 verifier への依頼

仕様は `TODO.md` の TODO-004 の節。差分は `git diff`（main が書いた）。コードは直さない。

## 1 回目: 手元での確認

README の「開発」の節に書いてあるとおりに試す。

1. `npm run build` の終了コード。`dist/index.html` の href / src がすべて `/ytInvaders/` で始まるか
2. `npm run preview` を立て、Playwright（`npx playwright` 1.63、node のスクリプト）で
   `http://localhost:<port>/ytInvaders/` を開く（デスクトップ 1280x800）。
   `page.on('response')` で、status が 400 以上の応答の URL と件数を記録する。console error・pageerror の件数も
3. 同じページで Enter を押し、1 秒後のスクリーンショットを `~/tmp/playwright-mcp/todo004-local.png` に撮る。
   自分で開いて、ゲーム画面（編隊・シールド・自機・HUD）が描かれているかを見る
4. `http://localhost:<port>/`（base なし）を開いたときの status も書く（404 になるのは想定どおり）
5. `npm run dev` については、ポート 4321 に利用者の dev サーバがいることがあるので、
   **立てずに**、README と CLAUDE.md の dev の URL が `http://localhost:4321/ytInvaders/` になっているかだけ見る

スクリプトは `archives/agents/TODO-004/verify-pages.mjs` に 1 本だけ作る。
2 回目（push のあと、公開先の `https://ytani01.github.io/ytInvaders/` で同じ 2〜3 を測る）でも使うので、
URL を引数で渡せるようにする。

見なくてよいもの: ゲームの操作、描画の良し悪し、ワークフローの中身の読み合わせ。
各項目は 1 回ずつでよい（繰り返さない）。

報告は `archives/agents/TODO-004/verifier-report.md` に、測った値を表で。
返事は「終わったか・報告ファイルのパス・判断が要る点」の 5 行以内。
preview は終わったら止める。ポート 4321 のプロセスは止めない。
