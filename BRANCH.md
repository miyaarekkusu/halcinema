# ブランチ運用ルール（main / develop / feat）

halcinema チームのブランチの使い分けです。**作業を始める前に一度読んでください。**
Git の操作で困ったときは [GitHub.md](GitHub.md) を見てください。

---

## 1. 全体図

```
main        … サーバーで動かす本番版（Vercel ＋ fly.io ＋ Supabase）
  ↑  動作確認が終わったら代表者がマージ
develop     … 全員の実装を集める場所。自分のPCだけで全部動く（Docker）
  ↑  機能ができたらPRでマージ
feat/xxx    … 個人の作業ブランチ（1機能＝1ブランチ）
```

| ブランチ | 何のため | どこで動く | 誰が触る |
|---------|---------|-----------|---------|
| `main` | 本番。展示・提出で見せるもの | **サーバー**（フロント：Vercel／API：fly.io／DB：Supabase） | 代表者がマージするだけ。**直接 push 禁止** |
| `develop` | 全員の実装をまとめて動作確認する | **自分のPC**（Docker の DB＋API ＋ Live Server） | PR でマージ。**直接 push 禁止** |
| `feat/xxx` | 自分の作業 | 自分のPC | 作った本人 |

> **ポイント**：`develop` は「サーバーが無くても、自分のPCだけで最初から最後まで動く」状態を保つ。
> だから各自が自分のPCで仮実装・動作確認できる。

---

## 2. 最初に一回だけやること（環境づくり）

### 必要なもの

- Git
- Docker Desktop（DB と API を自分のPCの中で動かすため）
- VS Code ＋ 拡張機能「Live Server」

### 手順

```bash
# 1. リポジトリを取ってくる（まだの人だけ）
git clone https://github.com/miyaarekkusu/halcinema.git
cd halcinema

# 2. develop ブランチに切り替える
git fetch origin
git switch develop

# 3. 環境変数ファイルを作る（中身は .env.example のままでOK）
cp .env.example .env

# 4. DB と API を起動
docker compose up -d

# 5. 動いているか確認（{"status":"ok"} のような返事が来ればOK）
curl http://localhost:8080/api/health
```

6. VS Code で `html/index.html` を右クリック →「Open with Live Server」
7. ブラウザで `http://localhost:5500/html/index.html` が開けば完了

> `js/config.js` が自動で判定するので、`localhost` で開くと **自分のPCの API（localhost:8080）** につながる。
> サーバー用の設定を書き換える必要はない。

---

## 3. 毎日の作業の流れ

### ① 作業ブランチを作る（develop から）

```bash
git switch develop
git pull                          # 最新の develop を取る
git switch -c feat/admin-movies   # 自分の作業ブランチを作る
```

**ブランチ名のつけ方**

| 頭につける | 使うとき | 例 |
|-----------|---------|-----|
| `feat/` | 新しい機能 | `feat/admin-auth`、`feat/admin-sales` |
| `fix/` | バグ修正 | `fix/seat-double-booking` |
| `docs/` | ドキュメントだけ | `docs/branch-guide` |
| `assets/` | 画像・動画などの素材追加 | `assets/cinema-ads` |

半角英小文字とハイフンだけ（日本語・スペース禁止）。

### ② 作業してコミット・push

```bash
git add 変更したファイル
git commit -m "作品一覧画面を追加"
git push -u origin feat/admin-movies   # 2回目からは git push だけでOK
```

### ③ PR（プルリクエスト）を出す — **向き先は develop**

1. GitHub を開くと「Compare & pull request」ボタンが出るので押す
2. **`base:` を `develop` にする**（`main` になっていたら必ず変える）
3. 何を作ったかを書いて「Create pull request」
4. 誰か1人に見てもらってからマージ

### ④ マージされたら

```bash
git switch develop
git pull
git branch -d feat/admin-movies   # 終わったブランチは消してOK
```

---

## 3.5 素材（広告画像・動画など）を追加するとき

コードを書かない素材の追加も、同じく **develop からブランチを切って PR** で入れる。

