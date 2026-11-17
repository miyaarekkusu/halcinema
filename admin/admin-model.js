/* ============================================================
   HAL CINEMA — admin-model.js
   管理画面の「データの見方」をまとめたもの（ダッシュボード・売上・精算・バックヤードで共通）
   ・データそのものは data/admin/seed.json（→ db.json）にあり、admin-data.js が読み込む
   ・ここは日別売上の合計、上映回の時刻割り、上映中かどうかの判定など「計算」だけ
   ・AdminData の読み込みが終わると AdminModel.init(db) が呼ばれ、中身が使えるようになる
   ※ admin-office.js / admin-data.js の後に読み込むこと
   ============================================================ */
(function () {
  var O = window.Office;
  var M = {};
  var db = null;
  var TODAY = null;

  /* ── 小物 ── */
  // 同じ文字列なら毎回同じ値になる疑似乱数（上映回ごとの販売数の振り分けに使う）
  function rand(seed) {
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  function addDays(iso, n) {
    var d = O.parseDate(iso);
    d.setDate(d.getDate() + n);
    return O.toISO(d);
  }

  function hhmm(min) { return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
  function toMin(t) { var p = t.split(':'); return Number(p[0]) * 60 + Number(p[1]); }

  /* ── 売上 ── */
  // その日の上映実績（作品×スクリーンの合計）
  function dayShows(date) {
    var d = db.daily_sales[date];
    return d ? d.shows : [];
  }

  function dayTotals(date) {
    var d = db.daily_sales[date] || { food: 0, goods: 0, shows: [] };
    var t = { ticket: 0, sold: 0, admitted: 0, capacity: 0, food: d.food, goods: d.goods };
    d.shows.forEach(function (s) { t.ticket += s.ticket; t.sold += s.sold; t.admitted += s.admitted; t.capacity += s.capacity; });
    t.total = t.ticket + t.food + t.goods;
    return t;
  }

  /* ── 上映回の一覧（時刻つき）。ダッシュボード・清掃チェック用 ── */
  function dayTimetable(date) {
    var list = [];
    var clean = db.meta.clean_minutes || 20;
    dayShows(date).forEach(function (s) {
      var dur = M.DURATIONS[s.movie_id];
      var screen = M.SCREENS.find(function (x) { return x.id === s.screen_id; });
      var start = 9 * 60 + 30 + (s.screen_id - 1) * 20;
      var rows = [];
      for (var i = 0; i < s.count; i++) {
        var key = date + 's' + s.screen_id + 'i' + i;
        rows.push({
          id: key, movie_id: s.movie_id, title: M.MOVIES[s.movie_id], screen: screen.name, seats: screen.seats,
          startMin: start, endMin: start + dur, start: hhmm(start), end: hhmm(start + dur),
          weight: 0.6 + i * 0.25 + rand(key) * 0.3,   // 後の回ほど売れる
        });
        start = Math.ceil((start + dur + clean) / 10) * 10 + 10;
      }
      // 販売数を回ごとに振り分け
      var wsum = rows.reduce(function (a, r) { return a + r.weight; }, 0);
      rows.forEach(function (r) { r.sold = Math.min(r.seats, Math.round(s.sold * r.weight / wsum)); });
      list = list.concat(rows);
    });
    return list.sort(function (a, b) { return a.startMin - b.startMin || (a.screen < b.screen ? -1 : 1); });
  }

  // 上映回の状態（今日のみ時刻で判定）
  function showState(date, show) {
    if (date < TODAY) return 'done';
    if (date > TODAY) return 'onsale';
    if (show.endMin <= M.NOW_MIN) return 'done';
    if (show.startMin <= M.NOW_MIN) return 'playing';
    return 'onsale';
  }

  /* ── 清掃チェック ── */
  // 記録がなければ未完了。過去の日は終わっているものとして扱う
  function cleaningOf(date, show) {
    if (db.cleaning[show.id]) return db.cleaning[show.id];
    if (date < TODAY) return { by: '—', at: '' };
    return null;
  }

  function markCleaned(id, by, at) {
    db.cleaning[id] = { by: by, at: at };
    return window.AdminData.save('cleaning');
  }

  /* ── 読み込み後に中身を入れる ── */
  M.init = function (data) {
    db = data;
    TODAY = O.today;
    M.SCREENS = db.screens;
    M.MOVIES = {};
    M.DURATIONS = {};
    db.movies.forEach(function (m) { M.MOVIES[m.id] = m.title; M.DURATIONS[m.id] = m.duration; });
    M.DISTS = {};
    db.distributors.forEach(function (d) { M.DISTS[d.id] = d.name; });
    M.CONTRACTS = db.contracts;
    M.FIRST_DAY = db.meta.first_day;
    M.TODAY_RATIO = db.meta.today_ratio;
    M.NOW = db.meta.now;
    M.NOW_MIN = toMin(db.meta.now);
    M.closings = db.closings;
    M.GOODS = db.goods;
    M.STAFF = db.staff;
    M.POSTS = db.posts;
    M.REQUIRED = db.required_staff;
    M.shifts = db.shifts;
    return M;
  };

  Object.assign(M, {
    rand: rand, addDays: addDays, hhmm: hhmm,
    dayShows: dayShows, dayTotals: dayTotals, dayTimetable: dayTimetable, showState: showState,
    cleaningOf: cleaningOf, markCleaned: markCleaned,
  });

  window.AdminModel = M;

  // データの読み込みが終わったら、どの画面より先に中身を入れる
  window.AdminData.ready.then(M.init);
})();
