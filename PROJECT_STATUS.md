<details> <summary>PROJECT_STATUS.md の内容（クリックで展開）</summary>
# HAL CINEMA — プロジェクト状況・ファイル使用状況まとめ

> GitHub上で閲覧可能な状態で管理するための資料です。

---

## 目次

1. [シネマ要件定義](#1-シネマ要件定義)
2. [プロジェクト全体構成](#2-プロジェクト全体構成)
3. [HTMLページ一覧と使用データ](#3-htmlページ一覧と使用データ)
4. [CSS一覧と担当範囲](#4-css一覧と担当範囲)
5. [JavaScript一覧と役割](#5-javascript一覧と役割)
6. [データソース一覧](#6-データソース一覧)
7. [予約フローとデータの流れ](#7-予約フローとデータの流れ)
8. [現在の未対応・課題一覧](#8-現在の未対応課題一覧)
9. [外部依存・環境](#9-外部依存環境)

---

## 1. シネマ要件定義

### スクリーン構成

| 種別 | 数 | 座席数/スクリーン | 小計 |
|------|----|----------------|------|
| 大スクリーン | 3 | 200席 | 600席 |
| 中スクリーン | 2 | 120席 | 240席 |
| 小スクリーン | 3 | 70席 | 210席 |
| **合計** | **8** | — | **1,050席** |

> 計算式：200×3 + 120×2 + 70×3 = **1,050席**

### 料金体系

| 区分 | 料金 |
|------|------|
| 一般 | ¥1,800 |
| 大学生 | ¥1,600 |
| 中学生・高校生 | ¥1,400 |
| 小学生・幼児 | ¥1,000 |

---

## 2. プロジェクト全体構成
halcinema/
├── html/ HTMLファイル（22ページ）
├── css/ CSSファイル（25ファイル）
├── js/ JavaScriptファイル（7ファイル）
├── data/ データファイル（movies.json）
├── images/ 画像ファイル（2点）
├── video/ 動画ファイル（prada.mp4）
├── voice/ 音声ナレーションファイル（.wav）
├── note/ メモ・設計資料
├── README.md セットアップガイド
├── AGENTS.md AI開発エージェント向け指示書
└── PROJECT_STATUS.md ← このファイル

**技術スタック：**
- フロントエンドのみ（HTML / CSS / JavaScript）
- 3D描画：Three.js（CDN）
- データ：JSONファイル + sessionStorage（バックエンドなし）
---
## 3. HTMLページ一覧と使用データ
### 公開ページ（情報系）
| ファイル | ページ名 | 使用データ | 現在の状態 |
|---------|---------|----------|----------|
| `html/index.html` | トップ / スケジュール | movies.json・Three.js・prada.mp4 | ✅ 実装済み |
| `html/movies.html` | 映画一覧 | movies.json | ⚠️ 映画内容未確定 |
| `html/movie-detail.html` | 映画詳細 | movies.json + URLパラメータ(?id=) | ⚠️ 詳細情報不足 |
| `html/event.html` | イベント情報 | 静的コンテンツ | ✅ 実装済み |
| `html/theater.html` | シアター情報 | 静的コンテンツ・音声ファイル | ✅ 実装済み |
| `html/privacy.html` | プライバシーポリシー | なし | ✅ 実装済み |
| `html/terms.html` | 利用規約 | なし | ✅ 実装済み |
### 予約フロー
| ファイル | ページ名 | 使用データ | 現在の状態 |
|---------|---------|----------|----------|
| `html/zaseki.html` | 座席選択 | URLパラメータ → sessionStorage書込 | ⚠️ **1スクリーン分のみ実装** |
| `html/ticket-select.html` | チケット種別選択 | （未実装） | ❌ 未完成 |
| `html/food-select.html` | フード選択 | （未実装） | ❌ 画像なし・未完成 |
| `html/goods-select.html` | グッズ選択 | goods.js | ❌ 画像なし・未完成 |
| `html/order-confirm.html` | 注文確認 | sessionStorage | ❌ 未完成 |
| `html/payment.html` | 支払い | sessionStorage (reservationData) | ⚠️ 決済処理未実装 |
| `html/ticket.html` | チケット確認 | sessionStorage | ✅ 実装済み |
| `html/qrcode.html` | QRコード表示 | sessionStorage | ✅ 実装済み |
| `html/ticket-detail.html` | チケット詳細モーダル | sessionStorage | ✅ 実装済み |
### 会員系
| ファイル | ページ名 | 使用データ | 現在の状態 |
|---------|---------|----------|----------|
| `html/login.html` | ログイン | なし（静的フォーム） | ⚠️ 認証未実装 |
| `html/register.html` | 会員登録 | なし（静的フォーム） | ⚠️ 認証未実装 |
| `html/mypage.html` | マイページ | プレースホルダーデータ | ⚠️ ダミーデータのみ |
### その他
| ファイル | ページ名 | 使用データ | 現在の状態 |
|---------|---------|----------|----------|
| `html/chatbot.html` | チャットサポート | chatbot.js（ダイアログロジック） | ⚠️ ハードコード応答のみ |
| `html/goods.html` | グッズ・売店 | goods.js（ハードコード） | ⚠️ 商品画像なし |
| `html/sample.html` | 新規ページテンプレート | なし | ✅ テンプレート用 |
---
## 4. CSS一覧と担当範囲
### 全ページ共通（必須）
| ファイル | 担当範囲 |
|---------|---------|
| `css/common.css` | ヘッダー・フッター・ボタン・カード・ナビ・レスポンシブグリッド |
| `css/chatbot.css` | チャットポップアップ・メッセージバブル・入力エリア |
### ページ個別
| ファイル | 対象ページ |
|---------|----------|
| `css/index.css` | index.html（ヒーロー・カルーセル） |
| `css/auth.css` | login.html / register.html |
| `css/movies.css` | movies.html / movie-detail.html |
| `css/zaseki.css` | zaseki.html（3Dキャンバス・2Dグリッド） |
| `css/payment.css` | payment.html |
| `css/goods.css` | goods.html |
| `css/event.css` | event.html |
| `css/theater.css` | theater.html |
| `css/mypage.css` | mypage.html |
| `css/ticket.css` | ticket.html |
| `css/qrcode.css` | qrcode.html |
### 予約フロー共通
| ファイル | 担当範囲 |
|---------|---------|
| `css/step-progress.css` | 予約ステップ進捗バー（番号付きサークル） |
| `css/voice-guide.css` | 音声案内ボックス（赤枠・再生コントロール） |
### 未完成・整備中
| ファイル | 対象 |
|---------|------|
| `css/ticket-select.css` | ticket-select.html（未完成） |
| `css/food-select.css` | food-select.html（未完成） |
| `css/goods-select.css` | goods-select.html（未完成） |
| `css/order-confirm.css` | order-confirm.html（未完成） |
| `css/privacy.css` | privacy.html |
| `css/terms.css` | terms.html |
---
## 5. JavaScript一覧と役割
| ファイル | 読み込みページ | 役割 | 依存データ |
|---------|-------------|------|----------|
| `js/common.js` | **全ページ必須** | ハンバーガーメニュー・チャットポップアップ自動挿入 | なし |
| `js/chatbot.js` | **全ページ必須** | チャットUI・音声合成（SpeechSynthesis） | ハードコード応答マップ（5キーワード） |
| `js/hero-cinema.js` | index.html | Three.js 3Dアニメーション（ヒーロー） | prada.mp4・Three.js CDN |
| `js/zaseki.js` | zaseki.html | 3D座席描画・座席選択・視点プレビュー | URLパラメータ → sessionStorage生成 |
| `js/goods.js` | goods.html | 商品グリッド・カート・検索/フィルター | ハードコード商品配列（13点） |
| `js/goods-select.js` | goods-select.html | goods.jsの派生版 | 同上 |
| `js/step-progress.js` | 予約フローページ群 | ステップ進捗バー自動挿入 | 現在のURLパス |
| `js/voice-guide.js` | 複数ページ | 音声ナレーション制御（1音声同時再生） | `/voice/*.wav` |
### 全ページへの読み込みテンプレート
```html
<!-- <head> に追加 -->
<link rel="stylesheet" href="../css/common.css">
<link rel="stylesheet" href="../css/chatbot.css">
<link rel="stylesheet" href="../css/PAGENAME.css">
<!-- </body> 直前に追加 -->
<script src="../js/common.js" defer></script>
<script src="../js/chatbot.js" defer></script>
<script src="../js/PAGENAME.js" defer></script>
6. データソース一覧
movies.json（data/movies.json）
映画データの唯一のマスターデータ。

使用ページ： index.html・movies.html・movie-detail.html・payment.html・mypage.html

現在の収録数： 11作品（公開中 6 / 近日公開 5）

⚠️ 課題： 作品内容・詳細情報・スケジュールが未確定。画像・あらすじ等の整備が必要。

sessionStorage（予約状態）
予約フロー中のデータを一時保存。ブラウザを閉じると消える。

書込： zaseki.html → goods.html
読出： payment.html → ticket.html → qrcode.html → mypage.html

商品データ（js/goods.jsにハードコード）
13商品（ポスター・スナック・ドリンク等）と価格。

⚠️ 課題： 商品画像なし。画像ファイルの追加と goods.js 内のパス設定が必要。

チャット応答データ（js/chatbot.jsにハードコード）
5キーワード対応の応答マップ：スケジュール・予約・料金・アクセス・映画

⚠️ 課題： 2次開発で /api/chat へのAPI連携予定。

7. 予約フローとデータの流れ
[映画詳細] movie-detail.html
     ↓ URLパラメータ
[座席選択] zaseki.html  →  sessionStorage に保存
[チケット種別] ticket-select.html  ← ❌ 未完成
[フード選択] food-select.html      ← ❌ 未完成・画像なし
[グッズ選択] goods-select.html     ← ❌ 未完成・画像なし
[注文確認] order-confirm.html      ← ❌ 未完成
[支払い] payment.html
[チケット確認] ticket.html → qrcode.html
8. 現在の未対応・課題一覧
🔴 高優先度（機能として必須）
#	課題	対象ファイル	内容
1	座席選択が1スクリーンのみ	zaseki.html / zaseki.js	スクリーン8種（大200席×3・中120席×2・小70席×3）への対応が必要
2	料金区分が未実装	zaseki.html / payment.html	一般1800・大学生1600・中高生1400・小学生以下1000円の選択UIが必要
3	映画一覧の内容未確定	data/movies.json	全作品のタイトル・あらすじ・キャスト・画像の確定と入力が必要
4	映画詳細情報の不足	html/movie-detail.html	ポスター画像・あらすじ・予告動画などのコンテンツ追加が必要
🟡 中優先度（フロー完成に必要）
#	課題	対象ファイル	内容
5	フード選択ページ未完成	html/food-select.html	商品画像・データ・カート連携の実装が必要
6	グッズ選択ページ未完成	html/goods-select.html	商品画像・データの追加が必要
7	チケット種別選択未完成	html/ticket-select.html	枚数・区分選択UIの実装が必要
8	注文確認ページ未完成	html/order-confirm.html	購入前最終確認画面の実装が必要
🟢 低優先度（2次開発以降）
#	課題	内容
9	認証（ログイン/登録）	UIのみ。バックエンド未接続
10	チャットbot API連携	ハードコード応答のみ。/api/chat API連携は2次開発予定
11	決済処理	UIのみ。実際の決済処理なし
12	sessionStorage永続化	ブラウザを閉じると予約データ消滅
13	おすすめ映画機能	利用履歴に基づくAI提案（2次開発予定）
9. 外部依存・環境
CDN（インターネット接続が必要）
ライブラリ	用途
Three.js v0.160.0	3D座席描画・ヒーローアニメーション
ブラウザAPI
API	用途
sessionStorage	予約フロー中のデータ保存
fetch()	movies.json の読み込み
SpeechSynthesis	チャットボットの音声読み上げ
WebGL	Three.js 3Dレンダリング
IntersectionObserver	スクロールアニメーション
ローカルアセット
ファイル	用途
video/prada.mp4	トップページヒーローアニメーション
images/volum_on.png / volume_off.png	音声ガイドアイコン
voice/*.wav	音声ナレーションファイル
開発スケジュール（参考）
フェーズ	時期	内容
1次開発	5月	Webサイト設計〜完成
2次開発	6〜9月	Web座席予約システム
3次開発	11〜12月	映画情報管理システム
4次開発	1〜2月	店頭チケット発券システム
最終更新：2026年6月

</details>
---
3. ファイルを保存したら以下を実行：
```bash
git add PROJECT_STATUS.md
git commit -m "PROJECT_STATUS.md を新規作成：ファイル使用状況・要件・課題を一覧化"
git push