```bash
git switch develop
git pull
git switch -c assets/cinema-ads        # 何の素材か分かる名前にする
# 素材をフォルダに置く
git add images/ads/
git commit -m "映画館の広告画像を追加"
git push -u origin assets/cinema-ads
```

→ PR は **`develop` に向けて** 出す。

| ルール | 内容 |
|-------|------|
| 置き場所 | 画像は `images/`、動画は `video/`。広告など種類ごとにフォルダを分ける（例：`images/ads/`） |
| ファイル名 | 半角英小文字・数字・ハイフンのみ（例：`ad-popcorn-campaign.png`）。日本語・スペース・大文字は使わない |
| サイズ | 画像は 1 枚 1MB 以内を目安（大きいものは圧縮してから）。動画は 50MB 以内 |
| 形式 | 画像は `.png` / `.jpg` / `.webp`、動画は `.mp4` |
| 出典 | 自作でない素材は、PR の説明に出典・利用条件を書く |

> GitHub は 1 ファイル 100MB を超えると push できない。大きい動画は事前に相談。

---

## 4. develop → main（本番に出す）

代表者がやる作業です。

1. `develop` を自分のPCで起動し、**一通りの流れ**（ログイン → 予約 → 決済 → 管理画面）が動くことを確認
2. GitHub で `develop` → `main` の PR を作る
3. マージ後、サーバー側を更新
   - フロント：Vercel が `main` から自動で更新（されない場合は Vercel の画面から Redeploy）
   - API：`backend/` で `fly deploy`
   - DB：`schema.sql` を変えた場合は Supabase にも同じ変更を流す

> サーバーの設定値（Supabase の接続先など）は **サーバー側にだけ** 置く。リポジトリには入れない。

---

## 5. 「自分のPCだけで動く」ための約束

`develop` を壊さないためのルールです。

| ルール | 理由 |
|-------|------|
| DB のテーブル・初期データは **`schema.sql` に書く** | 全員の Docker が同じ DB から始まるように |
| `schema.sql` を変えたら PR に **「DBリセット必要」** と書く | Docker は最初の1回しか `schema.sql` を読まないため（下の「DBを作り直す」参照） |
| 外部サービス（AIのAPIキー等）が無くても **画面が落ちない** ようにする | キーを持っていないメンバーのPCでも動くように |
| `.env` は **絶対にコミットしない** | パスワードやAPIキーが漏れる |
| サーバー専用の設定は `main` 側だけで扱う | `develop` に入れると自分のPCで動かなくなる |

### DB を作り直す（schema.sql が変わったとき）

```bash
docker compose down -v      # -v で DB の中身ごと消す（自分のPCのテストデータは消える）
docker compose up -d --build
```

---

## 6. よくある困りごと

### PR の向き先を main にしてしまった

PR 画面のタイトル横の「Edit」→ `base` を `develop` に変えて保存。作り直さなくてよい。

### main や develop に直接コミットしてしまった（まだ push していない）

```bash
git switch -c feat/逃がし先の名前   # 今のコミットを新しいブランチに逃がす
git switch develop
git reset --hard origin/develop     # develop を元に戻す
```

その後、逃がしたブランチから PR を出す。
**push してしまった場合は自分で直さず、代表者に連絡。**

### 自分の作業ブランチが古くなった（develop が進んだ）

```bash
git switch develop
git pull
git switch feat/自分のブランチ
git merge develop       # 衝突したら GitHub.md の「マージの衝突」を見る
```

### Docker が起動しない／API につながらない

- Docker Desktop が起動しているか確認
- `docker compose ps` で `halcinema_db` と `halcinema_api` が `running` か確認
- `docker compose logs api` でエラーを見る
- 詳しくは `note/docker.txt`

---

## 7. まとめ（これだけ覚える）

1. 作業は **`develop` から `feat/xxx` を作って** やる
2. PR は **`develop` に向けて** 出す
3. `main` と `develop` には **直接 push しない**
4. `develop` は **自分のPCだけで動く** 状態を保つ
5. `main` に出すのは **代表者** が動作確認してから
