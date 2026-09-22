# TODO-004 verifier 報告（1 回目: 手元での確認）

コードは直していない。確認のみ。

## 検証結果

| 項目 | 結果 |
|------|------|
| `npm run build` 終了コード | 0 |
| `dist/index.html` の href / src | 3 件とも `/ytInvaders/` で始まる（下記） |
| preview（`http://localhost:4321/ytInvaders/`）で status 400 以上の応答 | 0 件 |
| console error | 0 件 |
| pageerror | 0 件 |
| Enter 後 1 秒のスクリーンショット | `~/tmp/playwright-mcp/todo004-local.png`。編隊・シールド・自機・HUD すべて描画されている（目視確認済み） |
| `http://localhost:4321/`（base なし）の status | 404（想定どおり） |
| README / CLAUDE.md の dev の URL | いずれも `http://localhost:4321/ytInvaders/` になっている |

`dist/index.html` の href / src（`rg -o 'href="[^"]*"|src="[^"]*"' dist/index.html`）:

```
href="/ytInvaders/favicon.svg"
href="/ytInvaders/favicon.ico"
src="/ytInvaders/_astro/index.astro_astro_type_script_index_0_lang.CGDx7lEk.js"
```

`import.meta.env.BASE_URL` は末尾に `/` を含まないビルドだったため、
`index.astro` の `${import.meta.env.BASE_URL}/favicon.svg` で二重スラッシュには
ならなかった（実測。Astro のバージョンや `trailingSlash` 設定が変わると
挙動が変わりうる点は未確認）。

preview サーバは確認後に `astro preview stop` で止めた
（`curl` で接続不可になったことを確認済み）。ポート 4321 の元のプロセスには触れていない。

## スクリプト

`archives/agents/TODO-004/verify-pages.mjs` を 1 本作成。
`node verify-pages.mjs <base URL>` で、指定 URL を開いて 400 以上の応答・console error・
pageerror を数え、Enter 後 1 秒でスクリーンショットを撮り、base なしの URL の status も見る。
2 回目（公開後の `https://ytani01.github.io/ytInvaders/` での確認）でもそのまま使える。

実行には `playwright`（npm パッケージ、v1.63）が要るが、プロジェクトの依存には
無かったため、プロジェクト外の scratchpad に `npm install playwright@1.63` して
そこからスクリプトを実行した。プロジェクトの `package.json` / `package-lock.json` /
`node_modules` は変更していない（`git status` で無変更を確認済み）。2 回目を実行する
担当も、同様にプロジェクト外に `playwright` を用意する必要がある。

## 変更されたファイルと指示の範囲

`git status` / `git diff` で確認:

- `CLAUDE.md`: dev の URL を `http://localhost:4321/ytInvaders/` に変更（指示どおり）
- `README.md`: 公開先 URL の追記、dev の URL 変更、GitHub Actions での公開の説明を追記（指示どおり）
- `astro.config.mjs`: `site` と `base` を追加（指示どおり）
- `src/pages/index.astro`: favicon の href に `BASE_URL` を付与（指示どおり）
- `.github/workflows/deploy.yml`（未追跡、新規）: `withastro/action` でビルドし
  `actions/deploy-pages` で公開するワークフロー（指示どおり。中身の読み合わせは
  依頼で「見なくてよいもの」とされているため、内容の是非は確認していない）
- `archives/agents/TODO-004/`（未追跡）: 本タスクの依頼・報告・スクリプト置き場

指示に無いファイルの変更は見当たらなかった。

## 確かめられなかったこと・判断が要る点

- **`gh api` で Pages を有効化したかどうかは確認していない。** 依頼の範囲外
  （1 回目は「手元での確認」）と理解しているが、TODO.md のチェック項目には
  含まれているため、済んでいるかどうかは main 側で確認要。
- **公開先 `https://ytani01.github.io/ytInvaders/` での確認（2 回目）はまだ。**
  利用者が push したあとに行う。
- `BASE_URL` の末尾スラッシュの扱いは今回のバージョン・設定での実測であり、
  Astro のバージョンや `trailingSlash` 設定が変わったときに二重スラッシュに
  ならない保証まではしていない（可能性の指摘であり実害は未確認）。

---

# 2 回目: 公開先での確認

コードは直していない。確認のみ。push 済み、GitHub Actions の build/deploy 成功後に実施。

## 検証結果

| 項目 | 結果 |
|------|------|
| `https://ytani01.github.io/ytInvaders/` で status 400 以上の応答 | 0 件 |
| console error | 0 件 |
| pageerror | 0 件 |
| Enter 後 1 秒のスクリーンショット | `~/tmp/playwright-mcp/todo004-pages.png`。編隊・シールド・自機・HUD すべて描画されている（目視確認済み。1 回目の手元確認と同じ見え方） |

`node verify-pages.mjs https://ytani01.github.io/ytInvaders/` の出力:

```
--- open https://ytani01.github.io/ytInvaders/ ---
bad responses (base): 0
console errors: 0
pageerrors: 0
screenshot: /home/ytani/tmp/playwright-mcp/todo004-pages.png
--- open https://ytani01.github.io/ (base なし) ---
status (no base): 404
```

（base なしの 404 はスクリプトの仕様上ついでに出たもので、今回の依頼の必須項目ではない。想定どおりの値。）

## `gh api` の出力（Pages の有効化の確認）

```
$ gh api repos/ytani01/ytInvaders/pages --jq '{build_type,status,html_url}'
{"build_type":"workflow","status":null,"html_url":"https://ytani01.github.io/ytInvaders/"}
```

`build_type` が `workflow` なので GitHub Actions を Source として Pages が有効化されている。
`status` が `null` である点は、素の応答（`gh api repos/ytani01/ytInvaders/pages`）でも同じ値で、
`build_type: "workflow"` のときにこのフィールドが常に `null` を返すのか、たまたまこの時点で
埋まっていないだけなのかは、この確認だけでは判断できない（判断できない点として報告）。
ただしページ自体は上記のとおり実測で正常に開けて描画もできているため、公開そのものは
機能している。

## 確かめられなかったこと・判断が要る点

- `gh api` の `status: null` が仕様上の正常値かどうかは未確認（上記のとおり）。実害は無い
  （ページは正常に表示された）。
