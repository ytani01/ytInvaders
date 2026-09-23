# CLAUDE.md

## 概要

インベーダー風のシューティングゲーム。Astro の 1 ページに Canvas 2D で描く。
昔のインベーダーの再現ではなく、ネオン調のモダンなデザインにする。
ゲームエンジンや描画ライブラリは入れない。

Astro 自体の注意（dev サーバの起動のしかたなど）は [AGENTS.md](AGENTS.md) にある。

## 実行

```bash
npm install
npm run dev       # http://localhost:4321/ytInvaders/
npm run build
npm run check     # 型チェック（astro check）。build は型を見ない
```

タスクは [TODO.md](TODO.md) で管理する。
