/* ============================================================
   halcinema 管理画面 ローカル開発サーバー（Node.js のみ・追加インストール不要）

   起動：  node tools/admin-dev-server.js
   開く：  http://localhost:5600/html/login.html

   ・リポジトリ全体をそのまま配信する（Live Server の代わり）
   ・管理画面のテストデータを「DBファイル」data/admin/db.json に読み書きする
       - 初回起動時に data/admin/seed.json（テストデータ）をコピーして作る
       - db.json は .gitignore 済み（各自のPCだけのデータ）
   ・API（画面側は admin/admin-data.js から呼ぶ）
       GET  /mock-api/admin/db              … DB全体を返す
       PUT  /mock-api/admin/db/{collection} … その項目をまるごと置き換えて保存
       POST /mock-api/admin/reset           … seed.json の内容に戻す

   ※ ローカル確認専用。develop に上げるときはサーバー（Go API）保存に切り替える
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5600;
const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'data', 'admin', 'seed.json');
const DB = path.join(ROOT, 'data', 'admin', 'db.json');

// 画面から書き換えてよい項目（在庫〜清掃・日次締め・管理者・作品・配給会社・契約・配給精算）。増やすときはここに足す
const WRITABLE = ['goods', 'stock_logs', 'shifts', 'cleaning', 'issues', 'closings', 'admins',
  'movies', 'distributors', 'contracts', 'settlements'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

function loadDb() {
  if (!fs.existsSync(DB)) {
    fs.copyFileSync(SEED, DB);
    console.log('[db] seed.json から db.json を作成しました');
  }
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  // seed.json に後から足した項目（admins など）が db.json に無ければ補う
  const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  const missing = Object.keys(seed).filter(k => !(k in db));
  if (missing.length) {
    missing.forEach(k => { db[k] = seed[k]; });
    saveDb(db);
    console.log('[db] seed.json から項目を追加しました：' + missing.join(', '));
  }
  return db;
}

function saveDb(db) {
  // 書き込み途中で落ちても壊れないよう、一時ファイルに書いてから置き換える
  const tmp = DB + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1) + '\n');
  fs.renameSync(tmp, DB);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 5 * 1024 * 1024) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === 'GET' && pathname === '/mock-api/admin/db') {
      return sendJson(res, 200, loadDb());
    }
    if (req.method === 'POST' && pathname === '/mock-api/admin/reset') {
      fs.copyFileSync(SEED, DB);
      console.log('[db] テストデータに戻しました');
      return sendJson(res, 200, loadDb());
    }
    const m = pathname.match(/^\/mock-api\/admin\/db\/([a-z_]+)$/);
    if (req.method === 'PUT' && m) {
      const key = m[1];
      if (WRITABLE.indexOf(key) === -1) return sendJson(res, 403, { error: key + ' は書き換えできません' });
      let value;
      try { value = JSON.parse(await readBody(req)); } catch (e) { return sendJson(res, 400, { error: 'JSON の形式が正しくありません' }); }
      const db = loadDb();
      db[key] = value;
      saveDb(db);
      console.log('[db] 保存：' + key);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return sendJson(res, 500, { error: e.message });
  }
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, '.' + rel);
  // リポジトリの外・.git・.env は出さない
  if (!file.startsWith(ROOT + path.sep) || /[\\/]\.(git|env)/.test(file.slice(ROOT.length))) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': MIME['.txt'] }); res.end('404 not found: ' + rel); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname.startsWith('/mock-api/')) return handleApi(req, res, pathname);
  if (pathname === '/') { res.writeHead(302, { Location: '/html/login.html' }); res.end(); return; }
  serveStatic(req, res, pathname);
});

server.listen(PORT, '127.0.0.1', () => {
  loadDb();
  console.log('halcinema 管理画面 開発サーバー起動');
  console.log('  ログイン：   http://localhost:' + PORT + '/html/login.html');
  console.log('  管理画面：   http://localhost:' + PORT + '/admin/index.html');
  console.log('  DBファイル： ' + path.relative(ROOT, DB));
  console.log('止めるときは Ctrl + C');
});
