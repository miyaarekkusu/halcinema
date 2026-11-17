/* ============================================================
   HAL CINEMA — backyard.js（G09 バックヤード）
   タブ：在庫・発注 / 商品 / シフト / 清掃・設備
   ※ データは data/admin/seed.json → db.json（AdminData 経由）。書き換えは AdminData.save() で DBファイルに保存する
   API 接続時の置き換え先（予定）：
     GET/PATCH /api/admin/goods        POST /api/admin/goods/{id}/stock（入荷・調整）
     GET/PUT   /api/admin/shifts?week=
     GET       /api/admin/cleaning?date=   POST /api/admin/cleaning/{scheduleId}
     GET/POST/PATCH /api/admin/facility-issues
   ============================================================ */
(function () {
  var O = window.Office;
  var M = window.AdminModel;
  var TODAY;                                  // データ読み込み後に入る
  var stockLogs, issues, PLACES, weekStart;   // 同上
  var ME = sessionStorage.getItem('hal_admin_id') || 'admin';

  function nowLabel() { return O.md(TODAY) + ' ' + M.NOW; }
  function byId(list, id) { return list.find(function (x) { return x.id === Number(id); }); }

  /* ════════ 在庫・発注 ════════ */

  function daysLeft(g) {
    var perDay = g.sold7 / 7;
    return perDay ? g.stock / perDay : Infinity;
  }
  function needsOrder(g) { return g.active && g.stock <= g.threshold; }

  function renderStock() {
    var type = document.getElementById('stock-type').value;
    var need = document.getElementById('stock-need').checked;
    var rows = M.GOODS.filter(function (g) {
      return (!type || g.type === type) && (!need || needsOrder(g));
    }).sort(function (a, b) { return (needsOrder(b) - needsOrder(a)) || daysLeft(a) - daysLeft(b); });

    var tbody = document.getElementById('stock-tbody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">' + (need ? '発注が必要な商品はありません' : '該当する商品がありません') + '</td></tr>';
    } else {
      tbody.innerHTML = rows.map(function (g) {
        var left = daysLeft(g);
        var leftText = left === Infinity ? '—' : left.toFixed(1) + '日';
        var leftStyle = left < 2 ? ' style="color:var(--ad-red);font-weight:700"' : '';
        var status = !g.active ? '<span class="badge badge--gray">販売停止</span>'
          : g.stock === 0 ? '<span class="badge badge--red">在庫切れ</span>'
          : needsOrder(g) ? '<span class="badge badge--orange">⚠ 発注</span>'
          : '<span class="badge badge--green">○</span>';
        return '<tr class="' + (g.active ? (needsOrder(g) ? 'row--warn' : '') : 'row--muted') + '">' +
          '<td><b>' + O.esc(g.name) + '</b></td><td>' + g.type + '</td>' +
          '<td class="numeric">' + g.stock + g.unit + '</td><td class="numeric">' + g.threshold + '</td>' +
          '<td class="numeric">' + g.sold7 + g.unit + '</td><td class="numeric"' + leftStyle + '>' + leftText + '</td>' +
          '<td>' + status + '</td>' +
          '<td class="actions"><button class="toolbar__btn toolbar__btn--sm" data-receive="' + g.id + '">入荷</button>' +
          '<button class="toolbar__btn toolbar__btn--sm" data-adjust="' + g.id + '">調整</button></td></tr>';
      }).join('');
    }

    document.getElementById('stocklog-tbody').innerHTML = stockLogs.slice(0, 10).map(function (l) {
      var g = byId(M.GOODS, l.goods_id);
      return '<tr><td>' + l.at + '</td><td>' + O.esc(g.name) + '</td>' +
        '<td class="numeric" style="color:' + (l.diff > 0 ? 'var(--ad-green)' : '#fb923c') + '">' + (l.diff > 0 ? '+' : '') + l.diff + g.unit + '</td>' +
        '<td>' + l.reason + '</td><td>' + O.esc(l.by) + '</td></tr>';
    }).join('');
  }

  var stockMode = null;  // 'receive' | 'adjust'
  var stockGoodsId = null;

  function openStockModal(mode, id) {
    stockMode = mode;
    stockGoodsId = id;
    var g = byId(M.GOODS, id);
    var form = document.getElementById('stock-form');
    form.reset();
    O.clearFormErrors(form);
    var receive = mode === 'receive';
    document.getElementById('stock-modal-title').textContent = receive ? '入荷を記録' : '在庫を調整';
    document.getElementById('stock-target').innerHTML = '<b>' + O.esc(g.name) + '</b>　現在の在庫 ' + g.stock + g.unit;
    document.getElementById('sf-qty-label').innerHTML = (receive ? '入荷数' : '増減数') + '<span class="req">*</span>';
    document.getElementById('sf-qty-hint').textContent = receive ? '' : '減らすときはマイナス（例：廃棄3個 → -3）';
    document.getElementById('sf-qty').min = receive ? '1' : '';
    document.getElementById('sf-reason-field').hidden = receive;
    O.openModal('stock-modal');
  }

  function saveStock() {
    var g = byId(M.GOODS, stockGoodsId);
    var form = document.getElementById('stock-form');
    O.clearFormErrors(form);
    var qtyEl = document.getElementById('sf-qty');
    var reasonEl = document.getElementById('sf-reason');
    var q = Number(qtyEl.value);
    if (qtyEl.value === '' || !Number.isInteger(q) || q === 0) { O.setFieldError(qtyEl, '0以外の整数を入力してください'); return; }
    if (stockMode === 'receive' && q < 0) { O.setFieldError(qtyEl, '入荷数は1以上で入力してください'); return; }
    if (stockMode === 'adjust' && !reasonEl.value) { O.setFieldError(reasonEl, '理由を選択してください'); return; }
    if (g.stock + q < 0) { O.setFieldError(qtyEl, '在庫がマイナスになります（現在 ' + g.stock + g.unit + '）'); return; }

    g.stock += q;
    stockLogs.unshift({ at: nowLabel(), goods_id: g.id, diff: q, reason: stockMode === 'receive' ? '入荷' : reasonEl.value, by: ME });
    AdminData.save('goods');
    AdminData.save('stock_logs');
    O.closeModal('stock-modal');
    O.toast(g.name + ' の在庫を ' + g.stock + g.unit + ' にしました');
    renderStock();
  }

  function exportOrderList() {
    var rows = M.GOODS.filter(needsOrder);
    if (!rows.length) { O.toast('発注が必要な商品はありません'); return; }
    O.downloadCsv('order_' + TODAY + '.csv', [['商品', '区分', '在庫', '発注点', '直近7日の販売', '発注目安数']]
      .concat(rows.map(function (g) {
        // 7日分の販売に足りない数（最低でも発注点まで戻す）
        var want = Math.max(g.sold7, g.threshold * 2) - g.stock;
        return [g.name, g.type, g.stock, g.threshold, g.sold7, Math.max(want, 0)];
      })));
  }

  /* ════════ 商品 ════════ */
  function renderProducts() {
    var q = document.getElementById('prod-search').value.trim();
    var type = document.getElementById('prod-type').value;
    var rows = M.GOODS.filter(function (g) { return (!q || g.name.indexOf(q) !== -1) && (!type || g.type === type); });
    var tbody = document.getElementById('prod-tbody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">該当する商品がありません</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (g) {
      return '<tr class="' + (g.active ? '' : 'row--muted') + '">' +
        '<td><b>' + O.esc(g.name) + '</b></td><td>' + g.type + '</td>' +
        '<td class="numeric">' + O.yen(g.price) + '</td><td>' + O.esc(g.unit) + '</td>' +
        '<td class="numeric">' + g.threshold + '</td>' +
        '<td>' + (g.active ? '<span class="badge badge--green">販売中</span>' : '<span class="badge badge--gray">停止</span>') + '</td>' +
        '<td class="actions"><button class="toolbar__btn toolbar__btn--sm" data-edit-prod="' + g.id + '">編集</button></td></tr>';
    }).join('');
  }

  var editingProdId = null;

  function openProdModal(id) {
    var form = document.getElementById('prod-form');
    form.reset();
    O.clearFormErrors(form);
    editingProdId = id || null;
    document.getElementById('prod-modal-title').textContent = id ? '商品を編集' : '商品を登録';
    if (id) {
      var g = byId(M.GOODS, id);
      document.getElementById('pf-name').value = g.name;
      document.getElementById('pf-type').value = g.type;
      document.getElementById('pf-price').value = g.price;
      document.getElementById('pf-unit').value = g.unit;
      document.getElementById('pf-threshold').value = g.threshold;
      document.getElementById('pf-active').checked = g.active;
    } else {
      document.getElementById('pf-unit').value = '個';
      document.getElementById('pf-threshold').value = 10;
    }
    O.openModal('prod-modal');
  }

  function saveProd() {
    var form = document.getElementById('prod-form');
    O.clearFormErrors(form);
    var name = document.getElementById('pf-name');
    var type = document.getElementById('pf-type');
    var price = document.getElementById('pf-price');
    var unit = document.getElementById('pf-unit');
    var th = document.getElementById('pf-threshold');
    var ok = true;
    var n = name.value.trim();
    if (!n) { O.setFieldError(name, '商品名を入力してください'); ok = false; }
    else if (M.GOODS.some(function (g) { return g.name === n && g.id !== editingProdId; })) { O.setFieldError(name, '同じ名前の商品がすでにあります'); ok = false; }
    if (!type.value) { O.setFieldError(type, '区分を選択してください'); ok = false; }
    var p = Number(price.value);
    if (price.value === '' || !Number.isInteger(p) || p < 0) { O.setFieldError(price, '0以上の整数で入力してください'); ok = false; }
    if (!unit.value.trim()) { O.setFieldError(unit, '単位を入力してください'); ok = false; }
    var t = Number(th.value);
    if (th.value === '' || !Number.isInteger(t) || t < 0) { O.setFieldError(th, '0以上の整数で入力してください'); ok = false; }
    if (!ok) return;

    var data = { name: n, type: type.value, price: p, unit: unit.value.trim(), threshold: t, active: document.getElementById('pf-active').checked };
    if (editingProdId) Object.assign(byId(M.GOODS, editingProdId), data);
    else {
      data.id = Math.max.apply(null, M.GOODS.map(function (g) { return g.id; })) + 1;
      data.stock = 0;
      data.sold7 = 0;
      M.GOODS.push(data);
    }
    AdminData.save('goods');
    O.closeModal('prod-modal');
    O.toast(editingProdId ? '商品を更新しました' : '商品を登録しました。在庫は「在庫・発注」タブの「入荷」から入れてください');
    renderProducts();
    renderStock();
  }

  /* ════════ シフト ════════ */
  var WEEK = ['日', '月', '火', '水', '木', '金', '土'];
  // 週の開始（月曜）
  function mondayOf(date) {
    var dow = O.parseDate(date).getDay();
    return M.addDays(date, -((dow + 6) % 7));
  }

  function weekDays() {
    var out = [];
    for (var i = 0; i < 7; i++) out.push(M.addDays(weekStart, i));
    return out;
  }

  function renderShift() {
    var days = weekDays();
    document.getElementById('shift-range').textContent = O.md(days[0], true) + ' 〜 ' + O.md(days[6], true);
    document.getElementById('shift-thead').innerHTML = '<tr><th>スタッフ</th>' + days.map(function (d) {
      return '<th class="' + (d === TODAY ? 'is-today' : '') + '">' + O.md(d) + '（' + WEEK[O.parseDate(d).getDay()] + '）</th>';
    }).join('') + '</tr>';

    document.getElementById('shift-tbody').innerHTML = M.STAFF.map(function (s) {
      return '<tr><td><b>' + O.esc(s.name) + '</b></td>' + days.map(function (d) {
        var sh = M.shifts[s.id + '_' + d];
        var inner = sh
          ? sh.start + '-' + sh.end + '<br><span class="shift-cell__post post-' + sh.post + '">' + sh.post + '</span>'
          : '休';
        return '<td class="' + (d === TODAY ? 'is-today' : '') + '"><button type="button" class="shift-cell' + (sh ? '' : ' shift-cell--off') +
          '" data-shift="' + s.id + '_' + d + '">' + inner + '</button></td>';
      }).join('') + '</tr>';
    }).join('');

    // 持ち場ごとの人数と不足
    document.getElementById('shift-tfoot').innerHTML = '<tr><td>配置</td>' + days.map(function (d) {
      var count = {};
      M.POSTS.forEach(function (p) { count[p] = 0; });
      M.STAFF.forEach(function (s) { var sh = M.shifts[s.id + '_' + d]; if (sh) count[sh.post]++; });
      var short = M.POSTS.filter(function (p) { return count[p] < M.REQUIRED[p]; });
      return '<td class="' + (d === TODAY ? 'is-today' : '') + '" style="font-weight:400;font-size:11px">' +
        (short.length
          ? short.map(function (p) { return '<span class="shift-short">' + p + ' −' + (M.REQUIRED[p] - count[p]) + '</span>'; }).join('<br>')
          : '<span class="shift-ok">OK</span>') + '</td>';
    }).join('') + '</tr>';

    document.getElementById('shift-required').textContent = '※ 1日の必要人数：' +
      M.POSTS.map(function (p) { return p + ' ' + M.REQUIRED[p] + '名'; }).join(' ／ ') + '。足りない日は「配置」の行に赤字で表示します。';
  }

  var editingShiftKey = null;

  function openShiftModal(key) {
    editingShiftKey = key;
    var parts = key.split('_');
    var staff = byId(M.STAFF, parts[0]);
    var sh = M.shifts[key];
    var form = document.getElementById('shift-form');
    O.clearFormErrors(form);
    document.getElementById('shift-target').innerHTML = '<b>' + O.esc(staff.name) + '</b>　' + O.md(parts[1], true);
    document.getElementById('shf-start').value = sh ? sh.start : '10:00';
    document.getElementById('shf-end').value = sh ? sh.end : '19:00';
    document.getElementById('shf-post').innerHTML = M.POSTS.map(function (p) { return '<option>' + p + '</option>'; }).join('');
    document.getElementById('shf-post').value = sh ? sh.post : '窓口';
    document.getElementById('shift-off-btn').hidden = !sh;
    O.openModal('shift-modal');
  }

  function saveShift() {
    var form = document.getElementById('shift-form');
    O.clearFormErrors(form);
    var st = document.getElementById('shf-start');
    var en = document.getElementById('shf-end');
    if (!st.value) { O.setFieldError(st, '開始時刻を入力してください'); return; }
    if (!en.value) { O.setFieldError(en, '終了時刻を入力してください'); return; }
    if (en.value <= st.value) { O.setFieldError(en, '開始より後の時刻を入力してください'); return; }
    M.shifts[editingShiftKey] = { start: st.value, end: en.value, post: document.getElementById('shf-post').value };
    AdminData.save('shifts');
    O.closeModal('shift-modal');
    O.toast('シフトを保存しました');
    renderShift();
  }

  function setOff() {
    delete M.shifts[editingShiftKey];
    AdminData.save('shifts');
    O.closeModal('shift-modal');
    O.toast('休みにしました');
    renderShift();
  }

  /* ════════ 清掃・設備 ════════ */

  function renderCleaning() {
    var list = M.dayTimetable(TODAY);
    var done = 0, due = 0;
    document.getElementById('clean-title').textContent = '本日の清掃チェック（' + O.md(TODAY, true) + '）';
    document.getElementById('clean-tbody').innerHTML = list.map(function (s) {
      var state = M.showState(TODAY, s);
      var cl = M.cleaningOf(TODAY, s);
      if (state === 'done') { due++; if (cl) done++; }
      var cell, action = '', cls = '';
      if (cl) {
        cell = '<span class="badge badge--green">✔ 完了</span><span class="sub">' + O.esc(cl.by) + ' ' + cl.at + '</span>';
      } else if (state === 'done') {
        cell = '<span class="badge badge--red">未完了</span>';
        action = '<button class="toolbar__btn toolbar__btn--sm toolbar__btn--primary" data-clean="' + s.id + '">完了にする</button>';
        cls = 'row--warn';
      } else {
        cell = '<span class="sub">' + (state === 'playing' ? '上映中' : '上映前') + '</span>';
        cls = 'row--muted';
      }
      return '<tr class="' + cls + '"><td class="numeric" style="text-align:left">' + s.start + '</td><td>' + s.screen + '</td>' +
        '<td>' + O.esc(s.title) + '</td><td class="numeric" style="text-align:left">' + s.end + '</td>' +
        '<td>' + cell + '</td><td class="actions">' + action + '</td></tr>';
    }).join('');
    document.getElementById('clean-count').textContent = '終了した回 ' + due + ' 件中 ' + done + ' 件完了（現在 ' + M.NOW + '）';

    var STATUS = ['<span class="badge badge--orange">対応中</span>', '<span class="badge badge--green">解決</span>'];
    document.getElementById('issue-tbody').innerHTML = issues.map(function (i) {
      return '<tr class="' + (i.status ? 'row--muted' : '') + '"><td>' + i.at + '</td>' +
        '<td>' + O.esc(i.place) + (i.seat ? ' ' + O.esc(i.seat) + (i.blocked ? '<span class="sub sub--warn">販売停止中</span>' : '') : '') + '</td>' +
        '<td>' + O.esc(i.detail) + '</td><td>' + O.esc(i.by) + '</td><td>' + STATUS[i.status] + '</td>' +
        '<td class="actions">' + (i.status ? '' : '<button class="toolbar__btn toolbar__btn--sm" data-resolve="' + i.id + '">解決</button>') + '</td></tr>';
    }).join('');
  }

  function markClean(id) {
    var s = M.dayTimetable(TODAY).find(function (x) { return x.id === id; });
    O.confirm({
      title: '清掃完了',
      message: s.screen + '（' + s.title + ' ' + s.end + ' 終了）の清掃を完了にします。',
      okLabel: '完了にする',
      onOk: function () {
        M.markCleaned(id, ME, M.NOW);
        O.toast(s.screen + ' の清掃を完了にしました');
        renderCleaning();
      },
    });
  }

  function openIssueModal() {
    var form = document.getElementById('issue-form');
    form.reset();
    O.clearFormErrors(form);
    document.getElementById('if-place').innerHTML = '<option value="">選択してください</option>' + PLACES.map(function (p) { return '<option>' + p + '</option>'; }).join('');
    document.getElementById('if-seat-field').hidden = true;
    O.openModal('issue-modal');
  }

  function saveIssue() {
    var form = document.getElementById('issue-form');
    O.clearFormErrors(form);
    var place = document.getElementById('if-place');
    var seat = document.getElementById('if-seat');
    var detail = document.getElementById('if-detail');
    var ok = true;
    if (!place.value) { O.setFieldError(place, '場所を選択してください'); ok = false; }
    if (seat.value && !/^[A-Za-z]-?\d{1,2}$/.test(seat.value.trim())) { O.setFieldError(seat, '「F-5」の形で入力してください'); ok = false; }
    if (!detail.value.trim()) { O.setFieldError(detail, '内容を入力してください'); ok = false; }
    if (!ok) return;
    var blocked = !!seat.value && document.getElementById('if-block').checked;
    issues.unshift({
      id: Math.max.apply(null, issues.map(function (i) { return i.id; })) + 1,
      at: nowLabel(), place: place.value, seat: seat.value.trim().toUpperCase(), detail: detail.value.trim(), by: ME, status: 0, blocked: blocked,
    });
    AdminData.save('issues');
    O.closeModal('issue-modal');
    O.toast(blocked ? '報告しました。座席 ' + seat.value.trim().toUpperCase() + ' を販売停止にしました' : '報告しました');
    renderCleaning();
  }

  function resolveIssue(id) {
    var i = byId(issues, id);
    O.confirm({
      title: '不具合を解決にする',
      message: i.place + (i.seat ? ' ' + i.seat : '') + '「' + i.detail + '」を解決済みにします。' + (i.blocked ? '販売停止中の座席も販売を再開します。' : ''),
      okLabel: '解決にする',
      onOk: function () {
        i.status = 1;
        i.blocked = false;
        AdminData.save('issues');
        O.toast('解決済みにしました');
        renderCleaning();
      },
    });
  }

  /* ════════ 初期化 ════════ */
  function confirmReset() {
    O.confirm({
      title: 'テストデータに戻す',
      message: 'DBファイル（db.json）を data/admin/seed.json の内容に戻します。在庫・商品・シフト・清掃・不具合の書き換えはすべて消えます。',
      okLabel: '戻す',
      onOk: function () { AdminData.reset(); },
    });
  }

  AdminData.onReady(function (db) {
    TODAY = O.today;
    stockLogs = db.stock_logs;
    issues = db.issues;
    PLACES = M.SCREENS.map(function (s) { return s.name; }).concat(['ロビー', '売店', 'トイレ', 'その他']);
    weekStart = mondayOf(TODAY);
    document.getElementById('reset-btn').addEventListener('click', confirmReset);

    renderStock();
    renderProducts();
    renderShift();
    renderCleaning();

    document.getElementById('stock-type').addEventListener('input', renderStock);
    document.getElementById('stock-need').addEventListener('change', renderStock);
    document.getElementById('stock-save-btn').addEventListener('click', saveStock);
    document.getElementById('stock-csv-btn').addEventListener('click', exportOrderList);

    document.getElementById('prod-search').addEventListener('input', renderProducts);
    document.getElementById('prod-type').addEventListener('input', renderProducts);
    document.getElementById('prod-add-btn').addEventListener('click', function () { openProdModal(null); });
    document.getElementById('prod-save-btn').addEventListener('click', saveProd);

    document.getElementById('shift-prev').addEventListener('click', function () { weekStart = M.addDays(weekStart, -7); renderShift(); });
    document.getElementById('shift-next').addEventListener('click', function () { weekStart = M.addDays(weekStart, 7); renderShift(); });
    document.getElementById('shift-save-btn').addEventListener('click', saveShift);
    document.getElementById('shift-off-btn').addEventListener('click', setOff);

    document.getElementById('issue-add-btn').addEventListener('click', openIssueModal);
    document.getElementById('issue-save-btn').addEventListener('click', saveIssue);
    document.getElementById('if-place').addEventListener('input', function () {
      document.getElementById('if-seat-field').hidden = this.value.indexOf('SCREEN') !== 0;
    });

    document.addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.receive) openStockModal('receive', Number(t.dataset.receive));
      else if (t.dataset.adjust) openStockModal('adjust', Number(t.dataset.adjust));
      else if (t.dataset.editProd) openProdModal(Number(t.dataset.editProd));
      else if (t.dataset.shift) openShiftModal(t.dataset.shift);
      else if (t.dataset.clean) markClean(t.dataset.clean);
      else if (t.dataset.resolve) resolveIssue(Number(t.dataset.resolve));
    });
  });
})();
