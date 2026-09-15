# ホーム画面リニューアル計画（レコメンド型ホーム）

- 担当: 岡本
- ブランチ: `feat/recommend-home`（`fix/movie-images` から分岐）
- 作成日: 2026-09-08

---

## 0. 今回の方針（決定済み）

| 項目 | 決定 |
|------|------|
| 作業範囲 | **フロント先行（モック）**。まず既存の `/api/movies` だけで画面を作り、足りないデータはダミー値。API追加は後追い |
| おすすめのロジック | **お気に入りベース**（予約履歴を補助的に加算）。手がかりが無いときは人気順ではなく案内文を出す（ランキングと内容がかぶるため） |
| 「映画情報追加」の意味 | **作品データを増やす**（`schema.sql` のシードに作品・ポスター・予告編を追記） |

---

## 1. 着手前に知っておくこと（現状把握）

### 1-1. データの流れ

`html/index.html` と `html/movies.html` は **Go API から fetch している**。

```
html/index.html  ──fetch──▶  http://localhost:8080/api/movies  ──▶  PostgreSQL (t_movie + t_movie_image)
html/movies.html ──fetch──▶  同上
```

- **`data/movies.json` はもう使われていない**（DB移行前の旧データ。残骸なので参照しないこと）
- 描画ロジックは HTML の中に `<script>` で直書きされている

### 1-2. 使える既存API

| メソッド | パス | 返すもの | 認証 |
|---|---|---|---|
| GET | `/api/movies` | 全作品。`?showing=1` で上映中のみ | 不要 |
| GET | `/api/movies/{id}` | 作品1件 | 不要 |
| GET | `/api/schedules` | 上映スケジュール。`?movieId=` で絞り込み | 不要 |
| GET | `/api/schedules/{id}/seats` | 座席状況 | 不要 |
| POST | `/api/reservations` | 予約作成 | 任意 |
| GET | `/api/me/reservations` | 自分の予約一覧 | 必要 |
| GET/POST/DELETE | `/api/me/cards` | 支払カード | 必要 |

`/api/movies` のレスポンス（1件）:

```json
{
  "movieId": 1, "title": "ゴジラ-1.0", "titleEn": "GODZILLA MINUS ONE",
  "genre": "アクション / SF", "duration": 120, "rating": "G",
  "releaseDate": "2026-05-01", "director": "山崎 貴", "cast": "神木隆之介、...",
  "synopsis": "...", "formats": ["字幕","吹替"], "isShowing": 1,
  "imageUrl": "images/poster/godzilla-minus-one.jpg", "trailerId": "x7ythIm0834"
}
```

> `imageUrl` は `images/...` の相対パスなので、`html/` からは `'../' + m.imageUrl` で参照する（既存コードと同じ）。

### 1-3. DBの状況（`schema.sql` / `DATABASE.md`）

- `t_MOVIE.f_genre` は **VARCHAR(50) の自由文字列**。`"アニメ / ファミリー"` のように **複数ジャンルが1カラムに詰まっている**
  → カテゴリー絞り込みは「` / ` で分割して扱う」か「ジャンルマスタを作る」かの判断が必要（→ 5章）
- **お気に入りテーブルは存在しない**（新規に `t_FAVORITE` が必要）
- ランキングに使うテーブルは揃っている：`t_RESERVATION` × `t_RESERVATION_DETAIL` × `t_SCHEDULE`
- 作品シードは現在 **11本**（上映中6 / 上映予定5）。ポスターは `images/poster/` に11枚
- 注意：`DATABASE.md` には `t_SLOT` / `t_SCHEDULE_CHANGE_LOG` / `t_NOTIFICATION` が載っているが **`schema.sql` には未反映**（枠方式の続き。今回の範囲外）

### 1-4. フロントの現状

- `css/index.css` の `.movie-row-scroll` は **名前に反して `grid-template-columns: repeat(6, 1fr)` の6列グリッド**。横スクロールしていない
  → 横スクロール行にするならここを直すのが最初の一歩
- `posterTag()` / `comingDateLabel()` / カード生成関数が **index.html と movies.html にコピペで重複**している
- ログイン状態は `localStorage` の `hal_token`（JWT）と `hal_member`
- 予約フローは `sessionStorage` の `halcinema_seats` / `reservationData` / `latestTicket`

