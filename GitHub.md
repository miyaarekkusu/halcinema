# GitHub 操作トラブルシューティング

Git / GitHub で困ったときの対処法をまとめたページです。
状況に合わせて該当する項目を確認してください。

---

## 目次

1. [画像・ファイルが表示されない](#1-画像ファイルが表示されない)
2. [古いバージョンになっている（最新が反映されない）](#2-古いバージョンになっている最新が反映されない)
3. [git pull ができない](#3-git-pull-ができない)
4. [マージの衝突（コンフリクト）が起きた](#4-マージの衝突コンフリクトが起きた)
5. [その他よくある操作](#5-その他よくある操作)

---

## 1. 画像・ファイルが表示されない

### 症状

- ブラウザで画像が表示されず「🖼️ 壊れたアイコン」が出る
- 自分の PC では見えるのに他の人の環境では見えない

---

### 原因 A：画像ファイルが push されていない

自分が追加した画像ファイルを `git add` → `commit` → `push` し忘れているケースが最多。

**確認方法：**

```bash
git status
```

`Untracked files:` や `Changes not staged for commit:` に画像ファイルが表示されていたら未 push。

**対処法：**

```bash
# 画像ファイルを追加してコミット・プッシュ
git add images/ファイル名.png
git commit -m "画像を追加"
git push
```

> `git add images/` とするとフォルダ内を一括追加できます。

---

### 原因 B：ファイル名の大文字・小文字が違う

Windows は `Logo.png` と `logo.png` を同じファイルとして扱いますが、GitHub（Linux）は別ファイルとして区別します。

**対処法：**

HTML 内のパスと実際のファイル名を一致させる。
ファイル名はすべて**小文字・半角英数字・ハイフン**で統一するのが安全。

```
❌ Images/Logo_HAL.PNG
✅ images/logo_hal.png
```

---

### 原因 C：ファイルパスが間違っている

`html/` フォルダ内の HTML から画像を参照する場合、パスは `../images/` から始まります。

```html
<!-- ❌ 間違い -->
<img src="images/logo.png">
<img src="/images/logo.png">

<!-- ✅ 正しい -->
<img src="../images/logo.png">
```

---

### 原因 D：pull していない（他の人が push した画像を取得していない）

```bash
git pull
```

を実行して最新ファイルをローカルに取り込んでください。

---

## 2. 古いバージョンになっている（最新が反映されない）

### 症状

- GitHub 上は最新なのに手元のファイルが古いまま
- 他の人が直した箇所が自分の環境に反映されていない

---

### 対処法 ①：まず pull する

```bash
git pull
```

これが最初にすべきこと。他の人の変更を取り込みます。

---

### 対処法 ②：ブラウザのキャッシュをクリアする

Live Server を使っていてもブラウザが古い CSS・JS を読み込んでいることがあります。

| OS | ショートカット |
|----|--------------|
| Windows | `Ctrl + Shift + R` または `Ctrl + F5` |
| Mac | `Cmd + Shift + R` |

---

### 対処法 ③：自分の変更を退避してから pull する

自分が編集中のファイルがあって pull できない場合：

```bash
# 変更を一時退避（スタッシュ）
git stash

# 最新を取得
git pull

# 退避した変更を戻す
git stash pop
```

---

### 対処法 ④：どのコミットかを確認したい

```bash
# 最近のコミット一覧を表示
git log --oneline -10
```

特定のコミットに戻したい場合は担当者に相談してください（履歴が消えるリスクがあるため）。

---

## 3. git pull ができない

### エラー例 A：ローカルに未コミットの変更がある

```
error: Your local changes to the following files would be overwritten by merge
```

**対処法：**

```bash
# パターン 1：変更をコミットしてから pull
git add .
git commit -m "作業中の変更を保存"
git pull

# パターン 2：変更を退避してから pull（後で戻せる）
git stash
git pull
git stash pop

# パターン 3：変更を捨てて pull（注意：変更が消えます）
git checkout -- .
git pull
```

> パターン 3 は**変更が完全に消えます**。大事な変更がある場合は使わないでください。

---

### エラー例 B：upstream が設定されていない

```
There is no tracking information for the current branch.
```

**対処法：**

```bash
git pull origin main
```

または、最初にブランチのリモート追跡を設定：

```bash
git branch --set-upstream-to=origin/main main
git pull
```

---

### エラー例 C：認証エラー（パスワード・トークンが通らない）

```
remote: Support for password authentication was removed
```

GitHub は 2021 年以降パスワード認証を廃止しました。**Personal Access Token (PAT)** が必要です。

**対処法：**

1. GitHub → Settings → Developer settings → Personal access tokens → Generate new token
2. スコープは `repo` にチェック
3. 生成されたトークンをパスワードの代わりに入力

または **GitHub Desktop** アプリや **VS Code の Git 連携**を使うとトークン不要で楽です。

---

### エラー例 D：リモートの URL が違う

```
fatal: repository 'https://...' not found
```

**確認方法：**

```bash
git remote -v
```

リモートの URL を修正：

```bash
git remote set-url origin https://github.com/ユーザー名/halcinema.git
```

---

## 4. マージの衝突（コンフリクト）が起きた

### 症状

```
CONFLICT (content): Merge conflict in html/xxx.html
Automatic merge failed; fix conflicts and then commit the result.
```

同じファイルの同じ箇所を 2 人が別々に編集してしまったときに発生します。

---

### 手順

**Step 1：衝突しているファイルを確認する**

```bash
git status
```

`both modified:` と表示されているファイルが衝突箇所です。

---

**Step 2：衝突箇所を編集して解消する**

衝突したファイルを開くと以下のようなマーカーが入っています：

```
<<<<<<< HEAD
自分の変更内容
=======
相手の変更内容
>>>>>>> origin/main
```

- `<<<<<<< HEAD` ～ `=======` が**自分の変更**
- `=======` ～ `>>>>>>> origin/main` が**相手の変更**

どちらを残すか（または両方を組み合わせるか）を判断して、マーカー行（`<<<<<<<`・`=======`・`>>>>>>>`）ごと消して編集します。

**例：**

```html
<!-- 衝突前（編集後） -->
<h1>HAL CINEMA フード選択</h1>
```

---

**Step 3：解消後にコミットする**

```bash
# 解消したファイルをステージングに追加
git add html/xxx.html

# コミット（メッセージは自動でマージ内容になる）
git commit
```

---

### 衝突を予防するコツ

- 作業前に必ず `git pull` する
- 担当ページを決めて**同じファイルを複数人で同時編集しない**
- こまめに `push` する（差が開くほど衝突しやすくなる）
- 大きな変更は**ブランチを切って PR（プルリクエスト）**で取り込む

---

## 5. その他よくある操作

### 直前のコミットをやり直したい

```bash
# コミットメッセージだけ直す（push前のみ）
git commit --amend -m "正しいメッセージ"
```

---

### 間違えて add したファイルを取り消したい

```bash
git restore --staged ファイル名
```

---

### 間違えて commit したものを取り消したい（push前）

```bash
# コミットを取り消してファイルの変更は残す
git reset --soft HEAD~1

# コミットもファイルの変更も取り消す（注意：変更が消えます）
git reset --hard HEAD~1
```

---

### 現在の状態を確認したい

```bash
# 変更されているファイル一覧
git status

# 変更内容の差分
git diff

# コミット履歴
git log --oneline -10
```

---

### ブランチを作って作業したい

```bash
# ブランチを作成して切り替え
git checkout -b feature/ページ名

# 作業後に push
git push -u origin feature/ページ名
```

その後 GitHub 上でプルリクエスト（PR）を作成してレビューしてもらいます。

---

> 上記で解決しない場合は担当者（またはチャットなど）に状況を共有してください。
> `git status` と `git log --oneline -5` の出力を貼ると原因特定が速くなります。
