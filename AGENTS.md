# ここに変更・トラブル記録内容を書く

# HAL Cinema

#　画面を作成するエージェント

- commonを基にデザインを前ページに共有

## プロジェクト概要

映画館「HALシネマ」の予約販売管理Webサイト制作

---

## フォルダ構成

````
halcinema/
├── css/
│   ├── common.css    → 全ページ共通（ヘッダー・フッター・ボタン・カードなど）
│   ├── chatbot.css   → チャットポップアップ・チャットページ共通
│   ├── index.css     → トップページ専用
│   ├── auth.css      → ログイン・会員登録ページ共通
│   ├── movies.css    → 作品一覧・作品詳細 共通
│   ├── mypage.css    → マイページ + ヘッダーマイページボタン共通
│   ├── zaseki.css    → 座席選択ページ専用
│   ├── payment.css   → 決済ページ専用
│   ├── ticket.css    → チケット発行ページ専用（未使用・予備）
│   ├── goods.css     → グッズ・売店ページ専用
│   └── event.css     → イベント情報ページ専用
├── js/
│   ├── common.js     → 全ページ共通（ハンバーガー・チャットポップアップ自動挿入）
│   ├── chatbot.js    → チャットページ専用
│   ├── zaseki.js     → 座席選択ページ専用
│   └── goods.js      → グッズ・売店ページ専用
├── html/             → 全ページのHTMLファイル（index.htmlも含む）
│   ├── index.html        → トップページ（上映スケジュール）
│   ├── login.html        → ログインページ
│   ├── register.html     → 会員登録ページ
│   ├── movies.html       → 作品一覧ページ
│   ├── movie-detail.html → 作品詳細ページ（?id=xxx でJSON参照）
│   ├── mypage.html       → マイページ（チケット・支払方法・設定）
│   ├── zaseki.html       → 座席選択ページ（Three.js 3D）
│   ├── payment.html      → 決済ページ
│   ├── ticket.html       → 予約完了ページ
│   ├── goods.html        → グッズ・売店ページ
│   ├── event.html        → イベント情報ページ
│   ├── chatbot.html      → チャットボットフルページ
│   └── sample.html       → 新規ページ作成用テンプレート
├── data/
│   └── movies.json   → 映画データ（上映中6本・上映予定5本）
├── images/           → 画像ファイル
├── note/             → メモ・設計資料
└── README.md         → このファイル

## 注意

- push前に必ず `git pull` する。他の人の更新を取得するから必ずやってね。
- 画像は `images/` フォルダに入れる
- ファイル名・フォルダ名に**日本語・スペース禁止**（例：`映画詳細.html` はNG → `movie-detail.html` にする）
- **HTMLファイルはすべて `html/` フォルダに置く**（ルートに置かない）
- **CSSファイルはすべて `css/` フォルダに置く**
- **JSファイルはすべて `js/` フォルダに置く**
- `html/` 内のファイルから各リソースへのパスは `../css/`、`../js/`、`../data/`、`../images/` を使う
- ページ間リンクは同じ `html/` フォルダ内なので `xxx.html` の形式でOK（`../html/xxx.html` は不要）
- エントリーポイントは `html/index.html`（Live Serverなら `http://localhost:xxxx/html/index.html`）

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

| 日付       | 内容                                                        | 担当        |
| ---------- | ----------------------------------------------------------- | ----------- |
| -          | common.css、common.js 完成                                  | -           |
| -          | チャットボット画面と機能完成（html/chatbot.html）           | -           |
| 2026-05-19 | トップページ完成（index.html + css/index.css）              | Claude Code |
| 2026-05-19 | ログインページ完成（html/login.html）                       | Claude Code |
| 2026-05-19 | 会員登録ページ完成（html/register.html）                    | Claude Code |
| 2026-05-19 | 認証ページ共通CSS追加（css/auth.css）                       | Claude Code |
| 2026-05-19 | 作品一覧ページ完成（html/movies.html）                      | Claude Code |
| 2026-05-19 | 作品詳細ページ完成（html/movie-detail.html）                | Claude Code |
| 2026-05-19 | 作品系共通CSS追加（css/movies.css）                         | Claude Code |
| 2026-05-19 | マイページ完成（html/mypage.html + css/mypage.css）         | Claude Code |
| 2026-05-19 | 全ページのヘッダーにマイページボタン追加                    | Claude Code |
| 2026-05-19 | マイページタイトル下スペース追加・退会セクション削除         | Claude Code |
| 2026-05-19 | ナビ「上映スケジュール」リンクをトップページ(index.html)に変更 | Claude Code |
| 2026-05-22 | 映画データを data/movies.json に移行、各ページをfetch対応化  | Claude Code |
| 2026-05-22 | 座席選択→決済→予約完了の予約フロー実装（sessionStorage連携） | Claude Code |
| 2026-05-22 | 決済ページ作成（html/payment.html + css/payment.css）        | Claude Code |
| 2026-05-22 | 予約完了ページ作成（html/ticket.html）                       | Claude Code |
| 2026-05-22 | マイページにチケット詳細モーダル（QRコード）追加             | Claude Code |
| 2026-05-22 | 全HTMLをhtml/フォルダに統一、CSS/JSも各フォルダへ移動        | Claude Code |

## 作成済みページ一覧

| ファイル              | ページ名       | 状態   |
| --------------------- | -------------- | ------ |
| `index.html`          | トップ         | ✅ 完成 |
| `html/login.html`     | ログイン       | ✅ 完成 |
| `html/register.html`  | 会員登録       | ✅ 完成 |
| `html/chatbot.html`   | チャットボット | ✅ 完成 |
| `html/zaseki.html`    | 座席選択       | ✅ 完成 |
| `html/movie-detail.html` | 作品詳細    | ✅ 完成 |
| `html/mypage.html`    | マイページ       | ✅ 完成 |
| `html/schedule.html`  | 上映スケジュール | 🔲 未作成 |
| `html/movies.html`    | 作品一覧       | ✅ 完成 |
| `html/goods.html`     | グッズ・売店   | ✅ 完成 |
| `html/event.html`     | イベント情報   | ✅ 完成 |
| `html/theater.html`   | 劇場情報       | 🔲 未作成 |
| `html/payment.html`   | 決済           | ✅ 完成 |
| `html/ticket.html`    | 予約完了       | ✅ 完成 |
