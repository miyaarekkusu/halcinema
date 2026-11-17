/* ============================================================
   HAL CINEMA — admin-office.js
   管理（事務所）画面の共通部品（G03 作品・配給 / G05 売上・精算）
   ・モーダル開閉、確認ダイアログ、トースト
   ・URLハッシュでタブを直接開く（movies.html#contracts など）
   ・金額・日付の表示整形
   ※ 現在はモック。データは各ページの JS 内のサンプル
   ============================================================ */
(function () {
  var WEEK = ['日', '月', '火', '水', '木', '金', '土'];

  function yen(n) {
    if (n == null || isNaN(n)) return '—';
    return '¥' + Math.round(n).toLocaleString('ja-JP');
  }

  function pct(n) { return Number(n).toFixed(1) + '%'; }

  function parseDate(s) {
    var p = s.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function toISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // 12/01（火）
  function md(s, withWeek) {
    var d = typeof s === 'string' ? parseDate(s) : s;
    var t = String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
    return withWeek ? t + '（' + WEEK[d.getDay()] + '）' : t;
  }

  function daysBetween(a, b) {
    return Math.round((parseDate(b) - parseDate(a)) / 86400000);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── モーダル ── */
  function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = false;
  }
  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.hidden = true;
  }

  document.addEventListener('click', function (e) {
    var closer = e.target.closest('[data-close-modal]');
    if (closer) {
      closer.closest('.ad-modal-backdrop').hidden = true;
      return;
    }
    if (e.target.classList && e.target.classList.contains('ad-modal-backdrop')) {
      e.target.hidden = true;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.ad-modal-backdrop').forEach(function (m) { m.hidden = true; });
  });

  /* ── 確認ダイアログ（戻せない操作の前に必ず出す） ── */
  function confirmDialog(opts) {
    var root = document.getElementById('confirm-modal');
    if (!root) {
      root = document.createElement('div');
      root.className = 'ad-modal-backdrop';
      root.id = 'confirm-modal';
      root.hidden = true;
      root.innerHTML =
        '<div class="ad-modal ad-modal--sm" role="dialog" aria-modal="true">' +
          '<div class="ad-modal__head"><span class="ad-modal__title" id="confirm-title"></span>' +
          '<button class="ad-modal__close" data-close-modal aria-label="閉じる">×</button></div>' +
          '<div class="ad-modal__body" id="confirm-body"></div>' +
          '<div class="ad-modal__foot">' +
            '<button class="toolbar__btn" data-close-modal>キャンセル</button>' +
            '<button class="toolbar__btn toolbar__btn--primary" id="confirm-ok"></button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(root);
    }
    document.getElementById('confirm-title').textContent = opts.title || '確認';
    document.getElementById('confirm-body').innerHTML = opts.html || esc(opts.message || '');
    var ok = document.getElementById('confirm-ok');
    ok.textContent = opts.okLabel || 'OK';
    ok.onclick = function () {
      root.hidden = true;
      if (opts.onOk) opts.onOk();
    };
    root.hidden = false;
  }

  /* ── トースト ── */
  var toastTimer = null;
  function toast(message, type) {
    var el = document.getElementById('office-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'office-toast';
      el.className = 'sched-toast';
      document.body.appendChild(el);
    }
    el.className = 'sched-toast' + (type === 'error' ? ' sched-toast--error' : '');
    el.innerHTML = '<div class="sched-toast__title">' + (type === 'error' ? 'エラー' : '完了') + '</div>' + esc(message);
    el.hidden = false;
    clearTimeout(toastTimer);
    if (type !== 'error') toastTimer = setTimeout(function () { el.hidden = true; }, 3000);
    else el.onclick = function () { el.hidden = true; };
  }

  /* ── URLハッシュでタブを開く ── */
  function openTabFromHash() {
    var tab = location.hash.replace('#', '');
    if (!tab) return;
    var btn = document.querySelector('.subtab-item[data-tab="' + tab + '"]');
    if (btn) btn.click();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.subtab-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        history.replaceState(null, '', '#' + btn.dataset.tab);
      });
    });
    // admin-common.js のタブ処理が登録されてから実行する
    setTimeout(openTabFromHash, 0);
  });

  /* ── フォームのエラー表示 ── */
  function setFieldError(input, message) {
    var field = input.closest('.form-field');
    if (!field) return;
    field.classList.toggle('form-field--error', !!message);
    var err = field.querySelector('.form-field__error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'form-field__error';
      field.appendChild(err);
    }
    err.textContent = message || '';
  }

  function clearFormErrors(form) {
    form.querySelectorAll('.form-field--error').forEach(function (f) { f.classList.remove('form-field--error'); });
    form.querySelectorAll('.form-field__error').forEach(function (e) { e.textContent = ''; });
    var alert = form.querySelector('.form-alert');
    if (alert) alert.hidden = true;
  }

  window.Office = {
    yen: yen, pct: pct, md: md, esc: esc,
    parseDate: parseDate, toISO: toISO, daysBetween: daysBetween,
    openModal: openModal, closeModal: closeModal,
    confirm: confirmDialog, toast: toast,
    setFieldError: setFieldError, clearFormErrors: clearFormErrors,
    // モックの「今日」。サーバー接続後は API の日付を使う
    today: '2026-12-02',
  };
})();
