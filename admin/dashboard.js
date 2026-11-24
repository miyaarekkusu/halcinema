/* ============================================================
   HAL CINEMA — dashboard.js（G02 ダッシュボード）
   docs/admin/03_screen-design.md「G02 ダッシュボード」準拠のモック。
   ※ 売上は sales.js と同じ疑似乱数ロジックで生成しているので、
     売上・精算 › 日次締め の数字と一致する。
   ※ 締めの操作はメモリ上のみ（再読み込みで戻る）
   API 接続時の置き換え先：
     GET  /api/admin/dashboard?date=YYYY-MM-DD   （売上速報・上映一覧・アラート）
     POST /api/admin/closings/{date}             （本日の締め）
   ============================================================ */
(function () {
  var O = window.Office;
  var TODAY = O.today;          // モックの「今日」（admin-office.js）
  var NOW = '14:30';            // モックの現在時刻（上映状態の判定に使う）
  var TODAY_PROGRESS = 0.55;    // sales.js と同じ「今日は途中集計」の係数
  var FIRST_DAY = '2026-10-01';
  var MAX_AHEAD = 6;            // 何日先まで表示できるか
  var ADMIN_NAME = sessionStorage.getItem('hal_admin_id') || 'admin';

  /* ── ロール（admin-common.js が ?role= と sessionStorage から決める。接続後は GET /api/admin/me の role） ── */
  var ROLE = window.HalAdmin ? window.HalAdmin.role : 'manager';
  var CAN_SALES  = ROLE !== 'staff';                         // 売上カード（staff は要相談のため非表示）
  var CAN_CLOSE  = ROLE === 'manager' || ROLE === 'accounting';
  var CAN_MOVIES = ROLE === 'manager';

  /* ── マスタ（sales.js / movies.js と同じサンプル） ── */
  var SCREENS = [
    { id: 1, name: 'SCREEN 1', seats: 120 },
    { id: 2, name: 'SCREEN 2', seats: 80 },
    { id: 3, name: 'SCREEN 3', seats: 150 },
  ];
  var MOVIES = {
    1: { title: 'ゴジラ-1.0', duration: 125 },
    2: { title: '名探偵コナン 黒鉄の魚影', duration: 113 },
    3: { title: 'THE FIRST SLAM DUNK', duration: 124 },
    4: { title: '君たちはどう生きるか', duration: 124 },
    7: { title: 'マイケル', duration: 132 },
  };
  var CONTRACTS = [
    { id: 1, movie_id: 1, dist_id: 1, start: '2026-11-01', end: '2026-12-05', share: 50,   mg: 300000,  screen: 3 },
    { id: 2, movie_id: 2, dist_id: 1, start: '2026-11-08', end: '2026-12-31', share: 50,   mg: 0,       screen: 1 },
    { id: 3, movie_id: 3, dist_id: 2, start: '2026-10-01', end: '2026-11-30', share: 45,   mg: 200000,  screen: 2 },
    { id: 4, movie_id: 4, dist_id: 3, start: '2026-09-01', end: '2026-10-31', share: 50,   mg: 0,       screen: 1 },
    { id: 7, movie_id: 7, dist_id: 3, start: '2026-11-20', end: '2026-12-25', share: 47.5, mg: 1500000, screen: 2 },
  ];
  // 在庫（food.html / goods.html の在庫タブと同じサンプル）。アラート条件は 在庫 ≦ 10
  var STOCK = [
    { name: 'ポップコーン（コーン豆）', type: 'フード', stock: 42, unit: 'kg' },
    { name: 'コーラ（カップ）',         type: 'フード', stock: 18, unit: '' },
    { name: 'ナチョス用チーズソース',   type: 'フード', stock: 0,  unit: '' },
    { name: 'ホットドッグバンズ',       type: 'フード', stock: 65, unit: '' },
    { name: 'アクリルスタンド',         type: 'グッズ', stock: 36, unit: '' },
    { name: 'パンフレット',             type: 'グッズ', stock: 120, unit: '' },
    { name: 'Tシャツ(L)',               type: 'グッズ', stock: 4,  unit: '' },
    { name: 'キーホルダー',             type: 'グッズ', stock: 0,  unit: '' },
  ];
  var STOCK_ALERT = 10;

  /* ── 疑似乱数・売上生成（sales.js と同一） ── */
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

  var dayCache = {};
  function dayShows(date) {
    if (dayCache[date]) return dayCache[date];
    var dow = O.parseDate(date).getDay();
    var weekend = dow === 0 || dow === 6;
    var shows = [];
    CONTRACTS.forEach(function (c) {
      if (date < c.start || date > c.end) return;
      var screen = SCREENS[c.screen - 1];
      var count = 3 + Math.floor(rand(date + 'n' + c.id) * 2);
      var elapsed = O.daysBetween(c.start, date);
      var decay = Math.max(0.35, 1 - elapsed / 70);
      var rate = (weekend ? 0.75 : 0.45) * decay * (0.75 + rand(date + 'r' + c.id) * 0.5);
      var sold = Math.min(screen.seats * count, Math.round(screen.seats * count * rate));
      var avgPrice = 1650 + Math.round(rand(date + 'p' + c.id) * 300);
      shows.push({
        contract_id: c.id, movie_id: c.movie_id, screen_id: screen.id,
        count: count, capacity: screen.seats * count,
        sold: sold, admitted: Math.round(sold * (0.93 + rand(date + 'a' + c.id) * 0.06)),
        ticket: sold * avgPrice,
      });
    });
    dayCache[date] = shows;
    return shows;
  }

  function dayTotals(date) {
    var shows = dayShows(date);
    var t = { ticket: 0, sold: 0, admitted: 0, capacity: 0 };
    shows.forEach(function (s) { t.ticket += s.ticket; t.sold += s.sold; t.admitted += s.admitted; t.capacity += s.capacity; });
    t.food = Math.round(t.sold * (180 + rand(date + 'f') * 80) / 10) * 10;
    t.goods = Math.round(t.sold * (50 + rand(date + 'g') * 50) / 10) * 10;
    if (date === TODAY) {
      ['ticket', 'sold', 'admitted', 'food', 'goods'].forEach(function (k) { t[k] = Math.round(t[k] * TODAY_PROGRESS); });
    }
    t.total = t.ticket + t.food + t.goods;
    return t;
  }

  /* ── 締め済みデータ（sales.js と同じ：11/29 と今日が未締め） ── */
  var closings = {};
  (function seedClosings() {
    for (var d = FIRST_DAY; d < TODAY; d = addDays(d, 1)) {
      if (d === '2026-11-29') continue;
      closings[d] = { values: dayTotals(d), by: d < '2026-11-15' ? '経理 田中' : '支配人 山田', at: '22:' + String(5 + Math.floor(rand(d + 'c') * 50)).padStart(2, '0') };
    }
  })();

  /* ── 表示ヘルパ ── */
  var WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  function fullDate(iso) {             // 2026/12/01（火）
    var d = O.parseDate(iso);
    return iso.replace(/-/g, '/') + '（' + WEEK[d.getDay()] + '）';
  }
  function toMin(hm) { var p = hm.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function toHM(min) {   // 24時以降は「翌00:52」
    var next = min >= 24 * 60;
    if (next) min -= 24 * 60;
    return (next ? '翌' : '') + String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  }
  function ratio(cur, prev) {
    if (!prev) return '';
    var p = Math.round((cur - prev) / prev * 100);
    return '<span class="' + (p >= 0 ? 'db-up' : 'db-down') + '">' + (p >= 0 ? '+' : '−') + Math.abs(p) + '%</span>';
  }
  var ICON = '<svg class="db-alert__icon" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 3 L18 17 H2 Z" stroke-linejoin="round"/><path d="M10 8 V12 M10 14.5 V14.6" stroke-linecap="round"/></svg>';

  /* ── 1日分の上映回（t_SCHEDULE × t_SEAT_STOCK 相当） ──
     スクリーンごとに 9:30 から「上映時間＋清掃20分」を詰めて並べる（23:00 以降の開始は出さない） */
  function showList(date) {
    var groups = dayShows(date);
    var byScreen = {};
    groups.forEach(function (g) { (byScreen[g.screen_id] = byScreen[g.screen_id] || []).push(g); });

    var rows = [];
    Object.keys(byScreen).forEach(function (sid) {
      var list = byScreen[sid];
      var t = toMin('09:30') + (Number(sid) - 1) * 20;
      var remain = list.map(function (g) { return g.count; });
      var idx = 0;
      while (remain.some(function (n) { return n > 0; })) {
        if (remain[idx] > 0) {
          var g = list[idx];
          if (t > toMin('23:00')) break;
          var dur = MOVIES[g.movie_id].duration;
          rows.push({ group: g, start: t, end: t + dur, seats: SCREENS[sid - 1].seats });
          t += Math.ceil((dur + 20) / 10) * 10;
          remain[idx]--;
        }
        idx = (idx + 1) % list.length;
      }
    });

    // 作品ごとの販売数を各回に振り分け（今日は途中集計・未来は前売り分）
    var ahead = O.daysBetween(TODAY, date);
    var factor = date === TODAY ? TODAY_PROGRESS : ahead > 0 ? Math.max(0.05, 0.35 - ahead * 0.05) : 1;
    // 作品ごとの目標枚数：合計が売上カードの販売枚数（Math.round(合計×係数)）と一致するよう端数を配分
    var raw = groups.map(function (g) { return g.sold * factor; });
    var targets = raw.map(Math.floor);
    var short = Math.round(raw.reduce(function (a, b) { return a + b; }, 0)) - targets.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (v, i) { return { i: i, frac: v - Math.floor(v) }; })
      .sort(function (a, b) { return b.frac - a.frac; })
      .slice(0, short)
      .forEach(function (o) { targets[o.i]++; });

    groups.forEach(function (g, gi) {
      var mine = rows.filter(function (r) { return r.group === g; });
      if (!mine.length) return;
      var target = targets[gi];
      var weights = mine.map(function (r, i) { return 0.7 + rand(date + 's' + g.contract_id + i) * 0.6; });
      var wsum = weights.reduce(function (a, b) { return a + b; }, 0);
      var given = 0;
      mine.forEach(function (r, i) {
        r.sold = i === mine.length - 1 ? target - given : Math.round(target * weights[i] / wsum);
        r.sold = Math.max(0, Math.min(r.seats, r.sold));
        given += r.sold;
      });
    });

    rows.sort(function (a, b) { return a.start - b.start || a.group.screen_id - b.group.screen_id; });
    return rows;
  }

  function showStatus(date, r) {
    if (date < TODAY) return 'done';
    if (date > TODAY) return 'selling';
    var now = toMin(NOW);
    if (r.end <= now) return 'done';
    if (r.start <= now) return 'playing';
    return 'selling';
  }
  var STATUS = {
    done:    '<span class="badge badge--gray">上映済</span>',
    playing: '<span class="badge badge--green">上映中</span>',
    selling: '<span class="badge badge--blue">販売中</span>',
  };

  /* ════════ 描画 ════════ */
  var current = TODAY;

  function renderDate() {
    document.getElementById('date-label').textContent = fullDate(current);
    document.getElementById('date-prev').disabled = current <= FIRST_DAY;
    document.getElementById('date-next').disabled = O.daysBetween(TODAY, current) >= MAX_AHEAD;
    document.getElementById('date-today').disabled = current === TODAY;
  }

  function renderCards() {
    var future = current > TODAY;
    var cl = closings[current];
    var v = cl ? cl.values : dayTotals(current);
    var html = '';

    function card(label, value, sub) {
      return '<div class="stat-card"><div class="stat-card__body"><span class="stat-card__label">' + label + '</span>' +
        '<span class="stat-card__value">' + value + '</span>' +
        (sub ? '<span class="db-card__sub">' + sub + '</span>' : '') + '</div></div>';
    }

    if (CAN_SALES) {
      var sub = '';
      var prevDate = addDays(current, -7);
      if (!future && prevDate >= FIRST_DAY) {
        // 今日は途中集計なので、前週同曜日も同じ割合に揃えて比べる
        var prev = dayTotals(prevDate).ticket * (current === TODAY ? TODAY_PROGRESS : 1);
        sub = '前週同曜日比 ' + ratio(v.ticket, prev);
      }
      html += card('チケット売上', future ? '—' : O.yen(v.ticket), sub);
      html += card('フード売上', future ? '—' : O.yen(v.food));
      html += card('グッズ売上', future ? '—' : O.yen(v.goods));
    }
    var rate = v.sold ? Math.round(v.admitted / v.sold * 100) : 0;
    html += card('入場者数',
      future ? '—' : v.admitted.toLocaleString('ja-JP') + ' <small>/ ' + v.sold.toLocaleString('ja-JP') + '</small>',
      future ? '' : '入場 / 販売枚数　入場率 ' + rate + '%');

    var el = document.getElementById('db-cards');
    el.innerHTML = html;
    el.style.gridTemplateColumns = CAN_SALES ? '' : 'minmax(200px, 300px)';
  }

  function renderAlerts() {
    var items = [];

    // 未締め日（今日を除く過去7日）
    if (CAN_CLOSE) {
      for (var i = 7; i >= 1; i--) {
        var d = addDays(TODAY, -i);
        if (d >= FIRST_DAY && !closings[d]) {
          items.push('<b>' + O.md(d, true) + '</b> が未締めです' + '|<a class="db-alert__link" href="sales.html#closing">締めに行く →</a>');
        }
      }
    }
    // 契約終了7日以内
    if (CAN_MOVIES) {
      CONTRACTS.forEach(function (c) {
        if (c.end < TODAY) return;
        var left = O.daysBetween(TODAY, c.end);
        if (left <= 7) {
          items.push('「' + O.esc(MOVIES[c.movie_id].title) + '」の契約が <b>' + O.md(c.end, true) + '</b> で終了します（残り' + left + '日）' +
            '|<a class="db-alert__link" href="movies.html#contracts">契約を見る →</a>');
        }
      });
    }
    // 在庫10以下
    STOCK.forEach(function (s) {
      if (s.stock <= STOCK_ALERT) {
        items.push(O.esc(s.name) + '（' + s.type + '）在庫 <b>' + (s.stock === 0 ? '0（欠品）' : '残り ' + s.stock + s.unit) + '</b>|');
      }
    });

    document.getElementById('db-alerts').innerHTML = items.length
      ? items.map(function (it) {
          var p = it.split('|');
          return '<div class="db-alert">' + ICON + '<span class="db-alert__text">' + p[0] + '</span>' + (p[1] || '') + '</div>';
        }).join('')
      : '<p class="db-alerts__none">アラートはありません</p>';
  }

  function renderShows() {
    var rows = showList(current);
    document.getElementById('shows-title').textContent = current === TODAY ? '本日の上映' : O.md(current, true) + ' の上映';
    document.getElementById('shows-note').textContent = rows.length
      ? '上映 ' + rows.length + '回' + (current === TODAY ? '（' + NOW + ' 時点）' : '')
      : '';
    var tbody = document.getElementById('shows-tbody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">この日の上映はありません</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      var st = showStatus(current, r);
      var pct = Math.round(r.sold / r.seats * 100);
      return '<tr' + (st === 'done' ? ' class="row--muted"' : '') + '>' +
        '<td class="db-time">' + toHM(r.start) + '<span class="sub">〜' + toHM(r.end) + '</span></td>' +
        '<td>' + SCREENS[r.group.screen_id - 1].name + '</td>' +
        '<td>' + O.esc(MOVIES[r.group.movie_id].title) + '</td>' +
        '<td><div class="db-rate"><span class="db-rate__num">' + r.sold + '<small> / ' + r.seats + '</small></span>' +
          '<span class="db-rate__track" title="販売率 ' + pct + '%"><span class="db-rate__fill" style="display:block;width:' + pct + '%"></span></span></div></td>' +
        '<td>' + STATUS[st] + '</td>' +
      '</tr>';
    }).join('');
  }

  function renderClosing() {
    var panel = document.getElementById('closing-panel');
    panel.hidden = !CAN_CLOSE;
    if (!CAN_CLOSE) {   // 締めパネルが無いロールは上映一覧を全幅に
      document.querySelector('.db-layout').style.gridTemplateColumns = '1fr';
      return;
    }

    var isToday = current === TODAY;
    document.getElementById('closing-title').textContent = isToday ? '本日の締め' : O.md(current, true) + ' の締め';
    var body = document.getElementById('closing-body');
    var cl = closings[current];

    if (current > TODAY) {
      body.innerHTML = '<div class="db-close__state">状態：<span class="sub" style="display:inline">（未来の日付）</span></div>' +
        '<button class="toolbar__btn toolbar__btn--primary db-close__btn" disabled>締めを実行</button>';
    } else if (cl) {
      body.innerHTML = '<div class="db-close__state">状態：<span class="badge badge--green">締め済み</span></div>' +
        '<p class="db-close__hint">' + O.esc(cl.by) + '　' + cl.at + '<br>締め解除は 売上・精算 › 日次締め から（支配人のみ）</p>';
    } else {
      body.innerHTML = '<div class="db-close__state">状態：<span class="badge badge--yellow">未締め</span></div>' +
        '<button class="toolbar__btn toolbar__btn--primary db-close__btn" id="close-btn">' + (isToday ? '本日の締めを実行' : 'この日の締めを実行') + '</button>';
      document.getElementById('close-btn').addEventListener('click', confirmClose);
    }
  }

  function confirmClose() {
    var date = current;
    var v = dayTotals(date);
    O.confirm({
      title: '日次締め',
      okLabel: '確定する',
      html: '<dl class="kv">' +
          '<dt>チケット</dt><dd>' + O.yen(v.ticket) + '</dd>' +
          '<dt>フード</dt><dd>' + O.yen(v.food) + '</dd>' +
          '<dt>グッズ</dt><dd>' + O.yen(v.goods) + '</dd>' +
          '<dt>合計</dt><dd>' + O.yen(v.total) + '</dd>' +
          '<dt>入場 / 販売</dt><dd>' + v.admitted + ' / ' + v.sold + '</dd>' +
        '</dl>' +
        O.esc(O.md(date, true)) + ' の売上をこの金額で確定します。よろしいですか？',   // M07
      onOk: function () {
        closings[date] = {
          values: v,
          by: (ROLE === 'manager' ? '支配人 ' : '経理 ') + ADMIN_NAME,
          at: NOW,   // モックの現在時刻（接続後はサーバーの f_closed_at）
        };
        O.toast('保存しました');   // M12
        render();
      },
    });
  }

  function render() {
    renderDate();
    renderCards();
    renderAlerts();
    renderShows();
    renderClosing();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('date-prev').addEventListener('click', function () { current = addDays(current, -1); render(); });
    document.getElementById('date-next').addEventListener('click', function () { current = addDays(current, 1); render(); });
    document.getElementById('date-today').addEventListener('click', function () { current = TODAY; render(); });
    render();
  });
})();
