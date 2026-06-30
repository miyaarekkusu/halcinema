# HAL CINEMA

映画館「HALシネマ」予約販売管理 Web サイト

---

## システム概要

HALシネマは、架空の映画館「HALシネマ」をモデルにした座席予約・チケット購入・フード注文・グッズ販売を Web 上で完結できる予約販売管理サイトです。
HTML / CSS / JavaScript（座席選択は Three.js による 3D 描画）で構成されたフロントエンドに JSON 形式の作品データを組み合わせ、上映スケジュール確認から座席選択・フード選択・決済・QRコードチケット発行・マイページ管理までの一連の予約体験を再現しています。

---

## 主な機能

| 機能 | 説明 |
|------|------|
| 上映スケジュール・作品一覧 | `movies.json` と連携した動的な作品情報表示 |
| 3D座席選択 | Three.js による 3D 座席マップ。選択座席からの視点プレビューで購入前に見え方を確認できる |
| チケット種類選択 | 一般・中学高校生・大学生・シニア・親子割・カップル割など料金区分の選択 |
| フード・グッズ選択 | ウィザード形式のポップアップでポップコーン・ドリンク・ホットドッグ・ナチョス等を注文。セット割引対応 |
| 注文確認・決済 | 選択内容の最終確認 → 決済（sessionStorage でページ間データ連携） |
| QRコードチケット発行 | 予約完了後に QR コードを発行 |
| マイページ | 購入済みチケット確認・QRコード表示・会員情報管理 |
| グッズ・売店 | カート機能付きのオンライングッズ購入 |
| チャットボット | 予約・スケジュール相談に自動応答（音声読み上げ対応・全ページ共通ポップアップ） |
| 音声案内 | フード選択画面でのページ内音声ガイド |
| 劇場情報 | 劇場へのアクセス・スクリーン情報 |
| イベント情報 | 上映イベント・特別上映の案内 |
| 会員登録・ログイン | 新規登録・ログインによる会員機能 |

---

## 予約フロー

```
作品一覧 → 作品詳細 → 座席選択（3D）
→ チケット種類選択 → フード・グッズ選択 → 注文確認 → 決済 → 予約完了（QRコード）
```

---

## ページ一覧

| ファイル | ページ名 | 状態 |
|----------|----------|------|
| `html/index.html` | トップ（上映スケジュール） | ✅ 完成 |
| `html/movies.html` | 作品一覧 | ✅ 完成 |
| `html/movie-detail.html` | 作品詳細 | ✅ 完成 |
| `html/zaseki.html` | 座席選択（Three.js 3D） | ✅ 完成 |
| `html/ticket-select.html` | チケット種類選択 | ✅ 完成 |
| `html/food-select.html` | フード・グッズ選択 | ✅ 完成 |
| `html/order-confirm.html` | 注文確認 | ✅ 完成 |
| `html/payment.html` | 決済 | ✅ 完成 |
| `html/ticket.html` | 予約完了 | ✅ 完成 |
| `html/qrcode.html` | QRコード表示 | ✅ 完成 |
| `html/mypage.html` | マイページ | ✅ 完成 |
| `html/ticket-detail.html` | チケット詳細 | ✅ 完成 |
| `html/goods.html` | グッズ・売店 | ✅ 完成 |
| `html/goods-select.html` | グッズ選択 | ✅ 完成 |
| `html/login.html` | ログイン | ✅ 完成 |
| `html/register.html` | 会員登録 | ✅ 完成 |
| `html/chatbot.html` | チャットボット（フルページ） | ✅ 完成 |
| `html/theater.html` | 劇場情報 | ✅ 完成 |
| `html/event.html` | イベント情報 | ✅ 完成 |
| `html/privacy.html` | プライバシーポリシー | ✅ 完成 |
| `html/terms.html` | 利用規約 | ✅ 完成 |
| `html/schedule.html` | 上映スケジュール（詳細） | 🔲 未作成 |
| `html/sample.html` | 新規ページ作成用テンプレート | — |

---

## フォルダ構成

