基本的な説明をここに記載していってほしい。

> 使い方まじで分かってないから決めてもらってから共有してもらえるとありがたいです。

---

# HAL Cinema

## プロジェクト概要

映画館「HALシネマ」の予約販売管理Webサイト制作

---

## フォルダ構成

```
halcinema/
├── css/        → CSSファイル（common.css, chatbot.css など）
├── js/         → JavaScriptファイル（common.js, chatbot.js など）
├── html/       → 各ページのHTMLファイル
├── images/     → 画像ファイル
├── note/       → メモ・設計資料
├── index.html  → トップページ
└── README.md   → このファイル
```

---

## 【初めてGitHubを使う人向け】初期セットアップ

> GitHub触ったことない人はここから順番にやってください。

### STEP 1 — Gitをインストールする

1. [https://git-scm.com/](https://git-scm.com/) を開く
2. 「Download for Windows」をクリック
3. ダウンロードされたファイルを実行してすべてデフォルトのまま「Next」でインストール
4. スタートメニューで「Git Bash」が出れば完了

---

### STEP 2 — GitHubアカウントを作る（持っていない人）

1. [https://github.com/](https://github.com/) を開く
2. 「Sign up」からアカウントを作成
3. 作ったアカウント名をグループLINEに送る（リポジトリに招待してもらうため）

---

### STEP 3 — Gitに自分の名前とメールを登録する

Git Bash を開いて以下を1行ずつ実行。`"ここ"` の中を自分のGitHub情報に書き換えること。

```bash
git config --global user.name "GitHubのユーザー名"
```

```bash
git config --global user.email "GitHubに登録したメールアドレス"
```

---

### STEP 4 — リポジトリをクローン（自分のPCにダウンロード）する

1. このページ上部の緑の「Code」ボタンをクリック
2. URLをコピー（`https://github.com/...` というやつ）
3. 作業したいフォルダ（デスクトップなど）を開く
4. そのフォルダの中で右クリック →「Git Bash Here」を選ぶ
5. 以下を実行（URLは2でコピーしたもの）

```bash
git clone コピーしたURL
```

6. `halcinema` フォルダが作られれば完了

---

### STEP 5 — VSCodeで開く

1. VSCodeを起動
2. 「ファイル」→「フォルダーを開く」→ クローンした `halcinema` フォルダを選ぶ
3. 左のエクスプローラーにフォルダ一覧が表示されれば準備完了

---

### STEP 6 — Live Serverをインストールする（必須）

> これがないとJSが正常に動きません。必ずインストールしてください。

1. VSCodeの左メニューから拡張機能アイコン（四角が4つのやつ）をクリック
2. 検索欄に `Live Server` と入力
3. **Ritwick Dey** が作ったものをインストール
4. HTMLファイルを開いた状態で右下の「**Go Live**」をクリック
5. ブラウザが `http://localhost:5500` で開けばOK

> ⚠️ ファイルをダブルクリックで直接ブラウザで開くとJSが動きません。必ずLive Server経由で確認すること。

---

## GitHub更新方法

### 作業前に必ずやること — 最新状態を取得

```bash
git pull
```

---

### 編集後にアップロード

> 必ず `"変更内容"` を書き換えてから実行すること。
> メモ帳などに貼り付けて書き換えてから実行するのが安全。そのままコピペして実行すると `"変更内容"` のままになっちゃうかも。

```bash
git add .
```

```bash
git commit -m "変更内容をここに書く"
```

```bash
git push
```

コミットメッセージの例：

```bash
git commit -m "chatbot.htmlのレイアウト修正"
```

```bash
git commit -m "theater.htmlを新規作成"
```

---

## 注意

- push前に必ず `git pull` する。他の人の更新を取得するから必ずやってね。
- 画像は `images/` フォルダに入れる
- ファイル名・フォルダ名に**日本語・スペース禁止**（例：`映画詳細.html` はNG → `movie-detail.html` にする）

---

## ー貼り付けて書き換える場所ー

> commitメッセージなど書き換えが必要なものはここに貼り付けて編集してから使ってね。

---

## よく使うコマンド

変更確認

```bash
git status
```

最新取得

```bash
git pull
```

アップロード

```bash
git push
```

更新履歴確認

```bash
git log --oneline
```

---

## トラブルシューティング

### pushしたらエラーが出た

まず `git pull` を実行してから再度 `git push` を試す。それでも解決しない場合はグループLINEで共有すること。

### JSが動かない / 画面がおかしい

ファイルをダブルクリックで開いていないか確認。**必ずVSCodeのLive Server（Go Live）経由で開くこと。**

### git pullしたらコンフリクトが出た

同じファイルを複数人が同時に編集すると起きる。自分で解決が難しければグループLINEで相談すること。

---

## 【チャットボットと共通CSS/JSについて】

> チャットボットに関しては `common.js` から読み取ることができるので、フッターの下にでも書いておいてください。

### `<head>` に追加するCSS（コピペ用）

```html
<link rel="stylesheet" href="../css/common.css">
<link rel="stylesheet" href="../css/chatbot.css">
```

ページ固有のCSSがある場合はこの下に追加する（不要なら書かなくていい）：

```html
<link rel="stylesheet" href="../css/PAGENAME.css">
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

| ファイル | 全ページ必要？ | 役割 |
|---|---|---|
| `common.css` | ✅ 必須 | ヘッダー・フッター・ボタンなど共通スタイル |
| `chatbot.css` | ✅ 必須 | ポップアップのスタイルが入っている |
| `common.js` | ✅ 必須 | ポップアップHTMLを自動挿入する |
| `chatbot.js` | `chatbot.html` のみ | フルページチャットの動作 |

- `chatbot.css` はポップアップのスタイルも含んでいるので、チャットページ以外でもポップアップを表示したい全ページに必要です。
- `chatbot.js` は `chatbot.html` だけでOKです。
- まとめると「`<head>` に CSS 2行、`</body>` 前に JS 2行コピーすれば全ページにポップアップが出る」

---

## 開発スケジュール

| 時期 | 内容 |
|---|---|
| 5月 | 1次開発（Webサイト 設計〜完成） |
| 6〜9月 | 2次開発（Web座席予約システム） |
| 11〜12月 | 3次開発（映画情報管理システム） |
| 1〜2月 | 4次開発（店頭チケット発券システム） |