---

## 2. 共通の下ごしらえ（タスク1の前にやると後が全部ラクになる）

- [x] **A. `js/movie-card.js` を新規作成**
      `posterTag()` / `comingDateLabel()` / `buildMovieCard()` を移し、
      `index.html` と `movies.html` のインライン重複を削除する
- [x] **B. `js/api.js` を新規作成**
      `API_BASE`、`fetchJSON()`、`authHeaders()`（`hal_token` を Bearer で付与）、`isLoggedIn()` をまとめる
- [x] **C. 横スクロール行のCSSを直す**
      `css/index.css` の `.movie-row-scroll` を `display:flex; overflow-x:auto; scroll-snap-type:x mandatory;` に変更。
      左右の矢印ボタンとホバー拡大を追加（この行の見せ方が肝）
- [x] **D. ジャンル正規化ユーティリティ**
      `splitGenres("アニメ / ファミリー") → ["アニメ","ファミリー"]` を `js/movie-card.js` に置く。タスク3で使う

---

## 3. タスク一覧（優先順）

### 優先1 — おすすめ映画（お気に入りベース）

> **2026-09-15 追記（Claude Code）**：一度「AIチャットボットと同じ手がかり（予約実績・
> 閲覧履歴・AIおすすめ履歴）」に変更したが、その後ユーザー指示によりホームの
> 「あなたへのおすすめ」セクション自体を削除した。`js/recommend.js`は削除、
> `html/index.html`の`#section-recommend`・`js/home.js`のrenderRecommend()も削除済み。
> `section-favorite`（お気に入り一覧行）は影響を受けず維持。
> 経緯はAGENTS.mdの変更記録（2026-09-15）を参照。以下は当時の計画として残す。

**ゴール**：お気に入りに登録したジャンルに近い作品を「あなたへのおすすめ」行に出す。

- [x] ホームに `#recommend-list` セクションを追加（ヒーローのすぐ下、ランキングの上）
- [x] お気に入り作品のジャンルを集計する（主な手がかり）
- [x] ログイン中は `GET /api/me/reservations` の予約履歴も弱めに足す（補助）
- [x] 一致度の高い順に **上映中・公開予定の両方** を並べる（同点なら予約できる上映中が先）
- [x] お気に入り・予約済みの作品はおすすめから除外する
- [x] 手がかりが無いときは **案内文を出す**（人気順を出すとランキングと内容がかぶるため）
- [x] 見出しの横に理由を出す（例：「お気に入りの「アニメ」に近い作品」）
- [x] ハートを押した瞬間におすすめ行を作り直す

**重みづけ**

| 手がかり | 重み | 理由 |
|---|---|---|
| お気に入り | 2 | 自分でハートを押した作品。好みをはっきり表している |
| 予約履歴 | 1 | 付き合いで観た作品もあるので弱め |

**手がかりが無いときの表示**

行ごと消すと機能に気づいてもらえないので、案内文だけ置く：

```
あなたへのおすすめ
────────────────────────────
お気に入りに登録すると、そのジャンルに近い作品をここにおすすめします。
作品一覧から探す →
```

**モック時の割り切り**

- お気に入りは `localStorage`（→ 優先2）。API化すればそのまま `t_FAVORITE` に乗る
- `/api/me/reservations` は **`movieTitle` しか返さず `movieId` も `genre` も無い**
  → 予約履歴側はタイトル文字列で `/api/movies` と突き合わせてジャンルを引いている
- `index.html?mock=1` でログインなしでもおすすめ行を確認できる（アニメ2本をお気に入り登録した想定）

**本実装（API追加）でやること**

- `/api/me/reservations` のSELECTに `m.f_movie_id` と `m.f_genre` を足す（`backend/internal/reservations/handler.go` の `ListMine`）
- または `GET /api/me/recommendations` を新設してサーバー側で完結させる

**完了条件**：ハートを1つ押すと、その場でおすすめ行が現れて同ジャンルの作品が並ぶ。

---

### 優先2 — お気に入り映画

**ゴール**：作品カード／詳細ページでハートを押すと登録され、ホームに「お気に入り」行が出る。

