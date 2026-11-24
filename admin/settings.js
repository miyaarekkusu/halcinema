/* ============================================================
   HAL CINEMA — settings.js（G06 設定）
   ※ モック：データはこのファイル内のサンプル。保存はメモリ上のみ（再読み込みで戻る）
   API 接続時の置き換え先：
     GET/POST/PATCH  /api/admin/admins
     ログイン中の管理者は GET /api/admin/me
   ============================================================ */
(function () {
  var O = window.Office;

  var ROLE_LABEL = { manager: '支配人', accounting: '経理', staff: 'スタッフ' };

  /* ── サンプルデータ（t_ADMIN） ── */
  var admins = [
    { id: 1, code: 'manager01', name: '山田', role: 'manager',    last_login: '2026-12-01 09:02', active: true },
    { id: 2, code: 'acct01',    name: '田中', role: 'accounting', last_login: '2026-11-30 18:40', active: true },
    { id: 3, code: 'staff01',   name: '伊藤', role: 'staff',      last_login: '2026-12-01 08:45', active: true },
    { id: 4, code: 'staff02',   name: '渡辺', role: 'staff',      last_login: '2026-11-28 17:12', active: true },
    { id: 5, code: 'staff03',   name: '高橋', role: 'staff',      last_login: null,               active: false },
  ];

  // ログイン中の管理者（モック。接続後は GET /api/admin/me）
  var SELF_ID = 1;

  function byId(id) { return admins.find(function (a) { return a.id === Number(id); }); }

  function activeManagerCount() {
    return admins.filter(function (a) { return a.role === 'manager' && a.active; }).length;
  }

  // 12/01 09:02
  function shortDateTime(s) {
    if (!s) return '—';
    var p = s.split(' ');
    return O.md(p[0]) + ' ' + p[1];
  }

  /* ════════ 管理者アカウント ════════ */
  function renderAdmins() {
    var tbody = document.getElementById('admin-tbody');
    if (!admins.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">まだ登録がありません</td></tr>';
      return;
    }
    tbody.innerHTML = admins.map(function (a) {
      return '<tr class="' + (a.active ? '' : 'row--muted') + '">' +
        '<td class="st-mono"><b>' + O.esc(a.code) + '</b>' + (a.id === SELF_ID ? '<span class="st-self">（自分）</span>' : '') + '</td>' +
        '<td>' + O.esc(a.name) + '</td>' +
        '<td>' + ROLE_LABEL[a.role] + '</td>' +
        '<td class="st-mono">' + shortDateTime(a.last_login) + '</td>' +
        '<td>' + (a.active ? '<span class="badge badge--green">有効</span>' : '<span class="badge badge--gray">無効</span>') + '</td>' +
        '<td class="actions"><button class="toolbar__btn toolbar__btn--sm" data-edit-admin="' + a.id + '">編集</button></td>' +
      '</tr>';
    }).join('');
  }

  var editingId = null;

  function setLocked(locked) {
    var role = document.getElementById('af-role');
    var active = document.getElementById('af-active');
    role.disabled = locked;
    active.disabled = locked;
    active.closest('label').classList.toggle('is-disabled', locked);
  }

  function openAdminModal(id) {
    var form = document.getElementById('admin-form');
    form.reset();
    O.clearFormErrors(form);
    editingId = id || null;

    var code = form.querySelector('#af-code');
    document.getElementById('admin-modal-title').textContent = id ? 'アカウントを編集' : 'アカウントを追加';
    code.readOnly = !!id;
    document.getElementById('af-code-hint').textContent = id ? '管理者IDは変更できません' : '半角英数4〜20文字';
    document.getElementById('af-password-req').hidden = !!id;
    document.getElementById('af-password-hint').textContent = id
      ? '変更する場合のみ入力（8文字以上・英字と数字を混在）'
      : '8文字以上・英字と数字を混在';

    if (id) {
      var a = byId(id);
      code.value = a.code;
      form.querySelector('#af-name').value = a.name;
      form.querySelector('#af-role').value = a.role;
      form.querySelector('#af-active').checked = a.active;
    }
    // 自分自身のロール変更・無効化は不可
    setLocked(!!id && Number(id) === SELF_ID);
    O.openModal('admin-modal');
  }

  function showFormAlert(message) {
    var el = document.getElementById('admin-form-alert');
    el.textContent = message;
    el.hidden = false;
  }

  function saveAdmin() {
    var form = document.getElementById('admin-form');
    O.clearFormErrors(form);
    var code = form.querySelector('#af-code');
    var name = form.querySelector('#af-name');
    var role = form.querySelector('#af-role');
    var pw = form.querySelector('#af-password');
    var active = form.querySelector('#af-active').checked;
    var ok = true;

    if (!editingId) {
      var c = code.value.trim();
      if (!/^[A-Za-z0-9]{4,20}$/.test(c)) { O.setFieldError(code, '半角英数4〜20文字で入力してください'); ok = false; }
      else if (admins.some(function (a) { return a.code === c; })) { O.setFieldError(code, 'この管理者IDはすでに使われています'); ok = false; }
    }
    var n = name.value.trim();
    if (!n) { O.setFieldError(name, '名前を入力してください'); ok = false; }
    else if (n.length > 50) { O.setFieldError(name, '50文字以内で入力してください'); ok = false; }
    if (!role.value) { O.setFieldError(role, 'ロールを選択してください'); ok = false; }
    if (!editingId && !pw.value) { O.setFieldError(pw, 'パスワードを入力してください'); ok = false; }
    else if (pw.value && !(pw.value.length >= 8 && /[A-Za-z]/.test(pw.value) && /[0-9]/.test(pw.value) && /^[A-Za-z0-9]+$/.test(pw.value))) {
      O.setFieldError(pw, '8文字以上で、英字と数字を混在させてください'); ok = false;
    }
    if (!ok) return;

    if (editingId) {
      var target = byId(editingId);
      var demoteOrDisable = (target.role === 'manager' && role.value !== 'manager') || (target.active && !active);
      // M11：自分自身のロール変更・無効化
      if (target.id === SELF_ID && (target.role !== role.value || !active)) {
        showFormAlert('自分自身のロール変更・無効化はできません');
        return;
      }
      // 有効な manager が1人だけのとき、その人を無効化・降格できない
      if (target.role === 'manager' && target.active && demoteOrDisable && activeManagerCount() <= 1) {
        showFormAlert('有効な支配人が1人だけのため、この管理者を無効化・降格できません');
        return;
      }
      target.name = n;
      target.role = role.value;
      target.active = active;
    } else {
      var a = {
        id: Math.max.apply(null, admins.map(function (x) { return x.id; })) + 1,
        code: code.value.trim(), name: n, role: role.value, last_login: null, active: active,
      };
      admins.push(a);
    }
    O.closeModal('admin-modal');
    O.toast('保存しました');
    renderAll();
  }

  function renderAll() {
    renderAdmins();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('admin-add-btn').addEventListener('click', function () { openAdminModal(null); });
    document.getElementById('admin-tbody').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-edit-admin]');
      if (btn) openAdminModal(btn.dataset.editAdmin);
    });
    document.getElementById('admin-save-btn').addEventListener('click', saveAdmin);
    document.getElementById('admin-form').addEventListener('submit', function (e) { e.preventDefault(); saveAdmin(); });

    renderAll();
  });
})();
