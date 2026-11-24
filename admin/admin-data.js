/* ============================================================
   HAL CINEMA — admin-data.js
   管理画面のデータの読み書き（画面はこのファイルの関数だけを使う）

   いまの読み書き先：ローカルのDBファイル（data/admin/db.json）
     → tools/admin-dev-server.js（node）で開いたときだけ保存できる
     → Live Server などで開いたときは data/admin/seed.json を読むだけ（保存されない）
   develop に上げるときは、この中の URL を Go の管理 API に差し替える

   使い方（各画面の JS）：
     AdminData.onReady(function (db) { ... db.goods ... });   // 読み込み後に呼ばれる
     AdminData.save('goods');                                   // db.goods を保存（Promise）
     AdminData.reset();                                         // テストデータに戻す
   ============================================================ */
(function () {
  var API = '/mock-api/admin';
  var SEED_URL = '../data/admin/seed.json';

  var state = { db: null, mode: null };   // mode: 'file'（DBファイルに保存）| 'readonly'

  function getJson(url, opts) {
    return fetch(url, Object.assign({ cache: 'no-store' }, opts || {})).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
        return body;
      });
    });
  }

  var ready = getJson(API + '/db')
    .then(function (db) { state.mode = 'file'; return db; })
    .catch(function () {
      state.mode = 'readonly';
      return getJson(SEED_URL);
    })
    .then(function (db) {
      state.db = db;
      // モックの「今日」はデータファイルの meta で決める
      if (window.Office && db.meta && db.meta.today) window.Office.today = db.meta.today;
      return db;
    });

  function domReady() {
    return new Promise(function (resolve) {
      if (document.readyState !== 'loading') resolve();
      else document.addEventListener('DOMContentLoaded', resolve);
    });
  }

  function onReady(fn) {
    Promise.all([ready, domReady()]).then(function (r) {
      showModeBadge();
      fn(r[0]);
    }).catch(function (e) {
      console.error(e);
      var main = document.querySelector('.page-section');
      if (main) main.insertAdjacentHTML('afterbegin', '<div class="form-alert">データを読み込めませんでした（' + e.message + '）。data/admin/seed.json があるか確認してください。</div>');
    });
  }

  function save(key) {
    // 開発サーバーなしで開いたときは保存しない（トーストに「保存されません」と出る）
    if (state.mode !== 'file') return Promise.resolve(false);
    return getJson(API + '/db/' + key, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.db[key]),
    }).then(function () { return true; }).catch(function (e) {
      if (window.Office) window.Office.toast('保存に失敗しました：' + e.message, 'error');
      throw e;
    });
  }

  function reset() {
    if (state.mode !== 'file') { showReadonlyWarning(); return Promise.resolve(false); }
    return getJson(API + '/reset', { method: 'POST' }).then(function () { location.reload(); return true; });
  }

  /* ── 保存先の表示（ページ右上） ── */
  function showModeBadge() {
    var head = document.querySelector('.page-head');
    if (!head || document.getElementById('data-mode')) return;
    var el = document.createElement('div');
    el.id = 'data-mode';
    el.className = 'data-mode data-mode--' + state.mode;
    el.innerHTML = state.mode === 'file'
      ? '<span class="data-mode__dot"></span>データ：DBファイル（db.json）に保存'
      : '<span class="data-mode__dot"></span>データ：テストデータを表示中（保存されません）';
    el.title = state.mode === 'file'
      ? '書き換えた内容は data/admin/db.json に保存されます'
      : 'node tools/admin-dev-server.js で開くと保存できます';
    head.appendChild(el);
  }

  var warned = false;
  function showReadonlyWarning() {
    if (warned || !window.Office) return;
    warned = true;
    window.Office.toast('いまは保存されません。node tools/admin-dev-server.js で起動して http://localhost:5600 から開いてください', 'error');
  }

  window.AdminData = {
    ready: ready,
    onReady: onReady,
    save: save,
    reset: reset,
    get db() { return state.db; },
    get mode() { return state.mode; },
  };
})();
