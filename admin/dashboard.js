/* ============================================================
   HAL CINEMA — dashboard.js（G02 ダッシュボード）
   今日の状況を見るだけの画面。作業は各画面（売上・精算／バックヤード等）へのリンクから行う
   ※ データは data/admin/seed.json → db.json（AdminData 経由・この画面は読むだけ）
   API 接続時の置き換え先：GET /api/admin/dashboard?date=YYYY-MM-DD
   ============================================================ */
(function () {
  var O = window.Office;
  var M = window.AdminModel;
  var TODAY;   // データ読み込み後に入る

  function statCard(label, value, sub, subClass) {
    return '<div class="stat-card"><div class="stat-card__body">' +
      '<span class="stat-card__label">' + label + '</span>' +
      '<span class="stat-card__value">' + value + '</span>' +
      (sub ? '<span class="stat-card__sub ' + (subClass || '') + '">' + sub + '</span>' : '') +
      '</div></div>';
  }

  function compare(now, prev) {
    if (!prev) return ['', ''];
    var r = Math.round((now / prev - 1) * 100);
    return ['前週比 ' + (r >= 0 ? '+' : '') + r + '%', r >= 0 ? 'stat-card__sub--up' : 'stat-card__sub--down'];
  }

  function renderStats(date) {
    var el = document.getElementById('dash-stats');
    if (date > TODAY || date < M.FIRST_DAY) {
      el.innerHTML = statCard('チケット売上', '—') + statCard('フード売上', '—') + statCard('グッズ売上', '—') + statCard('入場者数', '—');
      return;
    }
    var t = M.dayTotals(date);
    var p = M.dayTotals(M.addDays(date, -7));
    // 今日は途中集計なので、前週も同じ割合で比べる
    var ratio = date === TODAY ? M.TODAY_RATIO : 1;
    var c1 = compare(t.ticket, p.ticket * ratio);
    var c2 = compare(t.food, p.food * ratio);
    var c3 = compare(t.goods, p.goods * ratio);
    var rate = t.capacity ? Math.round(t.sold / t.capacity * 100) : 0;
    el.innerHTML =
      statCard('チケット売上', O.yen(t.ticket), c1[0], c1[1]) +
      statCard('フード売上', O.yen(t.food), c2[0], c2[1]) +
      statCard('グッズ売上', O.yen(t.goods), c3[0], c3[1]) +
      statCard('入場者数 / 販売', t.admitted.toLocaleString() + ' / ' + t.sold.toLocaleString(), '座席販売率 ' + rate + '%');
  }

  function alertItem(level, tag, text, href, linkLabel) {
    return '<li class="is-' + level + '"><span class="badge badge--' + (level === 'danger' ? 'red' : 'yellow') + '">' + tag + '</span>' +
      '<span class="alert-list__text">' + text + '</span>' +
      '<a class="alert-list__link" href="' + href + '">' + linkLabel + ' →</a></li>';
  }

  function renderAlerts(date) {
    var items = [];

    // 未締め（過去7日）
    for (var i = 1; i <= 7; i++) {
      var d = M.addDays(date, -i);
      if (d >= M.FIRST_DAY && d < TODAY && !M.closings[d]) {
        items.push(alertItem('warn', '未締め', O.md(d, true) + ' の売上が締められていません', 'sales.html#closing', '締めに行く'));
      }
    }

    // 契約終了が近い（7日以内）
    M.CONTRACTS.forEach(function (c) {
      var left = O.daysBetween(date, c.end);
      if (c.start <= date && left >= 0 && left <= 7) {
        items.push(alertItem('warn', '契約', '「' + O.esc(M.MOVIES[c.movie_id]) + '」の契約が ' + O.md(c.end, true) + ' で終了します（残り' + left + '日）', 'movies.html#contracts', '契約を見る'));
      }
    });

    // 在庫（今日のみ）
    if (date === TODAY) {
      M.GOODS.filter(function (g) { return g.active && g.stock <= g.threshold; })
        .sort(function (a, b) { return a.stock - b.stock; })
        .forEach(function (g) {
          var level = g.stock <= g.threshold / 2 ? 'danger' : 'warn';
          items.push(alertItem(level, '在庫', O.esc(g.name) + ' 残り ' + g.stock + g.unit + '（発注点 ' + g.threshold + '）', 'backyard.html#stock', 'バックヤードへ'));
        });

      // 清掃が終わっていない上映回
      M.dayTimetable(date).forEach(function (s) {
        if (M.showState(date, s) === 'done' && !M.cleaningOf(date, s)) {
          items.push(alertItem('danger', '清掃', s.screen + '（' + O.esc(s.title) + ' ' + s.end + ' 終了）の清掃が完了していません', 'backyard.html#cleaning', '清掃チェックへ'));
        }
      });
    }

    document.getElementById('dash-alert-count').textContent = items.length ? items.length + '件' : '';
    document.getElementById('dash-alerts').innerHTML = items.length ? items.join('') : '<li class="alert-list__none">アラートはありません</li>';
  }

  function renderClosing(date) {
    var el = document.getElementById('dash-closing');
    if (date > TODAY || date < M.FIRST_DAY) {
      el.innerHTML = '<div class="closing-box"><span class="sub">この日の締めはありません</span></div>';
      return;
    }
    var cl = M.closings[date];
    var v = cl ? cl.values : M.dayTotals(date);
    el.innerHTML = '<div class="closing-box">' +
      (cl ? '<span><span class="badge badge--green">✔ 締め済</span>　' + O.esc(cl.by) + ' ' + cl.at + '</span>'
          : '<span><span class="badge badge--' + (date === TODAY ? 'blue">営業中・未締め' : 'yellow">未締め') + '</span></span>') +
      '<dl class="kv" style="margin:0"><dt>売上合計</dt><dd>' + O.yen(v.total) + '</dd><dt>入場者数</dt><dd>' + v.admitted.toLocaleString() + '人</dd></dl>' +
      '<a class="toolbar__btn' + (cl ? '' : ' toolbar__btn--primary') + '" href="sales.html#closing">' + (cl ? '締めの内容を見る' : '締め画面へ') + '</a>' +
      '</div>';
  }

  var STATE_BADGE = {
    done:    '<span class="badge badge--gray">上映済</span>',
    playing: '<span class="badge badge--green">● 上映中</span>',
    onsale:  '<span class="badge badge--blue">販売中</span>',
  };

  function renderShows(date) {
    document.getElementById('dash-shows-title').textContent = (date === TODAY ? '本日' : O.md(date, true)) + 'の上映';
    document.getElementById('dash-now').textContent = date === TODAY ? '現在 ' + M.NOW : '';
    var tbody = document.getElementById('dash-shows');
    if (date < M.FIRST_DAY) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">データがありません</td></tr>';
      return;
    }
    var list = M.dayTimetable(date);
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">上映予定がありません</td></tr>';
      return;
    }
    // 未来日は前売りぶんだけ
    var factor = date > TODAY ? 0.15 : 1;
    tbody.innerHTML = list.map(function (s) {
      var state = M.showState(date, s);
      var sold = Math.round(s.sold * factor);
      var pct = Math.round(sold / s.seats * 100);
      var cl = M.cleaningOf(date, s);
      var clean = state !== 'done' ? '<span class="sub">—</span>'
        : cl ? '<span class="badge badge--green">✔</span>'
        : '<span class="badge badge--red">未完了</span>';
      return '<tr class="' + (state === 'playing' ? 'row--now' : state === 'done' && date === TODAY ? 'row--muted' : '') + '">' +
        '<td class="numeric" style="text-align:left">' + s.start + '〜' + s.end + '</td>' +
        '<td>' + s.screen + '</td>' +
        '<td><b>' + O.esc(s.title) + '</b></td>' +
        '<td><div class="sold-bar"><span class="sold-bar__track"><span class="sold-bar__fill' + (pct >= 80 ? ' sold-bar__fill--high' : '') + '" style="display:block;width:' + pct + '%"></span></span>' +
          sold + ' / ' + s.seats + '</div></td>' +
        '<td>' + STATE_BADGE[state] + '</td>' +
        '<td>' + clean + '</td>' +
      '</tr>';
    }).join('');
  }

  function render() {
    var date = document.getElementById('dash-date').value || TODAY;
    renderStats(date);
    renderAlerts(date);
    renderClosing(date);
    renderShows(date);
  }

  AdminData.onReady(function () {
    TODAY = O.today;
    var input = document.getElementById('dash-date');
    input.value = TODAY;
    input.addEventListener('input', render);
    document.getElementById('dash-prev').addEventListener('click', function () { input.value = M.addDays(input.value || TODAY, -1); render(); });
    document.getElementById('dash-next').addEventListener('click', function () { input.value = M.addDays(input.value || TODAY, 1); render(); });
    document.getElementById('dash-today').addEventListener('click', function () { input.value = TODAY; render(); });
    render();
  });
})();