- [x] カードのポスター右上にハートボタンを追加（`movie-card` に重ねる）
- [x] `html/movie-detail.html` にもお気に入りボタンを追加
- [x] ホームに `#favorite-list` セクションを追加（0件のときは行ごと非表示）
- [x] マイページにお気に入り一覧タブを追加
- [x] 未ログインで押したときの挙動を決める（→ ログイン誘導 or ローカル保存のまま）

**モック時の割り切り**

- `localStorage` の `hal_favorites`（`movieId` の配列）で保存する
- API化のときそのまま移行できるよう、読み書きは `js/favorites.js` の関数越しにだけ行う

**本実装（API追加）でやること**

```sql
-- schema.sql に追加
CREATE TABLE t_FAVORITE (
    f_favorite_id  SERIAL     PRIMARY KEY,
    f_member_id    INTEGER    NOT NULL REFERENCES t_MEMBER (f_member_id) ON DELETE CASCADE,
    f_movie_id     INTEGER    NOT NULL REFERENCES t_MOVIE  (f_movie_id)  ON DELETE CASCADE,
    f_created_at   TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_favorite UNIQUE (f_member_id, f_movie_id)
);
CREATE INDEX idx_favorite_member ON t_FAVORITE (f_member_id);
```

- `GET /api/me/favorites` / `POST /api/me/favorites` / `DELETE /api/me/favorites/{movieId}`（すべて `jwtMiddleware`）
- `backend/internal/favorites/handler.go` を新規作成し、`backend/cmd/api/api.go` にルート追加

**完了条件**：ハートの状態がリロード後も保持され、ホームとマイページの両方に反映される。

---

### 優先3 — 作品一覧のカテゴリー絞り込み

**ゴール**：作品一覧でジャンルによる絞り込みができる。

- [x] `splitGenres()` で全作品のジャンルを集計する（`" / "` 区切りを分解）
- [x] ~~ホームにジャンル行を動的生成~~ → **不要と判断して取りやめ**（行が増えすぎてホームが間延びするため。ジャンルで探したい人は作品一覧へ）
- [x] `html/movies.html` の既存フィルタータブ（上映中／上映予定）の**下にジャンルチップ列**を追加
- [x] 「上映中」×「アニメ」のように **2軸の絞り込みが同時に効く**ようにする
- [x] URLに `?genre=アニメ` を残して共有・リロードできるようにする
- [x] 0件のときのメッセージを出す

**現状のジャンル値（シード11本）**

```
アクション / SF、アニメ / ミステリー、アニメ / スポーツ、アニメ / ファンタジー、
アニメ / ファミリー、ドラマ / コメディ、コメディ / ドラマ、伝記 / ドラマ / ミュージカル、ドラマ
```

→ ` / ` 分割で `アクション, SF, アニメ, ミステリー, スポーツ, ファンタジー, ファミリー, ドラマ, コメディ, 伝記, ミュージカル` の11種になる。
→ 表記ゆれ（`ドラマ / コメディ` と `コメディ / ドラマ`）があるので、**分割してから集合として扱えば吸収できる**。

**完了条件**：作品一覧で上映状況とジャンルの絞り込みが同時に効き、URLで共有できる。

---

### 優先4 — 座席の予約数で本日のランキング

**ゴール**：ホームに「本日のランキング TOP5」を1〜5位のバッジ付きで出す。

- [x] ホームに `#ranking-list` セクションを追加
- [x] 大きい順位数字を重ねたランキング専用カードのCSSを作る
- [x] 同数のときの並び順を決める（→ 公開日が新しい順を推奨）

**モック時の割り切り**

- `/api/schedules` に本日の上映回はあるが **予約数は返ってこない**
  → モック段階は作品ごとに固定のダミー予約数を持たせて表示だけ作る
- ダミー値は `js/` の一箇所にまとめ、API接続時にそこだけ差し替える

**本実装（API追加）でやること** — `GET /api/movies/ranking?date=today`

```sql
SELECT m.f_movie_id, m.f_title, COUNT(rd.f_detail_id) AS seat_count
FROM t_reservation_detail rd
JOIN t_reservation r ON r.f_reservation_id = rd.f_reservation_id
JOIN t_schedule    s ON s.f_schedule_id    = r.f_schedule_id
JOIN t_movie       m ON m.f_movie_id       = s.f_movie_id
WHERE s.f_show_date = CURRENT_DATE
  AND r.f_reservation_status <> 2   -- キャンセルを除外
GROUP BY m.f_movie_id, m.f_title
ORDER BY seat_count DESC, m.f_release_date DESC
LIMIT 5;
```

