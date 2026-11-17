/* ============================================================
   HAL CINEMA — sales.js（G05 売上・精算）
   ※ モック：売上は日付から決まる疑似乱数のサンプル。締め・精算の操作はメモリ上のみ（再読み込みで戻る）
   API 接続時の置き換え先：
     GET    /api/admin/sales?from=&to=&group=day|movie|screen
     POST   /api/admin/closings/{date}      DELETE /api/admin/closings/{date}
     POST   /api/admin/settlements/calculate?month=YYYY-MM
     GET    /api/admin/settlements?month=   PATCH /api/admin/settlements/{id}
     GET    /api/admin/settlements/export?month=
   ============================================================ */
(function () {
  var O = window.Office;
  var TODAY = O.today;
  var ADMIN_NAME = sessionStorage.getItem('hal_admin_id') || 'admin';

  /* ── マスタ（movies.js と同じサンプル） ── */
  var SCREENS = [
    { id: 1, name: 'SCREEN 1', seats: 120 },
    { id: 2, name: 'SCREEN 2', seats: 80 },
    { id: 3, name: 'SCREEN 3', seats: 150 },
  ];
  var MOVIES = {
    1: 'ゴジラ-1.0', 2: '名探偵コナン 黒鉄の魚影', 3: 'THE FIRST SLAM DUNK', 4: '君たちはどう生きるか',
    5: 'プラダを着た悪魔2', 6: 'トイ・ストーリー5', 7: 'マイケル', 8: '口に関するアンケート',
  };
  var DISTS = { 1: '東邦映画配給', 2: 'ワールドピクチャーズ', 3: 'スタジオ北斗' };
  var CONTRACTS = [
    { id: 1, movie_id: 1, dist_id: 1, start: '2026-11-01', end: '2026-12-05', share: 50,   mg: 300000, screen: 3 },
    { id: 2, movie_id: 2, dist_id: 1, start: '2026-11-08', end: '2026-12-31', share: 50,   mg: 0,      screen: 1 },
    { id: 3, movie_id: 3, dist_id: 2, start: '2026-10-01', end: '2026-11-30', share: 45,   mg: 200000, screen: 2 },
    { id: 4, movie_id: 4, dist_id: 3, start: '2026-09-01', end: '2026-10-31', share: 50,   mg: 0,      screen: 1 },
    { id: 7, movie_id: 7, dist_id: 3, start: '2026-11-20', end: '2026-12-25', share: 47.5, mg: 1500000,      screen: 2 },
  ];
  var FIRST_DAY = '2026-10-01';

  /* ── 疑似乱数（同じ日付なら毎回同じ値） ── */
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

  /* ── 1日分の上映実績（作品×スクリーン） ── */
  var dayCache = {};
  function dayShows(date) {
    if (dayCache[date]) return dayCache[date];
    var dow = O.parseDate(date).getDay();
    var weekend = dow === 0 || dow === 6;
    var shows = [];
    CONTRACTS.forEach(function (c) {
      if (date < c.start || date > c.end) return;
      var screen = SCREENS[c.screen - 1];
      var count = 3 + Math.floor(rand(date + 'n' + c.id) * 2);   // 3〜4回
      var elapsed = O.daysBetween(c.start, date);
      var decay = Math.max(0.35, 1 - elapsed / 70);                  // 公開から日が経つほど減る
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
    // 今日はまだ途中の集計
    if (date === TODAY) {
      ['ticket', 'sold', 'admitted', 'food', 'goods'].forEach(function (k) { t[k] = Math.round(t[k] * 0.55); });
    }
    t.total = t.ticket + t.food + t.goods;
    return t;
  }

  /* ════════ 日次締め ════════ */
  // 締め済みデータ（確定値のスナップショット）。11/29 と 今日 が未締め
  var closings = {};
  (function seedClosings() {
    for (var d = FIRST_DAY; d < TODAY; d = addDays(d, 1)) {
      if (d === '2026-11-29') continue;
      closings[d] = { values: dayTotals(d), by: d < '2026-11-15' ? '経理 田中' : '支配人 山田', at: '22:' + String(5 + Math.floor(rand(d + 'c') * 50)).padStart(2, '0') };
    }
  })();

  function monthsList() {
    var list = [];
    var d = O.parseDate(FIRST_DAY);
    var end = O.parseDate(TODAY);
    while (d <= end) {
      list.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
      d.setMonth(d.getMonth() + 1);
    }
    return list;
  }

  function monthLabel(m) { var p = m.split('-'); return p[0] + '年' + Number(p[1]) + '月'; }

  function daysOfMonth(m) {
    var p = m.split('-').map(Number);
    var last = new Date(p[0], p[1], 0).getDate();
    var out = [];
    for (var i = 1; i <= last; i++) out.push(m + '-' + String(i).padStart(2, '0'));
    return out;
  }

  function unclosedDays(m) {
    return daysOfMonth(m).filter(function (d) { return d <= TODAY && !closings[d]; });
  }

  function renderClosing() {
    var m = document.getElementById('closing-month').value;
    var tbody = document.getElementById('closing-tbody');
    var sum = { ticket: 0, food: 0, goods: 0, total: 0, admitted: 0, sold: 0 };

    tbody.innerHTML = daysOfMonth(m).map(function (d) {
      var future = d > TODAY;
      var cl = closings[d];
      if (future) {
        return '<tr class="row--muted"><td>' + O.md(d, true) + '</td>' +
          '<td class="numeric">—</td><td class="numeric">—</td><td class="numeric">—</td><td class="numeric">—</td><td class="numeric">—</td>' +
          '<td><span class="sub">（未来）</span></td><td></td></tr>';
      }
      var v = cl ? cl.values : dayTotals(d);
      Object.keys(sum).forEach(function (k) { sum[k] += v[k]; });
      var numStyle = cl ? '' : ' style="color:var(--ad-text-muted)"';
      var status = cl
        ? '<span class="badge badge--green">✔ 締め済</span><span class="sub">' + O.esc(cl.by) + ' ' + cl.at + '</span>'
        : (d === TODAY ? '<span class="badge badge--blue">本日・集計中</span>' : '<span class="badge badge--yellow">未締め</span>');
      var action = cl
        ? '<button class="toolbar__btn toolbar__btn--sm" data-undo="' + d + '">解除</button>'
        : '<button class="toolbar__btn toolbar__btn--sm toolbar__btn--primary" data-close="' + d + '">締める</button>';
      return '<tr class="' + (!cl && d < TODAY ? 'row--warn' : '') + '">' +
        '<td>' + O.md(d, true) + '</td>' +
        '<td class="numeric"' + numStyle + '>' + O.yen(v.ticket) + '</td>' +
        '<td class="numeric"' + numStyle + '>' + O.yen(v.food) + '</td>' +
        '<td class="numeric"' + numStyle + '>' + O.yen(v.goods) + '</td>' +
        '<td class="numeric"' + numStyle + '><b>' + O.yen(v.total) + '</b></td>' +
        '<td class="numeric"' + numStyle + '>' + v.admitted.toLocaleString() + ' / ' + v.sold.toLocaleString() + '</td>' +
        '<td>' + status + '</td>' +
        '<td class="actions">' + action + '</td>' +
      '</tr>';
    }).join('');

    var un = unclosedDays(m).filter(function (d) { return d < TODAY; }).length;
    document.getElementById('closing-tfoot').innerHTML =
      '<tr><td>月計</td><td class="numeric">' + O.yen(sum.ticket) + '</td><td class="numeric">' + O.yen(sum.food) + '</td>' +
      '<td class="numeric">' + O.yen(sum.goods) + '</td><td class="numeric">' + O.yen(sum.total) + '</td>' +
      '<td class="numeric">' + sum.admitted.toLocaleString() + ' / ' + sum.sold.toLocaleString() + '</td>' +
      '<td colspan="2">' + (un ? '<span class="badge badge--yellow">未締め ' + un + '日</span>' : '<span class="badge badge--green">すべて締め済</span>') + '</td></tr>';
    document.getElementById('closing-unclosed').textContent = '';
  }

  function doClose(date) {
    var v = dayTotals(date);
    O.confirm({
      title: O.md(date, true) + ' の締め',
      html: (date === TODAY ? '<span style="color:#fb923c">本日の営業がまだ終わっていない可能性があります。</span><br>' : '') +
        '以下の金額で確定します。よろしいですか？' +
        '<dl class="kv"><dt>チケット</dt><dd>' + O.yen(v.ticket) + '</dd><dt>フード</dt><dd>' + O.yen(v.food) + '</dd>' +
        '<dt>グッズ</dt><dd>' + O.yen(v.goods) + '</dd><dt>合計</dt><dd>' + O.yen(v.total) + '</dd>' +
        '<dt>入場 / 販売</dt><dd>' + v.admitted + ' / ' + v.sold + '</dd></dl>',
      okLabel: '確定する',
      onOk: function () {
        var now = new Date();
        closings[date] = { values: v, by: ADMIN_NAME, at: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') };
        O.toast(O.md(date) + ' の売上を確定しました');
        renderClosing();
        renderSettlement();
      },
    });
  }

  function undoClose(date) {
    O.confirm({
      title: '締めの解除',
      message: O.md(date, true) + ' の締めを解除すると数字が再集計されます。よろしいですか？（支配人のみ）',
      okLabel: '解除する',
      onOk: function () {
        delete closings[date];
        O.toast(O.md(date) + ' の締めを解除しました');
        renderClosing();
        renderSettlement();
      },
    });
  }

  /* ════════ 売上集計 ════════ */
  var group = 'day';

  function aggregate(from, to) {
    var days = [];
    var byMovie = {};
    var byScreen = {};
    var total = { ticket: 0, food: 0, goods: 0, sold: 0, admitted: 0, capacity: 0 };
    for (var d = from; d <= to && d <= TODAY; d = addDays(d, 1)) {
      var t = dayTotals(d);
      days.push({ date: d, ticket: t.ticket, food: t.food, goods: t.goods, total: t.total, sold: t.sold, admitted: t.admitted });
      ['ticket', 'food', 'goods', 'sold', 'admitted', 'capacity'].forEach(function (k) { total[k] += t[k]; });
      var ratio = d === TODAY ? 0.55 : 1;
      dayShows(d).forEach(function (s) {
        [[byMovie, s.movie_id], [byScreen, s.screen_id]].forEach(function (pair) {
          var o = pair[0][pair[1]] || (pair[0][pair[1]] = { key: pair[1], shows: 0, sold: 0, ticket: 0, capacity: 0 });
          o.shows += s.count; o.capacity += s.capacity;
          o.sold += Math.round(s.sold * ratio); o.ticket += Math.round(s.ticket * ratio);
        });
      });
    }
    return { days: days, byMovie: byMovie, byScreen: byScreen, total: total };
  }

  function renderSummary() {
    var from = document.getElementById('sum-from').value;
    var to = document.getElementById('sum-to').value;
    var chart = document.getElementById('sum-chart');
    var thead = document.getElementById('sum-thead');
    var tbody = document.getElementById('sum-tbody');

    if (!from || !to || from > to) {
      chart.innerHTML = '<div class="empty-state">期間を正しく指定してください</div>';
      thead.innerHTML = ''; tbody.innerHTML = '';
      document.getElementById('sum-stats').innerHTML = '';
      return;
    }

    var a = aggregate(from, to);
    var tot = a.total;
    var sales = tot.ticket + tot.food + tot.goods;
    document.getElementById('sum-stats').innerHTML = [
      ['総売上', O.yen(sales)],
      ['チケット売上（興収）', O.yen(tot.ticket)],
      ['動員', tot.admitted.toLocaleString() + '人'],
      ['平均単価', tot.sold ? O.yen(tot.ticket / tot.sold) : '—'],
    ].map(function (s) {
      return '<div class="stat-card"><div class="stat-card__body"><span class="stat-card__label">' + s[0] + '</span><span class="stat-card__value">' + s[1] + '</span></div></div>';
    }).join('');

    var legend = document.getElementById('sum-legend');
    var title = document.getElementById('sum-chart-title');

    if (!a.days.length) {
      chart.innerHTML = '<div class="empty-state">この期間の売上はまだありません</div>';
      thead.innerHTML = ''; tbody.innerHTML = '';
      return;
    }

    if (group === 'day') {
      title.textContent = '日別売上';
      legend.innerHTML = '<span><i class="c-ticket"></i>チケット</span><span><i class="c-food"></i>フード</span><span><i class="c-goods"></i>グッズ</span>';
      var max = Math.max.apply(null, a.days.map(function (d) { return d.total; })) || 1;
      var step = Math.ceil(a.days.length / 16);
      chart.innerHTML =
        '<div class="vbars">' + a.days.map(function (d) {
          return '<div class="vbars__col" title="' + O.md(d.date, true) + ' ' + O.yen(d.total) + '">' +
            '<span class="c-ticket" style="height:' + (d.ticket / max * 100) + '%"></span>' +
            '<span class="c-food" style="height:' + (d.food / max * 100) + '%"></span>' +
            '<span class="c-goods" style="height:' + (d.goods / max * 100) + '%"></span></div>';
        }).join('') + '</div>' +
        '<div class="vbars__labels">' + a.days.map(function (d, i) {
          return '<span>' + (i % step === 0 ? O.md(d.date).replace(/^0/, '') : '') + '</span>';
        }).join('') + '</div>';
      thead.innerHTML = '<tr><th>日付</th><th class="numeric">チケット</th><th class="numeric">フード</th><th class="numeric">グッズ</th><th class="numeric">合計</th><th class="numeric">動員</th></tr>';
      tbody.innerHTML = a.days.slice().reverse().map(function (d) {
        return '<tr><td>' + O.md(d.date, true) + '</td><td class="numeric">' + O.yen(d.ticket) + '</td><td class="numeric">' + O.yen(d.food) +
          '</td><td class="numeric">' + O.yen(d.goods) + '</td><td class="numeric"><b>' + O.yen(d.total) + '</b></td><td class="numeric">' + d.admitted.toLocaleString() + '</td></tr>';
      }).join('');
      return;
    }

    var isMovie = group === 'movie';
    var rows = Object.values(isMovie ? a.byMovie : a.byScreen).sort(function (x, y) { return y.ticket - x.ticket; });
    var name = function (r) { return isMovie ? MOVIES[r.key] : SCREENS[r.key - 1].name; };
    var top = rows.length ? rows[0].ticket : 1;
    title.textContent = isMovie ? '作品別 興行収入' : 'スクリーン別 興行収入';
    legend.innerHTML = '<span><i class="c-ticket"></i>チケット売上</span>';
    chart.innerHTML = '<div class="hbars">' + rows.map(function (r) {
      return '<div class="hbar"><span class="hbar__label" title="' + O.esc(name(r)) + '">' + O.esc(name(r)) + '</span>' +
        '<span class="hbar__track"><span class="hbar__fill" style="display:block;width:' + (r.ticket / top * 100) + '%"></span></span>' +
        '<span class="hbar__val">' + O.yen(r.ticket) + '</span></div>';
    }).join('') + '</div>';
    thead.innerHTML = '<tr><th>' + (isMovie ? '作品' : 'スクリーン') + '</th><th class="numeric">上映回数</th><th class="numeric">動員</th><th class="numeric">興収</th><th class="numeric">平均単価</th><th class="numeric">座席稼働率</th></tr>';
    tbody.innerHTML = rows.map(function (r) {
      return '<tr><td><b>' + O.esc(name(r)) + '</b></td><td class="numeric">' + r.shows + '回</td><td class="numeric">' + r.sold.toLocaleString() +
        '</td><td class="numeric">' + O.yen(r.ticket) + '</td><td class="numeric">' + (r.sold ? O.yen(r.ticket / r.sold) : '—') +
        '</td><td class="numeric">' + (r.capacity ? (r.sold / r.capacity * 100).toFixed(1) + '%' : '—') + '</td></tr>';
    }).join('');
  }

  /* ════════ 配給精算 ════════ */
  // status 0:下書き / 1:確定 / 2:支払済
  var settlements = {};

  function calcMonth(m) {
    var days = daysOfMonth(m).filter(function (d) { return d <= TODAY; });
    var rows = [];
    CONTRACTS.forEach(function (c) {
      var box = 0, adm = 0;
      days.forEach(function (d) {
        if (d < c.start || d > c.end) return;
        var ratio = d === TODAY ? 0.55 : 1;
        dayShows(d).forEach(function (s) {
          if (s.contract_id === c.id) { box += Math.round(s.ticket * ratio); adm += Math.round(s.admitted * ratio); }
        });
      });
      if (!box) return;
      var byShare = Math.round(box * c.share / 100);
      rows.push({
        id: m + '-' + c.id, contract_id: c.id, movie: MOVIES[c.movie_id], dist: DISTS[c.dist_id],
        box: box, adm: adm, share: c.share, byShare: byShare, mg: c.mg,
        pay: Math.max(byShare, c.mg), mgApplied: c.mg > byShare, status: 0, paid_at: null,
      });
    });
    return rows;
  }

  (function seedSettlements() {
    settlements['2026-10'] = calcMonth('2026-10').map(function (r) { r.status = 2; r.paid_at = '2026-11-20'; return r; });
    settlements['2026-11'] = calcMonth('2026-11').map(function (r) { if (r.contract_id === 3) r.status = 1; return r; });
  })();

  var SETTLE_BADGE = ['<span class="badge badge--gray">下書き</span>', '<span class="badge badge--blue">確定</span>', '<span class="badge badge--green">支払済</span>'];

  function renderSettlement() {
    var m = document.getElementById('settle-month').value;
    var rows = settlements[m];
    var tbody = document.getElementById('settle-tbody');
    var tfoot = document.getElementById('settle-tfoot');
    var notice = document.getElementById('settle-notice');
    var un = unclosedDays(m);

    notice.hidden = !un.length;
    if (un.length) notice.textContent = '⚠ 未締めの日が ' + un.length + '日 あります（' + un.map(function (d) { return O.md(d); }).join('、') + '）。締めてから精算してください。';

    var csvBtn = document.getElementById('settle-csv-btn');
    if (!rows || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="empty-state">' + monthLabel(m) + 'の精算はまだ計算していません。「精算を計算する」を押してください</td></tr>';
      tfoot.innerHTML = '';
      csvBtn.disabled = true;
      return;
    }
    csvBtn.disabled = !rows.some(function (r) { return r.status >= 1; });

    tbody.innerHTML = rows.map(function (r) {
      var action = r.status === 0 ? '<button class="toolbar__btn toolbar__btn--sm toolbar__btn--primary" data-approve="' + r.id + '">承認</button>'
                 : r.status === 1 ? '<button class="toolbar__btn toolbar__btn--sm" data-paid="' + r.id + '">支払済</button>'
                 : '<span class="sub">' + O.md(r.paid_at) + ' 支払</span>';
      return '<tr>' +
        '<td><b>' + O.esc(r.movie) + '</b></td><td>' + O.esc(r.dist) + '</td>' +
        '<td class="numeric">' + O.yen(r.box) + '</td><td class="numeric">' + r.adm.toLocaleString() + '</td>' +
        '<td class="numeric">' + O.pct(r.share) + '</td><td class="numeric">' + O.yen(r.byShare) + '</td>' +
        '<td class="numeric">' + O.yen(r.mg) + '</td>' +
        '<td class="numeric"><b>' + O.yen(r.pay) + '</b>' + (r.mgApplied ? ' ※' : '') + '</td>' +
        '<td>' + SETTLE_BADGE[r.status] + '</td><td class="actions">' + action + '</td></tr>';
    }).join('');

    var sumBox = rows.reduce(function (s, r) { return s + r.box; }, 0);
    var sumPay = rows.reduce(function (s, r) { return s + r.pay; }, 0);
    var sumAdm = rows.reduce(function (s, r) { return s + r.adm; }, 0);
    tfoot.innerHTML = '<tr><td colspan="2">合計</td><td class="numeric">' + O.yen(sumBox) + '</td><td class="numeric">' + sumAdm.toLocaleString() +
      '</td><td colspan="3"></td><td class="numeric">' + O.yen(sumPay) + '</td><td colspan="2"></td></tr>';
  }

  function calculate() {
    var m = document.getElementById('settle-month').value;
    var run = function () {
      var prev = settlements[m] || [];
      var fresh = calcMonth(m);
      // 確定・支払済の行は上書きしない。下書きだけ作り直す
      var kept = prev.filter(function (r) { return r.status >= 1; });
      var keptIds = kept.map(function (r) { return r.contract_id; });
      settlements[m] = kept.concat(fresh.filter(function (r) { return keptIds.indexOf(r.contract_id) === -1; }))
        .sort(function (a, b) { return a.contract_id - b.contract_id; });
      O.toast(monthLabel(m) + 'の精算を計算しました（下書き ' + (settlements[m].length - kept.length) + '件）');
      renderSettlement();
    };
    var un = unclosedDays(m);
    if (un.length) {
      O.confirm({
        title: '未締めの日があります',
        message: '未締めの日が ' + un.length + '日 あります。このまま計算しますか？（未締めの日はその時点の集計値で計算します）',
        okLabel: '計算する',
        onOk: run,
      });
    } else {
      run();
    }
  }

  function findRow(id) {
    var m = id.slice(0, 7);
    return (settlements[m] || []).find(function (r) { return r.id === id; });
  }

  function approve(id) {
    var r = findRow(id);
    O.confirm({
      title: '精算の承認',
      html: '<b>' + O.esc(r.movie) + '</b>（' + O.esc(r.dist) + '）<br>支払額 <b>' + O.yen(r.pay) + '</b> で確定します。<br>承認すると再計算できなくなります。よろしいですか？',
      okLabel: '承認する',
      onOk: function () { r.status = 1; O.toast('承認しました'); renderSettlement(); },
    });
  }

  var payingId = null;
  function openPaid(id) {
    var r = findRow(id);
    payingId = id;
    document.getElementById('paid-target').innerHTML = '<b>' + O.esc(r.movie) + '</b>（' + O.esc(r.dist) + '）<br>支払額 ' + O.yen(r.pay);
    var input = document.getElementById('pf-date');
    input.value = TODAY;
    O.clearFormErrors(document.getElementById('paid-form'));
    O.openModal('paid-modal');
  }

  function savePaid() {
    var input = document.getElementById('pf-date');
    if (!input.value) { O.setFieldError(input, '支払日を入力してください'); return; }
    var r = findRow(payingId);
    r.status = 2;
    r.paid_at = input.value;
    O.closeModal('paid-modal');
    O.toast('支払済にしました');
    renderSettlement();
  }

  /* ── CSV（Excel で文字化けしないよう BOM 付き） ── */
  function downloadCsv(filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (v) { var s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function exportSettlement() {
    var m = document.getElementById('settle-month').value;
    var rows = (settlements[m] || []).filter(function (r) { return r.status >= 1; });
    downloadCsv('settlement_' + m + '.csv', [['対象月', '作品', '配給会社', '興収', '動員', '歩合率(%)', '興収×歩合', '最低保証', '支払額', '状態', '支払日']]
      .concat(rows.map(function (r) {
        return [m, r.movie, r.dist, r.box, r.adm, r.share, r.byShare, r.mg, r.pay, ['下書き', '確定', '支払済'][r.status], r.paid_at || ''];
      })));
  }

  function exportSummary() {
    var from = document.getElementById('sum-from').value;
    var to = document.getElementById('sum-to').value;
    if (!from || !to || from > to) return;
    var a = aggregate(from, to);
    if (group === 'day') {
      downloadCsv('sales_day_' + from + '_' + to + '.csv', [['日付', 'チケット', 'フード', 'グッズ', '合計', '動員']]
        .concat(a.days.map(function (d) { return [d.date, d.ticket, d.food, d.goods, d.total, d.admitted]; })));
    } else {
      var isMovie = group === 'movie';
      downloadCsv('sales_' + group + '_' + from + '_' + to + '.csv', [[isMovie ? '作品' : 'スクリーン', '上映回数', '動員', '興収']]
        .concat(Object.values(isMovie ? a.byMovie : a.byScreen).map(function (r) {
          return [isMovie ? MOVIES[r.key] : SCREENS[r.key - 1].name, r.shows, r.sold, r.ticket];
        })));
    }
  }

  /* ════════ 初期化 ════════ */
  document.addEventListener('DOMContentLoaded', function () {
    var months = monthsList();
    var current = TODAY.slice(0, 7);
    var opts = months.slice().reverse().map(function (m) { return '<option value="' + m + '">' + monthLabel(m) + '</option>'; }).join('');
    document.getElementById('closing-month').innerHTML = opts;
    document.getElementById('settle-month').innerHTML = opts;
    document.getElementById('closing-month').value = current;
    // 精算は前月を初期表示（当月は月末まで確定できないため）
    document.getElementById('settle-month').value = months[months.length - 2] || current;

    document.getElementById('sum-from').value = current + '-01';
    document.getElementById('sum-to').value = TODAY;
    // 当月の頭だとデータが少ないので、前月1日からにする
    document.getElementById('sum-from').value = (months[months.length - 2] || current) + '-01';

    renderClosing();
    renderSummary();
    renderSettlement();

    document.getElementById('closing-month').addEventListener('input', renderClosing);
    document.getElementById('settle-month').addEventListener('input', renderSettlement);
    document.getElementById('sum-from').addEventListener('input', renderSummary);
    document.getElementById('sum-to').addEventListener('input', renderSummary);
    document.querySelectorAll('#sum-group button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        group = btn.dataset.group;
        document.querySelectorAll('#sum-group button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        renderSummary();
      });
    });
    document.getElementById('settle-calc-btn').addEventListener('click', calculate);
    document.getElementById('settle-csv-btn').addEventListener('click', exportSettlement);
    document.getElementById('sum-csv-btn').addEventListener('click', exportSummary);
    document.getElementById('paid-save-btn').addEventListener('click', savePaid);

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset.close) doClose(t.dataset.close);
      else if (t.dataset.undo) undoClose(t.dataset.undo);
      else if (t.dataset.approve) approve(t.dataset.approve);
      else if (t.dataset.paid) openPaid(t.dataset.paid);
    });
  });
})();
