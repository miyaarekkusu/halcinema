/* ============================================================
   HAL CINEMA — admin-common.js
   管理者画面 各ページ共通スクリプト
   ・未ログインなら html/login.html へリダイレクト
   ・サイドバーの現在地ハイライト／ログアウト／サブタブ切り替え
   ・QRコード読み取り（フルスクリーンモーダル）
   ・POSカート／座席変更マップの共通ロジック（window.AdminUI として公開）
   ============================================================ */
(function () {
  var AUTH_KEY = 'hal_admin_authed';
  var ID_KEY   = 'hal_admin_id';

  if (sessionStorage.getItem(AUTH_KEY) !== 'true') {
    location.href = '../html/login.html';
    return;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var userEl = document.getElementById('topbar-user');
    if (userEl) userEl.textContent = sessionStorage.getItem(ID_KEY) || 'admin';

    var currentPage = document.body.dataset.page;
    document.querySelectorAll('.sidebar__item').forEach(function (item) {
      item.classList.toggle('sidebar__item--active', item.dataset.page === currentPage);
    });

    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(ID_KEY);
        location.href = '../html/login.html';
      });
    }

    var sidebarToggle = document.getElementById('sidebar-toggle');
    var sidebar = document.getElementById('sidebar');
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', function () {
        sidebar.classList.toggle('sidebar--open');
      });
    }

    /* ── サブタブ（ページ内の詳細機能切り替え） ── */
    var subtabButtons = document.querySelectorAll('.subtab-item');
    if (subtabButtons.length) {
      subtabButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          subtabButtons.forEach(function (b) {
            b.classList.toggle('subtab-item--active', b === btn);
          });
          var tab = btn.dataset.tab;
          document.querySelectorAll('.subtab-pane').forEach(function (pane) {
            pane.hidden = pane.dataset.tabPane !== tab;
          });
        });
      });
    }

    /* ── QRコード読み取り（テスト） ── */
    var qrBtn = document.getElementById('qr-test-btn');
    if (qrBtn) {
      qrBtn.addEventListener('click', function () {
        var buildDemo = QR_DEMO_BY_PAGE[currentPage] || QR_DEMO_BY_PAGE.ticket;
        showQrModal(buildDemo(), currentPage);
      });
    }

    var qrCloseBtn = document.getElementById('qr-modal-close');
    if (qrCloseBtn) qrCloseBtn.addEventListener('click', hideQrModal);

    var qrCancelBtn = document.getElementById('qr-modal-cancel');
    if (qrCancelBtn) qrCancelBtn.addEventListener('click', hideQrModal);

    var qrBackdrop = document.getElementById('qr-modal-backdrop');
    if (qrBackdrop) {
      qrBackdrop.addEventListener('click', function (e) {
        if (e.target === qrBackdrop) hideQrModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideQrModal();
    });
  });

  /* ──────────────────────────────────────────────
     QRコード読み取り時に画面ごとに表示する内容（テスト用ダミーデータ）
     実機ではスキャナから受け取った予約番号等をもとに
     サーバーへ問い合わせ、同じ形の値を showQrModal(data, page) に渡せばよい
  ────────────────────────────────────────────── */
  function randCode(prefix) {
    return prefix + '-' + String(Math.floor(Math.random() * 900000) + 100000);
  }

  function nowTime() {
    return new Date().toLocaleTimeString('ja-JP');
  }

  var QR_DEMO_BY_PAGE = {
    // 発券：この予約を実際に発券してよいかどうか
    ticket: function () {
      var issuable = Math.random() < 0.85;
      return {
        予約番号: randCode('HAL'),
        作品:     'サンプルムービー',
        上映:     '12:30～14:45 / スクリーン 2',
        座席:     'G-' + (Math.floor(Math.random() * 12) + 1),
        発券可否: issuable ? '発券可' : '発券不可（時間外／発券済み）',
        読取時刻: nowTime(),
      };
    },
    // フード：注文番号と注文内容（スタッフが受け渡し操作を行う）
    food: function () {
      return {
        注文番号: randCode('F'),
        注文内容: 'ポップコーン(L) ×1 / コーラ(M) ×2',
        合計金額: '¥1,450',
        受渡状況: '未受渡',
        読取時刻: nowTime(),
      };
    },
    // グッズ：注文番号と商品内容（スタッフが受け渡し操作を行う）
    goods: function () {
      return {
        注文番号: randCode('G'),
        商品内容: 'アクリルスタンド ×1 / パンフレット ×1',
        合計金額: '¥1,800',
        受渡状況: '未受渡',
        読取時刻: nowTime(),
      };
    },
    // 入場ゲート：このチケットが使用済みかどうか
    gate: function () {
      var used = Math.random() < 0.3;
      return {
        予約番号: randCode('HAL'),
        座席:     'G-' + (Math.floor(Math.random() * 12) + 1),
        上映:     '12:30～14:45 / スクリーン 2',
        入場状況: used ? '使用済み（再入場不可）' : '未使用（入場可）',
        読取時刻: nowTime(),
      };
    },
  };

  var QR_ACTION_LABEL = {
    ticket: '発券する',
    food:   '受け渡し完了にする',
    goods:  '受け渡し完了にする',
    gate:   '通過を記録する',
  };

  /* ──────────────────────────────────────────────
     QRコード読み取りモーダル（画面全体に被せて表示）
     フード・グッズ売り場等では他の操作画面の上に
     優先して割り込む必要があるため、トーストではなく
     全画面オーバーレイで表示する
  ────────────────────────────────────────────── */
  function showQrModal(data, pageKey) {
    var backdrop = document.getElementById('qr-modal-backdrop');
    var body = document.getElementById('qr-modal-body');
    if (!backdrop || !body) return;

    body.innerHTML = Object.keys(data).map(function (key) {
      return '<div class="qr-modal__row">' +
               '<span class="qr-modal__key">' + key + '</span>' +
               '<span class="qr-modal__val">' + data[key] + '</span>' +
             '</div>';
    }).join('');

    var actionBtn = document.getElementById('qr-modal-action');
    if (actionBtn) {
      actionBtn.disabled = false;
      actionBtn.textContent = QR_ACTION_LABEL[pageKey] || '確認しました';
      actionBtn.onclick = function () {
        actionBtn.disabled = true;
        actionBtn.textContent = '処理しました';
        setTimeout(hideQrModal, 700);
      };
    }

    backdrop.hidden = false;
  }

  function hideQrModal() {
    var backdrop = document.getElementById('qr-modal-backdrop');
    if (!backdrop || backdrop.hidden) return;
    backdrop.hidden = true;
  }

  /* ──────────────────────────────────────────────
     POSカート（フード／グッズの店頭販売タブで使用）
     root 内の .pos-product（data-name / data-price）をクリックでカートに追加、
     .pos-cart__list / .pos-cart__empty / .pos-cart__total-value / .pos-checkout-btn を自動更新する
  ────────────────────────────────────────────── */
  function initPosCart(root) {
    if (!root) return;
    var cart = [];
    var listEl     = root.querySelector('.pos-cart__list');
    var emptyEl    = root.querySelector('.pos-cart__empty');
    var totalEl    = root.querySelector('.pos-cart__total-value');
    var checkoutBtn = root.querySelector('.pos-checkout-btn');

    function render() {
      if (!listEl) return;
      listEl.innerHTML = '';
      if (cart.length === 0) {
        if (emptyEl) emptyEl.hidden = false;
      } else {
        if (emptyEl) emptyEl.hidden = true;
        cart.forEach(function (item, i) {
          var row = document.createElement('div');
          row.className = 'pos-cart__row';
          row.innerHTML =
            '<span class="pos-cart__row-name">' + item.name + ' ×' + item.qty + '</span>' +
            '<span>¥' + (item.price * item.qty).toLocaleString() + '</span>';
          var removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'pos-cart__row-remove';
          removeBtn.setAttribute('aria-label', '削除');
          removeBtn.textContent = '×';
          removeBtn.addEventListener('click', function () {
            cart.splice(i, 1);
            render();
          });
          row.appendChild(removeBtn);
          listEl.appendChild(row);
        });
      }
      var total = cart.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
      if (totalEl) totalEl.textContent = '¥' + total.toLocaleString();
      if (checkoutBtn) checkoutBtn.disabled = cart.length === 0;
    }

    root.querySelectorAll('.pos-product').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.dataset.name;
        var price = Number(btn.dataset.price);
        var existing = null;
        for (var i = 0; i < cart.length; i++) {
          if (cart[i].name === name) { existing = cart[i]; break; }
        }
        if (existing) existing.qty += 1;
        else cart.push({ name: name, price: price, qty: 1 });
        render();
      });
    });

    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', function () {
        if (cart.length === 0) return;
        cart = [];
        render();
        checkoutBtn.textContent = '会計しました';
        setTimeout(function () { checkoutBtn.textContent = '会計する'; }, 1500);
      });
    }

    render();
  }

  /* ──────────────────────────────────────────────
     座席変更マップ（ゲートの座席変更タブで使用）
     config: { root, rows, cols, currentSeat, takenRate, confirmBtn, onConfirm }
  ────────────────────────────────────────────── */
  function initSeatMap(config) {
    var root = config.root;
    if (!root) return;

    var ROWS = 'ABCDEFGHIJKLMN'.slice(0, config.rows || 8);
    var cols = config.cols || 12;
    var current = config.currentSeat;
    var takenRate = config.takenRate != null ? config.takenRate : 0.25;
    var selected = null;
    var confirmBtn = config.confirmBtn;

    function updateConfirmState() {
      if (confirmBtn) confirmBtn.disabled = !selected;
    }

    var takenSet = {};
    for (var ri = 0; ri < ROWS.length; ri++) {
      for (var ci = 1; ci <= cols; ci++) {
        var label = ROWS[ri] + '-' + ci;
        if (label !== current && Math.random() < takenRate) takenSet[label] = true;
      }
    }

    var wrap = document.createElement('div');
    wrap.className = 'seatmap-wrap';

    var screenEl = document.createElement('div');
    screenEl.className = 'seatmap-screen';
    wrap.appendChild(screenEl);

    var grid = document.createElement('div');
    grid.className = 'seatmap-grid';

    ROWS.split('').forEach(function (rowLetter) {
      var rowEl = document.createElement('div');
      rowEl.className = 'seatmap-row';

      var labelEl = document.createElement('span');
      labelEl.className = 'seatmap-row__label';
      labelEl.textContent = rowLetter;
      rowEl.appendChild(labelEl);

      for (var c = 1; c <= cols; c++) {
        var seatLabel = rowLetter + '-' + c;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'seat-btn';
        btn.textContent = String(c);
        btn.dataset.seat = seatLabel;

        if (seatLabel === current) {
          btn.classList.add('seat-btn--current');
          btn.disabled = true;
        } else if (takenSet[seatLabel]) {
          btn.disabled = true;
        } else {
          btn.addEventListener('click', function () {
            if (selected && selected !== this) {
              selected.classList.remove('seat-btn--selected');
            }
            if (selected === this) {
              selected.classList.remove('seat-btn--selected');
              selected = null;
            } else {
              selected = this;
              selected.classList.add('seat-btn--selected');
            }
            updateConfirmState();
          });
        }
        rowEl.appendChild(btn);
      }
      grid.appendChild(rowEl);
    });

    wrap.appendChild(grid);

    var legend = document.createElement('div');
    legend.className = 'seatmap-legend';
    legend.innerHTML =
      '<span><span class="seatmap-legend__dot" style="background:var(--ad-surface3)"></span>空席</span>' +
      '<span><span class="seatmap-legend__dot" style="background:#2A2D38"></span>使用不可（他の予約）</span>' +
      '<span><span class="seatmap-legend__dot" style="background:var(--ad-red)"></span>現在の座席</span>' +
      '<span><span class="seatmap-legend__dot" style="background:var(--ad-green)"></span>変更先（選択中）</span>';
    wrap.appendChild(legend);

    root.innerHTML = '';
    root.appendChild(wrap);
    updateConfirmState();

    if (confirmBtn) {
      confirmBtn.onclick = function () {
        if (!selected) return;
        if (config.onConfirm) config.onConfirm(selected.dataset.seat);
      };
    }
  }

  window.AdminUI = {
    initPosCart: initPosCart,
    initSeatMap: initSeatMap,
  };
})();