> 「座席の予約数」なので、予約件数ではなく **`t_RESERVATION_DETAIL` の行数（＝座席数）** を数えるのが正しい。

**完了条件**：展示当日に予約が入ると順位が動く（API接続後）。

---

### 優先5 — 映画情報追加

**ゴール**：作品数を増やして、カテゴリー行とランキングが「スカスカに見えない」状態にする。

- [ ] 現在11本 → **各ジャンルが3本以上になる本数**まで追加（目安20本前後）
- [ ] `schema.sql` の `INSERT INTO t_MOVIE ...` に追記
- [ ] ポスター画像を `images/poster/` に追加（ファイル名は英小文字ハイフン区切り）
- [ ] `INSERT INTO t_MOVIE_IMAGE ...` に追記し、`f_image_id` の紐付けまで通す
- [ ] `f_trailer_id`（YouTubeの動画ID）も入れる
- [ ] `docker compose down -v && docker compose up -d --build` で作り直して反映確認

**注意**

- `f_genre` は既存の表記に合わせる（前後スペース入りの ` / ` 区切り）
- ポスター未設定でも落ちない実装済み（`onPosterError` でプレースホルダー）だが、行が空っぽに見えるので極力用意する

---

## 4. 完成後のホーム画面の並び（案）

```
┌─ ヒーロー（Three.js 3Dシアター）─────────────┐
├─ あなたへのおすすめ         ← 優先1（お気に入りベース。手がかりが無ければ案内文）
├─ 本日のランキング TOP5      ← 優先4
├─ お気に入り                ← 優先2（0件なら非表示）
├─ 上映中                    ← 既存
├─ 上映予定                  ← 既存
└─ 劇場からのお知らせ          ← 既存
```

---

## 5. 決定事項

1. **ジャンルの持ち方**：**`f_genre` の文字列分割で進める**
   管理画面から映画を登録する段になったら `t_GENRE` + `t_MOVIE_GENRE` のマスタ化を検討する
2. **未ログインでお気に入りを押したとき**：**ログインへ誘導する**
   確認ダイアログ →「はい」で `login.html?redirect=元のページ` へ。未ログイン中は保存しない
3. **おすすめの見出し文言**：**「あなたへのおすすめ」で固定**
   ジャンル名は見出しではなく、その横の理由テキストに出す（例「アニメをよく観ているあなたに」）
4. **ランキングの集計範囲**：**本日の上映回の座席数**（`s.f_show_date = CURRENT_DATE`）
5. **`data/movies.json` の扱い**：**残す**。ただし参照はしない（バックアップ扱い）

---

## 6. 触ったファイル一覧

### 新規

| ファイル | 内容 |
|---|---|
| `js/api.js` | `API_BASE`・`fetchJSON`・認証ヘッダ・ログイン状態（`HalAPI`） |
| `js/ui.js` | トースト、横スクロール行の左右矢印（`HalUI`） |
| `js/favorites.js` | お気に入りの読み書き・ログイン誘導（`HalFav`） |
| `js/movie-card.js` | カードHTML生成、ジャンル分割・集計（`HalMovie`） |
| `js/ranking.js` | 本日のランキング。今はダミー座席数（`HalRanking`） |
| `js/recommend.js` | お気に入りのジャンルからのおすすめ（`HalRecommend`）。予約履歴も弱めに加算。出せなければ null |
| `js/home.js` | トップページの行の組み立て |
| `js/movies.js` | 作品一覧の2軸絞り込み |
| `js/mypage-favorites.js` | マイページのお気に入りタブ |
| `css/movie-card.css` | カード共通スタイル（横スクロール・矢印・ハート・順位・チップ・トースト） |

### 変更

| ファイル | 内容 |
|---|---|
| `html/index.html` | おすすめ・ランキング・お気に入りのセクション追加。インラインJS約56行を削除して共通JSに差し替え |
| `html/movies.html` | ジャンルチップの器を追加。インラインJS約70行を削除 |
| `html/movie-detail.html` | 死んでいた「お気に入りに追加」リンクをボタン化して接続 |
| `html/mypage.html` | お気に入りタブとパネルを追加 |
| `css/index.css` | 横スクロール行とポスターのスタイルを `movie-card.css` へ移動 |

