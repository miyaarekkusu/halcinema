# ここに変更・トラブル記録内容を書く

# HAL Cinema

## プロジェクト概要

映画館「HALシネマ」の予約販売管理Webサイト制作

---

## フォルダ構成

````
halcinema/
├── css/        → CSSファイル（common.css, chatbot.css など）
├── js/         → JavaScriptファイル（common.js, chatbot.js など）
├── html/       → 各ページのHTMLファイル
├── images/     → 画像ファイル
├── note/       → メモ・設計資料
├── index.html  → トップページ
└── README.md   → このファイル

## 注意

- push前に必ず `git pull` する。他の人の更新を取得するから必ずやってね。
- 画像は `images/` フォルダに入れる
- ファイル名・フォルダ名に**日本語・スペース禁止**（例：`映画詳細.html` はNG → `movie-detail.html` にする）

---

## ー貼り付けて書き換える場所ー

> commitメッセージなど書き換えが必要なものはここに貼り付けて編集してから使ってね。

## 【チャットボットと共通CSS/JSについて】

> チャットボットに関しては `common.js` から読み取ることができるので、フッターの下にでも書いておいてください。

### `<head>` に追加するCSS（コピペ用）

```html
<link rel="stylesheet" href="../css/common.css">
<link rel="stylesheet" href="../css/chatbot.css">
````

ページ固有のCSSがある場合はこの下に追加する（不要なら書かなくていい）：

```html
<link rel="stylesheet" href="../css/PAGENAME.css" />
```

---

### `</body>` の直前に追加するJS（コピペ用）

```html
<script src="../js/common.js" defer></script>
<script src="../js/chatbot.js" defer></script>
```

ページ固有のJSがある場合はこの下に追加する（不要なら書かなくていい）：

```html
<script src="../js/PAGENAME.js" defer></script>
```

> チャットポップアップは `common.js` が自動で挿入します。上記2行を書くだけで全ページにポップアップが表示されます。

---

### ポイント整理

| ファイル      | 全ページ必要？      | 役割                                       |
| ------------- | ------------------- | ------------------------------------------ |
| `common.css`  | ✅ 必須             | ヘッダー・フッター・ボタンなど共通スタイル |
| `chatbot.css` | ✅ 必須             | ポップアップのスタイルが入っている         |
| `common.js`   | ✅ 必須             | ポップアップHTMLを自動挿入する             |
| `chatbot.js`  | `chatbot.html` のみ | フルページチャットの動作                   |

- `chatbot.css` はポップアップのスタイルも含んでいるので、チャットページ以外でもポップアップを表示したい全ページに必要です。
- `chatbot.js` は `chatbot.html` だけでOKです。
- まとめると「`<head>` に CSS 2行、`</body>` 前に JS 2行コピーすれば全ページにポップアップが出る」

# 変更記録

common.css、common.js 完成
チャットボット画面と機能完成