```
halcinema/
├── html/               → 全ページの HTML ファイル
├── css/
│   ├── common.css          → 全ページ共通（ヘッダー・フッター・ボタン等）
│   ├── chatbot.css         → チャットポップアップ・チャットページ共通
│   ├── step-progress.css   → 予約ステッププログレスバー（共通）
│   ├── voice-guide.css     → 音声案内バー（共通）
│   ├── index.css           → トップページ専用
│   ├── auth.css            → ログイン・会員登録 共通
│   ├── movies.css          → 作品一覧・詳細 共通
│   ├── zaseki.css          → 座席選択専用
│   ├── ticket-select.css   → チケット種類選択専用
│   ├── food-select.css     → フード・グッズ選択専用
│   ├── order-confirm.css   → 注文確認専用
│   ├── payment.css         → 決済専用
│   ├── ticket.css          → 予約完了専用
│   ├── ticket-detail.css   → チケット詳細専用
│   ├── qrcode.css          → QRコード専用
│   ├── mypage.css          → マイページ専用
│   ├── goods.css           → グッズ・売店専用
│   ├── goods-select.css    → グッズ選択専用
│   ├── theater.css         → 劇場情報専用
│   ├── event.css           → イベント情報専用
│   ├── privacy.css         → プライバシーポリシー専用
│   └── terms.css           → 利用規約専用
├── js/
│   ├── common.js           → 全ページ共通（ハンバーガー・チャットポップアップ自動挿入）
│   ├── chatbot.js          → チャットページ専用
│   ├── zaseki.js           → 座席選択専用
│   ├── goods.js            → グッズ・売店専用
│   ├── goods-select.js     → グッズ選択専用
│   ├── step-progress.js    → ステッププログレスバー制御
│   ├── voice-guide.js      → 音声案内制御
│   └── hero-cinema.js      → トップページヒーロー演出
├── data/
│   └── movies.json         → 映画データ（上映中・上映予定）
├── images/                 → 画像ファイル一式
├── video/                  → 動画ファイル（ヒーローセクション等）
├── voice/                  → 音声ガイドファイル
├── backend/                → Go API サーバー（2次開発〜）
│   ├── cmd/api/main.go
│   ├── internal/config/db.go
│   ├── go.mod / go.sum
│   └── Dockerfile
├── note/                   → メモ・設計資料
├── schema.sql              → PostgreSQL DDL（DB初期化用）
├── docker-compose.yml      → DB + API コンテナ起動設定
├── DATABASE.md             → DB設計書・アーキテクチャ・JWT説明
├── AGENTS.md               → 開発者向けルール・CSS/JS共通コピペ集
├── GitHub.md               → GitHub 操作トラブルシューティング
└── README.md               → このファイル
```

---

## 開発環境・起動方法

### フロントエンド（HTML/CSS/JS のみ）

VS Code の **Live Server** 拡張を使うのが最も簡単。

1. VS Code でプロジェクトフォルダを開く
2. `html/index.html` を右クリック → "Open with Live Server"
3. ブラウザで `http://localhost:5500/html/index.html` が開く

> **注意：** `html/` 内から各リソースへのパスは `../css/`・`../js/`・`../images/` を使っています。
> `html/` フォルダをルートにして開かないとパスが解決されません。

### バックエンド（Go API + Docker）

```bash
# .env.example を .env にコピーして設定
cp .env.example .env

# コンテナを起動（DB + API）
docker compose up -d

# 動作確認
curl http://localhost:8080/api/health
```

> バックエンドは 2 次開発フェーズ。現在のフロントエンドは sessionStorage のみで動作します。

---

## 開発ルール（抜粋）

- `push` 前に必ず `git pull` で最新を取得する
- ファイル名・フォルダ名に**日本語・スペース禁止**（例：`映画詳細.html` → `movie-detail.html`）
- HTML は `html/`、CSS は `css/`、JS は `js/` に置く
- 画像は `images/` に入れる
- **`.env` は絶対にコミットしない**（`.gitignore` で除外済み）
- 詳細ルールは [AGENTS.md](AGENTS.md) を参照

---

## トラブルシューティング

Git / GitHub 操作のトラブルは **[GitHub.md](GitHub.md)** を参照してください。
（画像が表示されない・古いバージョン・pull できない・衝突など）

---

## ドキュメント（.md ファイル）の閲覧方法

プロジェクト内には複数の `.md`（Markdown）ファイルがあります。
Markdown とは、`#` で見出し・`-` でリスト・`|` で表が書けるテキスト形式です。
そのままメモ帳で開くと記号だらけに見えるので、以下の方法で読んでください。

### GitHub 上で見る（推奨）

GitHub のリポジトリページを開くと、`.md` ファイルは自動的に整形されて表示されます。
ファイルをクリックするだけで OK です。

```
https://github.com/ユーザー名/halcinema
→ ファイル一覧から README.md・GitHub.md などをクリック
```

### VS Code でプレビューする

1. VS Code でファイルを開く
2. 右上の「プレビューを開く」アイコンをクリック（または `Ctrl + Shift + V`）
3. 隣にレンダリングされたプレビューが表示される

### プロジェクト内の MD ファイル一覧

| ファイル | 内容 |
|----------|------|
| [README.md](README.md) | このファイル。プロジェクト概要・ページ一覧・起動方法 |
| [AGENTS.md](AGENTS.md) | 開発ルール・共通 CSS/JS コピペ集・変更記録 |
| [GitHub.md](GitHub.md) | Git / GitHub トラブルシューティング |
| [DATABASE.md](DATABASE.md) | DB設計書・API アーキテクチャ・JWT 説明 |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | ページ・CSS・JS ファイル使用状況まとめ（詳細版） |

---

## note/ フォルダについて

`note/` フォルダには作業メモ・手順書・更新記録が入っています。
開発中に詰まったときや、設定の確認をしたいときに参照してください。

| ファイル | 内容 |
|----------|------|
| `database.txt` | DB（PostgreSQL）への接続方法・テーブル確認・データ操作コマンド |
| `docker.txt` | Docker のセットアップ手順・よく使うコマンド |
| `重要メモ.txt` | チーム全員が知っておくべき注意点・決定事項 |
| `修正追加予定メモ.txt` | 今後対応予定の修正・機能追加リスト |
| `更新記録.txt` | 作業の更新記録（通し） |
| `更新記録_0608.txt` | 2026-06-08 以降の更新記録 |

> バックエンド（Docker・DB）に触れる前は必ず `docker.txt` と `database.txt` を読んでください。