### まだ触っていない（API化のとき）

| ファイル | 内容 |
|---|---|
| `schema.sql` | `t_FAVORITE` 追加、作品シード追記（優先5） |
| `backend/internal/favorites/handler.go` | **新規** お気に入りAPI |
| `backend/internal/movies/handler.go` | ランキングAPI追加 |
| `backend/internal/reservations/handler.go` | `ListMine` に movieId / genre 追加 |
| `backend/cmd/api/api.go` | ルート追加 |

---

## 7. 現在の状態と残り

### 動いていること（実データ11本で確認済み）

- おすすめ行：`?mock=1` で「お気に入りの「アニメ」に近い作品」が4本出る。手がかりが無いときは案内文に切り替わる（ランキングとかぶらない）
- ランキング行：1〜5位の順位数字付きで表示（座席数はダミー）
- お気に入り：カードのハート、詳細ページのボタン、ホームの行、マイページのタブが連動。会員IDごとに保存され、未ログインはログインへ誘導
- 作品一覧のジャンルチップ：アニメ3 / ドラマ2 / SF1 ... と上映状況に応じて自動生成される
- 作品一覧：`?status=coming&genre=アニメ` で上映予定×アニメの3本に絞り込める
- 横スクロール行：ホームの5行すべてに左右矢印。端では矢印が消える

### 残り

1. **優先5 作品データ追加**（未着手）— 現在11本。1本しかないジャンルが多いので、20本前後まで増やすと絞り込みが使えるようになる
2. **API化** — `t_FAVORITE` 追加（おすすめの土台にもなるので最優先） → お気に入りAPI → ランキングAPI → `ListMine` にカラム追加。
   差し替え位置は各JSに `TODO(API化)` コメントで書いてある

### 気づいた別件（今回は触っていない）

- `html/movies.html` のカードは `.movies-grid .movie-card` に `aspect-ratio: 283/400` が効いていて、
  その中の `.movie-card-info`（カード下のタイトル）が `.card { overflow: hidden }` で見切れている可能性がある。
  ホバー時のオーバーレイには出るので実害は小さいが、直すならカードの高さの持ち方から見直しが必要
- `schema.sql;C` という空のフォルダがルートに残っている（コマンドの打ち間違いの残骸と思われる）


作品を足すときの手順だけ置いておきます。schema.sql の3箇所を触ります。

1. 作品本体 — schema.sql:361 の INSERT INTO t_MOVIE に行を足す


('作品タイトル', 'ENGLISH TITLE', 'アクション / SF', 120, 'G', '2026-06-01',
    '監督名', '出演者、出演者、出演者',
    'あらすじ。段落は <br><br> で区切る。',
    '字幕,吹替', 1, 'YouTubeの動画ID'),
f_is_showing は上映中=1・公開予定=0。f_genre は既存に合わせて 前後スペース入りの / 区切りにしてください。ここが揃っていないとジャンルチップが分裂します。

2. ポスター — 画像を images/poster/ に置いて、schema.sql:425 の VALUES に1行足す


('作品タイトル', 'images/poster/your-file.jpg', '作品タイトル ポスター'),
タイトル文字列で1のINSERTと突き合わせているので、1と完全に同じ表記にしてください。ズレると JOIN で落ちてポスターだけ付きません。

3. 反映 — f_image_id の紐付けは schema.sql:441 の UPDATE が全件まとめてやるので、追記は不要です。


docker compose down -v && docker compose up -d --build
-v を忘れるとボリュームが残って初期化SQLが再実行されません。確認は http://localhost:8080/api/movies で件数を見るのが早いです。

狙いどころは、いま1本しかない7ジャンル（アクション / SF / スポーツ / ミステリー / 伝記 / ミュージカル / ファミリー…）です。ここが各3本くらいになると、おすすめの空振りが消えて作品一覧の絞り込みも使えるようになります。

作業内容は note/home-renewal-plan.md の優先5にチェックリストで残してあります。ブランチは feat/recommend-home のまま、コミットはまだしていません。追加が終わってコミットやレビューが必要になったら声をかけてください。