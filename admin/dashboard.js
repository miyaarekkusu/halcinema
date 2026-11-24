/* ============================================================
   HAL CINEMA — dashboard.js（G02 ダッシュボード「概要」タブ）
   画面設計書（B_IH31_08_画面設計書.xlsx「画面設計書(ダッシュボード)」）の項目IDに合わせている
   ・売上カード（db-cards）／アラート（db-alerts）／本日の上映（shows-tbody）／本日の締め（closing-body, close-btn）
   ・在庫・商品・シフト・清掃のタブは backyard.js（旧バックヤード画面を統合）
   ※ データは data/admin/seed.json → db.json（AdminData 経由）。締めは DBファイルに保存する
   API 接続時の置き換え先：GET /api/admin/dashboard?date= ／ POST /api/admin/closings/{date}
   ============================================================ */
(function () {
  var O = window.Office;
  var M = window.AdminModel;
  var ME = sessionStorage.getItem('hal_admin_id') || 'admin';
  var TODAY;      // データ読み込み後に入る
  var current;    // 表示日
  var MAX_AHEAD = 6;   // 何日先まで表示できるか

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

  function hasSales(date) { return date >= M.FIRST_DAY && date <= TODAY; }

  /* ── 日付（date-prev / date-label / date-next / date-today） ── */
  function renderDateNav() {
    var d = O.parseDate(current);
    document.getElementById('date-label').textContent =
      d.getFullYear() + '/' + O.md(current, true);
    document.getElementById('date-prev').disabled = current <= M.FIRST_DAY;
    document.getElementById('date-next').disabled = current >= M.addDays(TODAY, MAX_AHEAD);
    document.getElementById('date-today').disabled = current === TODAY;
  }

  /* ── 売上カード（db-cards） ── */
  function renderCards() {
    var el = document.getElementById('db-cards');
    if (!hasSales(current)) {
      el.innerHTML = statCard('チケット売上', '—') + statCard('フード売上', '—') + statCard('グッズ売上', '—') + statCard('入場者数', '—');
      return;
    }
    var t = M.dayTotals(current);
    var p = M.dayTotals(M.addDays(current, -7));
    // 今日は途中集計なので、前週も同じ割合で比べる
    var ratio = current === TODAY ? M.TODAY_RATIO : 1;
    var c1 = compare(t.ticket, p.ticket * ratio);
    var c2 = compare(t.food, p.food * ratio);
    var c3 = compare(t.goods, p.goods * ratio);
    var rate = t.sold ? Math.round(t.admitted / t.sold * 100) : 0;
    el.innerHTML =
      statCard('チケット売上', O.yen(t.ticket), c1[0], c1[1]) +
      statCard('フード売上', O.yen(t.food), c2[0], c2[1]) +
      statCard('グッズ売上', O.yen(t.goods), c3[0], c3[1]) +
      statCard('入場者数', t.admitted.toLocaleString() + ' / ' + t.sold.toLocaleString(), '入場率 ' + rate + '%');
  }

  /* ── アラート（db-alerts） ── */
  function alertItem(level, tag, text, href, linkLabel) {
    return '<li class="is-' + level + '"><span class="badge badge--' + (level === 'danger' ? 'red' : 'yellow') + '">' + tag + '</span>' +
      '<span class="alert-list__text">' + text + '</span>' +
      '<a class="alert-list__link db-alert__link" href="' + href + '">' + linkLabel + ' →</a></li>';
  }

  function renderAlerts() {
    var items = [];
    var date = current;

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
      if (c.status === 0 && c.start <= date && left >= 0 && left <= 7) {
        items.push(alertItem('warn', '契約', '「' + O.esc(M.MOVIES[c.movie_id]) + '」の契約が ' + O.md(c.end, true) + ' で終了します（残り' + left + '日）', 'movies.html#contracts', '契約を見る'));
      }
    });

    // 在庫・清掃は「今」の状態なので今日を表示しているときだけ（同じ画面のタブへ移動）
    if (date === TODAY) {
      M.GOODS.filter(function (g) { return g.active && g.stock <= g.threshold; })
        .sort(function (a, b) { return a.stock - b.stock; })
        .forEach(function (g) {
          var level = g.stock <= g.threshold / 2 ? 'danger' : 'warn';
          items.push(alertItem(level, '在庫', O.esc(g.name) + ' 残り ' + g.stock + g.unit + '（発注点 ' + g.threshold + '）', '#stock', '在庫を見る'));
        });

      M.dayTimetable(date).forEach(function (s) {
        if (M.showState(date, s) === 'done' && !M.cleaningOf(date, s)) {
          items.push(alertItem('danger', '清掃', s.screen + '（' + O.esc(s.title) + ' ' + s.end + ' 終了）の清掃が完了していません', '#cleaning', '清掃チェックへ'));
        }
      });
    }

    document.getElementById('db-alert-count').textContent = items.length ? items.length + '件' : '';
    document.getElementById('db-alerts').innerHTML = items.length ? items.join('') : '<li class="alert-list__none">アラートはありません</li>';
  }

  /* ── 本日の締め（closing-body / close-btn） ── */
  function renderClosing() {
    var el = document.getElementById('closing-body');
    document.getElementById('closing-title').textContent = (current === TODAY ? '本日' : O.md(current, true)) + 'の締め';
    if (current < M.FIRST_DAY) {
      el.innerHTML = '<div class="closing-box"><span class="sub">データがありません</span></div>';
      return;
    }
    var future = current > TODAY;
    var cl = M.closings[current];
    var v = cl ? cl.values : (future ? null : M.dayTotals(current));
    el.innerHTML = '<div class="closing-box">' +
      (cl ? '<span><span class="badge badge--green">✔ 締め済み</span>　' + O.esc(cl.by) + ' ' + cl.at + '</span>'
          : '<span><span class="badge badge--' + (future ? 'gray">未締め（未来日）' : current === TODAY ? 'blue">未締め（営業中）' : 'yellow">未締め') + '</span></span>') +
      (v ? '<dl class="kv" style="margin:0"><dt>売上合計</dt><dd>' + O.yen(v.total) + '</dd><dt>入場者数</dt><dd>' + v.admitted.toLocaleString() + '人</dd></dl>' : '') +
      (cl ? '' : '<button class="toolbar__btn toolbar__btn--primary" id="close-btn"' + (future ? ' disabled' : '') + '>本日の締めを実行</button>') +
      '</div>';
    var btn = document.getElementById('close-btn');
    if (btn && !future) btn.addEventListener('click', doClose);
  }

  function doClose() {
    var date = current;
    var v = M.dayTotals(date);
    O.confirm({
      title: O.md(date, true) + ' の締め',
      html: (date === TODAY ? '<span style="color:#fb923c">本日の営業がまだ終わっていない可能性があります。</span><br>' : '') +
        O.md(date, true) + ' の売上をこの金額で確定します。よろしいですか？' +
        '<dl class="kv"><dt>チケット</dt><dd>' + O.yen(v.ticket) + '</dd><dt>フード</dt><dd>' + O.yen(v.food) + '</dd>' +
        '<dt>グッズ</dt><dd>' + O.yen(v.goods) + '</dd><dt>合計</dt><dd>' + O.yen(v.total) + '</dd>' +
        '<dt>入場 / 販売</dt><dd>' + v.admitted + ' / ' + v.sold + '</dd></dl>',
      okLabel: '確定する',
      onOk: function () {
        M.closings[date] = { values: v, by: ME, at: M.NOW };
        AdminData.save('closings');
        O.toast('保存しました');
        render();
      },
    });
  }

  /* ── 本日の上映（shows-note / shows-tbody） ── */
  var STATE_BADGE = {
    done:    '<span class="badge badge--gray">上映済</span>',
    playing: '<span class="badge badge--green">● 上映中</span>',
    onsale:  '<span class="badge badge--blue">販売中</span>',
  };

  function renderShows() {
    var date = current;
    document.getElementById('shows-title').textContent = (date === TODAY ? '本日' : O.md(date, true)) + 'の上映';
    var tbody = document.getElementById('shows-tbody');
    var list = date < M.FIRST_DAY ? [] : M.dayTimetable(date);
    document.getElementById('shows-note').textContent = '上映 ' + list.length + '回' + (date === TODAY ? '（' + M.NOW + ' 時点）' : '');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">上映予定がありません</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (s) {
      var state = M.showState(date, s);
      var pct = Math.round(s.sold / s.seats * 100);
      var cl = M.cleaningOf(date, s);
      var clean = state !== 'done' ? '<span class="sub">—</span>'
        : cl ? '<span class="badge badge--green">✔</span>'
        : '<span class="badge badge--red">未完了</span>';
      return '<tr class="' + (state === 'playing' ? 'row--now' : state === 'done' && date === TODAY ? 'row--muted' : '') + '">' +
        '<td class="numeric" style="text-align:left">' + s.start + '〜' + s.end + '</td>' +
        '<td>' + s.screen + '</td>' +
        '<td><b>' + O.esc(s.title) + '</b></td>' +
        '<td><div class="sold-bar"><span class="sold-bar__track"><span class="sold-bar__fill' + (pct >= 80 ? ' sold-bar__fill--high' : '') + '" style="display:block;width:' + pct + '%"></span></span>' +
          s.sold + ' / ' + s.seats + '（' + pct + '%）</div></td>' +
        '<td>' + STATE_BADGE[state] + '</td>' +
        '<td>' + clean + '</td>' +
      '</tr>';
    }).join('');
  }

  function render() {
    renderDateNav();
    renderCards();
    renderAlerts();
    renderClosing();
    renderShows();
  }

  function move(days) {
    var next = M.addDays(current, days);
    if (next < M.FIRST_DAY || next > M.addDays(TODAY, MAX_AHEAD)) return;
    current = next;
    render();
  }

  AdminData.onReady(function () {
    TODAY = O.today;
    current = TODAY;
    document.getElementById('date-prev').addEventListener('click', function () { move(-1); });
    document.getElementById('date-next').addEventListener('click', function () { move(1); });
    document.getElementById('date-today').addEventListener('click', function () { current = TODAY; render(); });
    // 在庫・清掃のタブで書き換えたら概要に戻ったとき反映する
    document.querySelectorAll('.subtab-item[data-tab="overview"]').forEach(function (b) { b.addEventListener('click', render); });
    render();
  });
})();
