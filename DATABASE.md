# HAL映画館 予約管理システム — データベース設計書

## 目次

1. [概要・技術スタック](#1-概要技術スタック)
2. [アーキテクチャ全体像](#2-アーキテクチャ全体像)
3. [JWT 認証の仕組み](#3-jwt-認証の仕組み)
4. [テーブル一覧・ER図](#4-テーブル一覧er図)
5. [各テーブル定義](#5-各テーブル定義)
6. [重要な設計ルール](#6-重要な設計ルール)
7. [ステータスコード一覧](#7-ステータスコード一覧)
8. [セキュリティ注意事項](#8-セキュリティ注意事項)
9. [セットアップ手順](#9-セットアップ手順)

---

## 1. 概要・技術スタック

映画館の座席予約・チケット発券を管理するシステムのバックエンド。

| レイヤー | 技術 |
|----------|------|
| API サーバー | Go (net/http or Gin) |
| ORM | GORM |
| データベース | PostgreSQL |
| 認証 | JWT (JSON Web Token) |
| パスワード | bcrypt |
| QRコード | UUID v4 |

---

## 2. アーキテクチャ全体像

```
ブラウザ (HTML/CSS/JS)
    │  HTTP リクエスト
    ▼
┌─────────────────────────────┐
│      Go API サーバー         │
│                              │
│  ルーティング                │
│  ├── /api/auth/*  → 認証    │
│  ├── /api/movies/*→ 映画    │
│  ├── /api/seats/* → 座席    │
│  └── /api/reservations/*    │
│                              │
│  ミドルウェア                │
│  └── JWT検証（要認証ルート） │
│                              │
│  サービス層（ビジネスロジック）│
│  └── 二重予約防止トランザクション │
│                              │
│  リポジトリ層（GORM）        │
└─────────────┬───────────────┘
              │
              ▼
       PostgreSQL (hal_cinema)
```

### リクエストの流れ（例：座席予約）

```
1. ブラウザ → POST /api/reservations
   ヘッダー: Authorization: Bearer <JWTトークン>
   ボディ:   { schedule_id, seat_ids[], payment_method }

2. JWT ミドルウェア → トークン検証 → member_id を取得

3. サービス層 → トランザクション開始
   └── t_SEAT_STOCK を SELECT FOR UPDATE（排他ロック）
   └── 空席確認 → t_RESERVATION INSERT
   └── t_RESERVATION_DETAIL INSERT
   └── t_SEAT_STOCK を 0→1 に UPDATE
   └── COMMIT

4. レスポンス → 201 Created + { reservation_code }
```

---

## 3. JWT 認証の仕組み

### JWT とは

JSON Web Token。ログイン成功時にサーバーが発行する「署名付き証明書」。
次回以降のリクエストでこのトークンを送ることで「誰がリクエストしているか」を証明する。
**サーバー側にセッション情報を保存しない**のが特徴（ステートレス）。

### トークンの構造

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9   ← ヘッダー（アルゴリズム情報）
.
eyJtZW1iZXJfaWQiOjEsImV4cCI6MTcwMDAwMH0  ← ペイロード（中身）
.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  ← 署名
```

ペイロードの中身（例）:
```json
{
  "member_id": 42,
  "exp": 1700000000
}
```

### ログインから予約までの流れ

```
① ログイン
   POST /api/auth/login
   { email, password }
        │
        ▼
   サーバー: bcryptでパスワード検証
        │ OK
        ▼
   JWTトークン生成（秘密鍵で署名）
        │
        ▼
   レスポンス: { token: "eyJ..." }
   ブラウザ: localStorageに保存

② 予約リクエスト
   POST /api/reservations
   Authorization: Bearer eyJ...
        │
        ▼
   サーバー: トークンを署名検証
        │ OK → member_id = 42 を取得
        ▼
   予約処理（member_id を使ってDB操作）
```

### Go での実装イメージ

```go
// トークン生成（ログイン成功時）
claims := jwt.MapClaims{
    "member_id": member.ID,
    "exp":       time.Now().Add(24 * time.Hour).Unix(),
}
token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
tokenString, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))

// トークン検証（ミドルウェア）
token, _ := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
    return []byte(os.Getenv("JWT_SECRET")), nil
})
```

### JWT の注意点

| 項目 | 内容 |
|------|------|
| 有効期限 | 短め推奨（例：24時間）。漏れたトークンが永続しないよう |
| 秘密鍵 | 環境変数 `JWT_SECRET` で管理。コードに書かない |
| 保存場所 | `localStorage`（XSSリスクあり）か `httpOnly Cookie`（推奨）|
| ゲスト | JWTなしで予約可。`f_member_id = NULL` で保存 |

---

## 4. テーブル一覧・ER図

### テーブル一覧

| # | 論理名 | 物理名 | 概要 |
|---|--------|--------|------|
| 1 | 会員 | t_MEMBER | 登録会員。ゲスト予約時は参照されない |
| 2 | 映画 | t_MOVIE | 上映作品マスタ。f_image_id でメイン画像を参照 |
| 3 | スクリーン | t_SCREEN | シアター・上映室マスタ |
| 4 | 座席 | t_SEAT | スクリーンごとの座席マスタ |
| 5 | 上映スケジュール | t_SCHEDULE | 映画×スクリーン×日時の組み合わせ |
| 6 | 料金区分 | t_PRICE_CATEGORY | 一般・学生・シニア等の客属性区分 |
| 7 | 上映料金 | t_SCREEN_PRICE | 上映回×料金区分→金額 |
| 8 | 予約 | t_RESERVATION | 予約ヘッダ。ゲスト予約は f_member_id=NULL |
| 9 | 予約明細 | t_RESERVATION_DETAIL | 座席1つ分の明細 |
| 10 | チケット | t_TICKET | 発券されたQRチケット |
| 11 | 座席在庫 | t_SEAT_STOCK | 上映回ごとの座席空き状態（二重予約防止の要） |
| 12 | 上映ステータスマスタ | t_SCHEDULE_STATUS | 0=上映予定 / 1=上映中 / 2=上映終了 |
| 13 | 映画画像 | t_MOVIE_IMAGE | poster/banner/still/thumbnail。movie_id で映画に紐付け |
| 14 | グッズ・商品 | t_GOODS | フード・ドリンク・グッズ商品マスタ |
| 15 | グッズ画像 | t_GOODS_IMAGE | main/thumbnail/detail。goods_id で商品に紐付け |
| 16 | 上映枠 | t_SLOT | スクリーン×日付の固定枠。ここに映画を割り当てる（枠方式の中核） |
| 17 | 振替履歴 | t_SCHEDULE_CHANGE_LOG | 枠・時刻・スクリーン変更／中止の履歴 |
| 18 | 通知 | t_NOTIFICATION | 振替・時刻/スクリーン変更を予約者へ通知 |

### ER図（簡略）

```
t_MEMBER ──────────────────────────────────┐
                                            │ (NULL許可)
t_MOVIE ──┐                                 │
          ├── t_SCHEDULE ──┬── t_SCREEN_PRICE ── t_PRICE_CATEGORY ──┐
t_SCREEN ─┘               │                                          │
          │               ├── t_RESERVATION ◄── (member_id) ────────┘
          │               │       │
t_SEAT ───┼── t_SEAT_STOCK│       └── t_RESERVATION_DETAIL ──┐
          │               │               │                   │
          └───────────────┘               └── t_TICKET        │
                                                              t_PRICE_CATEGORY
```

---

## 5. 各テーブル定義

### t_MEMBER（会員）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_member_id | SERIAL | PK | 会員ID（自動連番） |
| f_last_name | VARCHAR(50) | NOT NULL | 姓 |
| f_first_name | VARCHAR(50) | NOT NULL | 名 |
| f_email | VARCHAR(255) | NOT NULL, UNIQUE | メールアドレス（ログインID） |
| f_password | VARCHAR(255) | NOT NULL | bcryptハッシュ済みパスワード |
| f_created_at | TIMESTAMP | NOT NULL, DEFAULT NOW | 登録日時 |
| f_updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW | 更新日時（自動更新トリガーあり） |

---

### t_MOVIE（映画）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_movie_id | SERIAL | PK | 映画ID |
| f_title | VARCHAR(200) | NOT NULL | タイトル |
| f_genre | VARCHAR(50) | NOT NULL | ジャンル |
| f_duration | SMALLINT | NOT NULL | 上映時間（分） |
| f_rating | VARCHAR(10) | NOT NULL | 年齢区分（G / PG12 / R15+ / R18+） |
| f_release_date | DATE | NOT NULL | 公開日 |
| f_is_showing | SMALLINT | NOT NULL, DEFAULT 1, CHECK(0,1) | 0:終映 / 1:上映中 |
| f_trailer_id | VARCHAR(20) | | YouTube動画ID。予告編埋め込みに使用（NULLなら「予告編 準備中」表示） |

---

### t_SCREEN（スクリーン）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_screen_id | SERIAL | PK | スクリーンID |
| f_screen_name | VARCHAR(50) | NOT NULL | スクリーン名（例：スクリーン1） |
| f_screen_type | VARCHAR(20) | NOT NULL | 種別（通常 / IMAX / 4DX 等） |
| f_seat_count | SMALLINT | NOT NULL | 座席数（t_SEATのレコード数と一致させること） |

---

### t_SEAT（座席）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_seat_id | SERIAL | PK | 座席ID |
| f_screen_id | INTEGER | NOT NULL, FK→t_SCREEN | 所属スクリーン |
| f_row_label | VARCHAR(5) | NOT NULL | 列ラベル（A, B, C…） |
| f_seat_number | SMALLINT | NOT NULL | 席番号（1, 2, 3…） |
| f_seat_type | VARCHAR(20) | NOT NULL, DEFAULT '一般' | 一般 / 車椅子 |

UNIQUE制約: `(f_screen_id, f_row_label, f_seat_number)`

---

### t_SCHEDULE（上映スケジュール）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_schedule_id | SERIAL | PK | スケジュールID |
| f_movie_id | INTEGER | NOT NULL, FK→t_MOVIE | 上映映画 |
| f_screen_id | INTEGER | NOT NULL, FK→t_SCREEN | 使用スクリーン |
| f_slot_id | INTEGER | NULL可, FK→t_SLOT | 割り当て先の上映枠。枠方式で運用（NULLは旧・時刻直指定の互換用） |
| f_show_date | DATE | NOT NULL | 上映日 |
| f_start_time | TIME | NOT NULL | 開始時刻（枠運用時は t_SLOT.f_start_time から導出してコピー） |
| f_status | SMALLINT | NOT NULL, DEFAULT 0, CHECK(0,1,2) | 0:販売中 / 1:満席 / 2:中止 |

UNIQUE制約: `(f_screen_id, f_show_date, f_start_time)`（同スクリーンで同時刻の重複防止）

> **枠方式（推奨運用）**: 開始時刻を手入力せず、あらかじめ用意した `t_SLOT`（例：3時間枠×3・4時間枠×1）に映画を割り当てる。1枠=1上映回。掃除時間込みで枠に収まる映画のみ割り当て可能。詳細は「6. 重要な設計ルール」の枠方式を参照。

---

### t_PRICE_CATEGORY（料金区分）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_price_category_id | SERIAL | PK | 料金区分ID |
| f_category_name | VARCHAR(50) | NOT NULL | 区分名（一般 / 学生 / シニア 等） |

初期データ: 一般・学生・シニア

---

### t_SCREEN_PRICE（上映料金）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_price_id | SERIAL | PK | 料金ID |
| f_schedule_id | INTEGER | NOT NULL, FK→t_SCHEDULE | 対象上映回 |
| f_price_category_id | INTEGER | NOT NULL, FK→t_PRICE_CATEGORY | 料金区分 |
| f_price | INTEGER | NOT NULL | 税込金額（円） |

UNIQUE制約: `(f_schedule_id, f_price_category_id)`

---

### t_RESERVATION（予約）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_reservation_id | SERIAL | PK | 予約ID |
| f_member_id | INTEGER | NULL可, FK→t_MEMBER | NULL=ゲスト予約 |
| f_schedule_id | INTEGER | NOT NULL, FK→t_SCHEDULE | 予約した上映回 |
| f_reserved_at | TIMESTAMP | NOT NULL, DEFAULT NOW | 予約日時 |
| f_reservation_code | VARCHAR(20) | NOT NULL, UNIQUE | 顧客提示番号 |
| f_total_amount | INTEGER | NOT NULL | 税込合計（円） |
| f_payment_method | SMALLINT | NOT NULL, CHECK(1,2,3) | 1:クレカ / 2:QR決済 / 3:窓口 |
| f_payment_status | SMALLINT | NOT NULL, DEFAULT 0, CHECK(0,1,2) | 0:未払 / 1:支払済 / 2:返金済 |
| f_reservation_status | SMALLINT | NOT NULL, DEFAULT 0, CHECK(0,1,2) | 0:予約中 / 1:発券済 / 2:キャンセル |

---

### t_RESERVATION_DETAIL（予約明細）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_detail_id | SERIAL | PK | 明細ID |
| f_reservation_id | INTEGER | NOT NULL, FK→t_RESERVATION | 予約ヘッダ |
| f_seat_id | INTEGER | NOT NULL, FK→t_SEAT | 予約座席 |
| f_price_category_id | INTEGER | NOT NULL, FK→t_PRICE_CATEGORY | 料金区分 |
| f_ticket_price | INTEGER | NOT NULL | 予約確定時の金額スナップショット（税込・円） |

UNIQUE制約: `(f_reservation_id, f_seat_id)`（同予約での同一座席の重複防止）

---

### t_TICKET（チケット）

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_ticket_id | SERIAL | PK | チケットID |
| f_detail_id | INTEGER | NOT NULL, UNIQUE, FK→t_RESERVATION_DETAIL | 対応明細（1明細=1チケット） |
| f_qr_code | VARCHAR(500) | NOT NULL, UNIQUE | 入場用QRコード（UUID v4等） |
| f_ticket_status | SMALLINT | NOT NULL, DEFAULT 0, CHECK(0,1,2,3) | 0:未発券 / 1:発券済 / 2:入場済 / 3:無効 |
| f_issued_at | TIMESTAMP | NULL可 | 発券日時 |
| f_used_at | TIMESTAMP | NULL可 | 入場スキャン日時 |

---

### t_SEAT_STOCK（座席在庫）※二重予約防止の要

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_stock_id | SERIAL | PK | 在庫ID |
| f_schedule_id | INTEGER | NOT NULL, FK→t_SCHEDULE | 上映回 |
| f_seat_id | INTEGER | NOT NULL, FK→t_SEAT | 座席 |
| f_stock_status | SMALLINT | NOT NULL, DEFAULT 0, CHECK(0,1,2) | 0:空席 / 1:予約済 / 2:使用不可 |

UNIQUE制約: `(f_schedule_id, f_seat_id)`（← これがDB層での二重予約防止）

---

### t_SLOT（上映枠）※枠方式の中核

スクリーン×日付ごとに固定の「入れ物（枠）」を先に用意し、そこへ映画を割り当てる。
1枠 = 1上映回。掃除時間込みで枠に収まる映画のみ割り当て可能。

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_slot_id | SERIAL | PK | 枠ID |
| f_screen_id | INTEGER | NOT NULL, FK→t_SCREEN | 対象スクリーン |
| f_show_date | DATE | NOT NULL | 対象日 |
| f_slot_order | SMALLINT | NOT NULL | 同一スクリーン・同一日での枠の並び順（1,2,3…） |
| f_start_time | TIME | NOT NULL | 枠の開始時刻 |
| f_duration_min | SMALLINT | NOT NULL | 枠の長さ（分）例：180=3時間 / 240=4時間 |
| f_slot_type | SMALLINT | NOT NULL, DEFAULT 0, CHECK(0,1) | 0:通常枠 / 1:予備枠（振替専用・通常予約を入れない） |

UNIQUE制約: `(f_screen_id, f_show_date, f_slot_order)`

**割り当て可否の判定式**
```
映画の上映時間(f_duration) + 掃除時間  ≤  枠の長さ(f_duration_min)   → 割り当て可
上記を超える（オーバー）                                            → その枠には入れられない
```
- 枠の長さ − (上映時間+掃除時間) = **飽き枠（空き時間）**。従業員の分担・休憩に活用できる。
- 掃除時間の持ち方は運用で選択（下記「掃除時間の扱い」参照）。

---

### t_SCHEDULE_CHANGE_LOG（振替履歴）

機材故障・人的ミス・劇場都合などで上映回の枠／時刻／スクリーンを変えた履歴を残す。

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_change_id | SERIAL | PK | 履歴ID |
| f_schedule_id | INTEGER | NOT NULL, FK→t_SCHEDULE | 対象上映回 |
| f_change_type | SMALLINT | NOT NULL, CHECK(1,2,3,4) | 1:枠振替 / 2:時刻変更 / 3:スクリーン変更 / 4:中止 |
| f_from_slot_id | INTEGER | NULL可, FK→t_SLOT | 変更前の枠 |
| f_to_slot_id | INTEGER | NULL可, FK→t_SLOT | 変更後の枠（中止時はNULL） |
| f_from_start_time | TIME | NULL可 | 変更前の開始時刻 |
| f_to_start_time | TIME | NULL可 | 変更後の開始時刻 |
| f_reason | VARCHAR(255) | NULL可 | 変更理由（機材故障 等） |
| f_changed_by | INTEGER | NULL可 | 操作した管理者（管理者テーブル導入後にFK化） |
| f_changed_at | TIMESTAMP | NOT NULL, DEFAULT NOW | 変更日時 |

---

### t_NOTIFICATION（通知）

振替・時刻/スクリーン変更・中止が発生したとき、その上映回の予約者へ通知する。

| カラム | 型 | 制約 | 説明 |
|--------|----|------|------|
| f_notification_id | SERIAL | PK | 通知ID |
| f_member_id | INTEGER | NULL可, FK→t_MEMBER | 宛先会員（ゲストはNULL、連絡先は予約側で保持する想定） |
| f_reservation_id | INTEGER | NOT NULL, FK→t_RESERVATION | 対象予約 |
| f_type | SMALLINT | NOT NULL, CHECK(1,2,3,4) | 1:枠振替 / 2:時刻変更 / 3:スクリーン変更 / 4:中止 |
| f_message | VARCHAR(500) | NOT NULL | 通知本文 |
| f_is_read | SMALLINT | NOT NULL, DEFAULT 0, CHECK(0,1) | 0:未読 / 1:既読 |
| f_created_at | TIMESTAMP | NOT NULL, DEFAULT NOW | 生成日時 |

---

## 6. 重要な設計ルール

### 二重予約防止（最重要）

`t_SEAT_STOCK` の `(f_schedule_id, f_seat_id)` UNIQUE制約 ＋ `SELECT FOR UPDATE` で防止。

```sql
-- 予約処理（必ずトランザクション内で実行）
BEGIN;

-- 1. 排他ロックを取得（他のトランザクションが同時に取得しようとするとここで待機）
SELECT * FROM t_SEAT_STOCK
    WHERE f_schedule_id = $1
      AND f_seat_id = $2
      AND f_stock_status = 0
    FOR UPDATE;

-- 2. レコードが取得できた場合のみ続行（取得できなければ満席→ロールバック）
UPDATE t_SEAT_STOCK
    SET f_stock_status = 1
    WHERE f_schedule_id = $1 AND f_seat_id = $2;

COMMIT;
```

### 残席数の取得

`t_SCHEDULE.f_status` は手動更新用のフラグ。リアルタイム残席数は必ず集計すること。

```sql
SELECT COUNT(*) AS available
FROM t_SEAT_STOCK
WHERE f_schedule_id = $1 AND f_stock_status = 0;
```

### スケジュール登録時の在庫初期化

スケジュール1件を INSERT したら、即座に全座席分の在庫レコードを作る。

```sql
INSERT INTO t_SEAT_STOCK (f_schedule_id, f_seat_id, f_stock_status)
SELECT $1, f_seat_id, 0
FROM t_SEAT
WHERE f_screen_id = (
    SELECT f_screen_id FROM t_SCHEDULE WHERE f_schedule_id = $1
);
```

### 金額のスナップショット保存

`t_RESERVATION_DETAIL.f_ticket_price` は予約確定時点の金額を保存する。
後から `t_SCREEN_PRICE` が変更されても過去の予約履歴に影響しない。

### ゲスト予約

`t_RESERVATION.f_member_id` は NULL 許可。会員・ゲストを同一テーブルで管理する。
ゲストはJWTなしで予約可能（API側で `member_id = NULL` で INSERT する）。

### 枠方式（スケジュール管理の基本方針）

従来の「開始時刻を1本ずつ手入力して並べる」方式をやめ、**固定枠に映画を割り当てる**方式に変更する。

**狙い**
- 掃除時間を枠の中に必ず収める → **掃除時間のブッキングが起きない**
- 入力は「どの枠にどの映画か」だけ → **DB入力・手入力ミスの削減**
- 枠 −(上映+掃除) の余りが**飽き枠（空き時間）**となり、従業員の分担に活用できる

**運用**
1. 管理者が `t_SLOT` にスクリーン×日付の枠を用意（例：3時間枠×3・4時間枠×1）。
2. 各枠へ映画を割り当てて `t_SCHEDULE` を作成（`f_slot_id` を設定、`f_start_time` は枠からコピー）。
3. 割り当て時に判定式 `f_duration + 掃除時間 ≤ f_duration_min` を必ずチェックし、超える映画は弾く。

#### 掃除時間の扱い（運用で選択）
- **A案（一律定数）**: 全映画で掃除◯分固定とし、判定は `f_duration + 定数 ≤ f_duration_min`。実装が最も簡単。
- **B案（枠に内包）**: 枠の長さ自体を「映画+掃除が収まる前提」で設定し、掃除時間は明示的に持たない。
- 展示・初期実装では **A案（例：20分固定）** を推奨。

#### 予備枠（振替・障害対策）
`t_SLOT.f_slot_type = 1` を**予備枠**として確保しておくと、機材故障・人的ミス等で上映不能になった際に
**空き枠へ映画をスライドさせて上映継続（振替）**できる。予約者ごと別枠へ移せるのが利点。

- スクリーン数が少ないため「全時間帯で常時1枠空け」は機会損失が大きい。現実解は次のいずれか：
  - 振替可能性の高い（飽き枠の多い）映画だけ予備枠に入れる
  - 特定時間帯のみ予備枠にする
- 予備枠には**通常の予約を入れない**（API側で `f_slot_type = 1` を予約対象から除外）。

#### 振替と通知の流れ
```
1. 管理者が振替操作（枠・時刻・スクリーンの変更、または中止）
   └ t_SCHEDULE.f_slot_id / f_start_time / f_screen_id を更新
2. t_SCHEDULE_CHANGE_LOG に変更前後を記録（監査・トラブル対応用）
3. 対象 t_SCHEDULE に紐づく t_RESERVATION を抽出
4. 各予約者へ t_NOTIFICATION を生成（枠振替/時刻変更/スクリーン変更/中止）
5. 通知手段：メール／PWAプッシュ／スマホ予約画面の通知表示
```
- 展示デモ想定：**管理者が振替 → 予約者スマホに「上映時刻/スクリーンが変わりました」が届く**様子を見せる。
- 座席は枠単位で移せるため、振替時は移動先枠の `t_SEAT_STOCK` を初期化して座席を割り当て直す。

---

## 7. ステータスコード一覧

| テーブル | カラム | 値 |
|----------|--------|----|
| t_MOVIE | f_is_showing | `0`:終映 / `1`:上映中 |
| t_SCHEDULE | f_status | `0`:販売中 / `1`:満席 / `2`:中止 |
| t_RESERVATION | f_payment_method | `1`:クレジットカード / `2`:QR決済 / `3`:窓口 |
| t_RESERVATION | f_payment_status | `0`:未払 / `1`:支払済 / `2`:返金済 |
| t_RESERVATION | f_reservation_status | `0`:予約中 / `1`:発券済 / `2`:キャンセル |
| t_TICKET | f_ticket_status | `0`:未発券 / `1`:発券済 / `2`:入場済 / `3`:無効 |
| t_SEAT_STOCK | f_stock_status | `0`:空席 / `1`:予約済 / `2`:使用不可 |
| t_SLOT | f_slot_type | `0`:通常枠 / `1`:予備枠（振替専用） |
| t_SCHEDULE_CHANGE_LOG | f_change_type | `1`:枠振替 / `2`:時刻変更 / `3`:スクリーン変更 / `4`:中止 |
| t_NOTIFICATION | f_type | `1`:枠振替 / `2`:時刻変更 / `3`:スクリーン変更 / `4`:中止 |
| t_NOTIFICATION | f_is_read | `0`:未読 / `1`:既読 |

---

## 8. セキュリティ注意事項

### パスワード
- `f_password` は必ずアプリ層で **bcrypt**（コスト係数 10 以上推奨）でハッシュ化してから INSERT する
- 生パスワードは絶対に保存しない・ログに出力しない

### JWT
- 秘密鍵は環境変数 `JWT_SECRET` で管理する（コードにハードコード禁止）
- 有効期限（`exp`）は24時間程度に設定する
- トークンはクライアント側で `httpOnly Cookie` に保存するのが推奨（XSS対策）

### QRコード
- `f_qr_code` は **UUID v4**（`github.com/google/uuid`）等の推測困難な値を使用する
- 連番や予約IDをそのまま使わない

### DB接続情報
- ホスト・ユーザー・パスワードは環境変数で管理する
- コード・リポジトリにハードコードしない

```bash
# .env（gitignoreに追加すること）
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hal_cinema
DB_USER=hal_user
DB_PASSWORD=xxxxxx
JWT_SECRET=xxxxxx
```

---

## 9. セットアップ手順

```bash
# 1. PostgreSQLにデータベースを作成
createdb hal_cinema

# 2. スキーマ（DDL）を流す
psql hal_cinema < schema.sql

# 3. 接続確認
psql -d hal_cinema -c "\dt"
```

### 接続情報

| 項目 | 値 |
|------|----|
| host | localhost |
| port | 5432 |
| database | hal_cinema |
| user | 環境変数 `DB_USER` |
| password | 環境変数 `DB_PASSWORD` |

---

## 変更記録

| 日付 | 内容 | 担当 |
|------|------|------|
| 2026-06-23 | DATABASE.md 初版作成（テーブル定義・JWT説明・アーキテクチャ） | Claude Code |
| 2026-07-10 | 枠方式へ移行する設計を追加（t_SLOT / t_SCHEDULE_CHANGE_LOG / t_NOTIFICATION、予備枠・振替・通知の運用ルール、t_SCHEDULE に f_slot_id 追加） | Claude Code |
