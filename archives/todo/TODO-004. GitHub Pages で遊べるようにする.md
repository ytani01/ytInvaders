# TODO-004. GitHub Pages で遊べるようにする

|      | main | 担当 |
|------|------|------|
| 見込み | Opus 5.5 / effort high | main（実装）+ verifier |
| 実施 | Opus 5.5 / effort high | main（実装）+ verifier（2 回） |

| 担当 | モデル | effort | output | cache_creation | 料金の割合 |
|------|--------|--------|--------|----------------|-----------|
| main | Opus 5.5 | high | 20,595 | 35,362 | 73% |
| verifier | Sonnet 5 | medium | 7,392 | 84,744 | 27% |
| 合計 |  |  | 27,987 | 120,106 | 概算 $5.9 |

- main の effort は `~/.claude/settings.json` の `claude-opus-5-5` の値
- この範囲は TODO-002 の範囲と重なっており（立ててから TODO-002 の決着まで）、
  TODO-002 の verifier の 3 回目、`~/.claude/` のコミット、TODO-002 の決着も main と verifier の分に入っている
- verifier は TODO-002 の担当を使い回さず立て直した（文脈が長くなっていて、計測の中身も違うため）

## きっかけ

GitHub に public で repo（`ytani01/ytInvaders`）を作ったので、ブラウザから遊べるようにしたい。

決まっていたこと:

- 公開先は `https://ytani01.github.io/ytInvaders/`
- `base` は手元の dev と preview にも常に効かせる（利用者が決めた）
- Pages の有効化は Claude が `gh api` でやる（利用者が決めた）。push は利用者がやる

## やったこと

- `astro.config.mjs` に `site: 'https://ytani01.github.io'` と `base: '/ytInvaders'` を足した
- `src/pages/index.astro` の favicon 2 つのパスに `import.meta.env.BASE_URL` を付けた。
  ゲームの JS は Astro が `base` に合わせて出力する
- `.github/workflows/deploy.yml` を置いた。master への push で `withastro/action@v6` がビルドし、
  `actions/deploy-pages@v5` が公開する（版は各 repo の最新のリリースで確かめた）
- `gh api -X POST repos/ytani01/ytInvaders/pages -f build_type=workflow` で Pages を有効にした
- README に公開先の URL と、push で公開されることを書いた。README と `CLAUDE.md` の dev の URL を
  `http://localhost:4321/ytInvaders/` に直した
- origin の URL を https から SSH（`git@github.com:ytani01/ytInvaders.git`）に切り替えた

push までに 2 回止まった:

- `git push` がユーザー名を聞いて止まった。git が `gh` の認証を使っていなかったため。
  利用者が `gh auth setup-git` を入れた
- 次に、`gh` の token に `workflow` の権限が無く、`.github/workflows/` の push を GitHub が断った。
  SSH の鍵ならこの制限がかからないので、origin を SSH にして通した

## 確かめたこと

- 手元: `npm run build` 成功。`dist/index.html` の href / src はすべて `/ytInvaders/` で始まる。
  `npm run preview` の `/ytInvaders/` で、status 400 以上の応答・console error・pageerror がどれも 0 件。
  Enter の 1 秒後のスクリーンショットに編隊・シールド・自機・HUD が描かれている
- GitHub Actions: build と deploy がどちらも success
- 公開先 `https://ytani01.github.io/ytInvaders/`: 手元と同じ測り方で、どれも 0 件。スクリーンショットも同じ
- `gh api repos/ytani01/ytInvaders/pages` は `build_type: workflow`。`status` は `null` だが、
  これはブランチから公開する方式のビルドの状態を表すフィールドで、Actions の方式では入らない

## 分担の振り返り

- **verifier** は README の手順どおりに build と preview を試し、404 が無いことと描画を実測で確かめた。
  公開先でも同じスクリプト（`archives/agents/TODO-004/verify-pages.mjs`）を URL を替えて使えた。
  食い違いは見つからなかった。`status: null` は判断を管理者に回した
- 見込みとの食い違い: 担当は見込みどおり。見込みに無かったのは push の手間（認証と `workflow` の権限）で、
  担当の組み方とは関係ない
- 次に同じ規模をやるなら: 同じ組み方でよい。ワークフローを足す項目では、立てるときに
  origin が SSH か、token に `workflow` の権限があるかを先に確かめ、push の手順を項目に書いておく
