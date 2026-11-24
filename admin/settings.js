/* ============================================================
   HAL CINEMA — settings.js（G06 設定：管理者アカウント）
   画面設計書（B_IH31_08_画面設計書.xlsx「画面設計書(設定)」「設定_項目チェック」）の項目ID・チェックに合わせている
   ※ データは data/admin/seed.json → db.json の admins（AdminData 経由で保存）
   ※ パスワードはチェックのみで保存しない（サーバー接続後に bcrypt で保存）
   ※ ロールチェック（支配人以外はダッシュボードへ戻す）はロールの見直し時に入れる
   API 接続時の置き換え先：GET/POST /api/admin/admins ／ PATCH /api/admin/admins/{id}
   ============================================================ */
(function () {
  var O = window.Office;
  var ME = sessionStorage.getItem('hal_admin_id') || 'admin';   // ログイン中の管理者ID
  var ROLE_LABEL = { manager: '支配人', accounting: '経理', staff: 'スタッフ' };

  var admins;          // データ読み込み後に入る
  var editingId = null;

  function byId(id) { return admins.find(function (a) { return a.id === Number(id); }); }
  function activeManagers() { return admins.filter(function (a) { return a.role === 'manager' && a.active; }); }

  /* ── 一覧（admin-tbody） ── */
  function render() {
    document.getElementById('admin-count').textContent =
      '全 ' + admins.length + ' 件（有効 ' + admins.filter(function (a) { return a.active; }).length + ' 件）';
    document.getElementById('admin-tbody').innerHTML = admins.map(function (a) {
      var self = a.code === ME;
      return '<tr class="' + (a.active ? '' : 'row--muted') + '">' +
        '<td><b>' + O.esc(a.code) + '</b>' + (self ? '<span class="sub">（自分）</span>' : '') + '</td>' +
        '<td>' + O.esc(a.name) + '</td>' +
        '<td>' + ROLE_LABEL[a.role] + '</td>' +
        '<td>' + (a.last_login_at ? O.esc(a.last_login_at) : '—') + '</td>' +
        '<td>' + (a.active ? '<span class="badge badge--green">有効</span>' : '<span class="badge badge--gray">無効</span>') + '</td>' +
        '<td class="actions"><button class="toolbar__btn toolbar__btn--sm" data-edit-admin="' + a.id + '">編集</button></td>' +
      '</tr>';
    }).join('');
  }

  /* ── 追加・編集モーダル ── */
  function openModal(id) {
    var form = document.getElementById('admin-form');
    form.reset();
    O.clearFormErrors(form);
    editingId = id || null;
    var a = id ? byId(id) : null;
    var self = a && a.code === ME;
    document.getElementById('admin-modal-title').textContent = a ? 'アカウントを編集' : 'アカウントを追加';

    var code = document.getElementById('af-code');
    code.value = a ? a.code : '';
    code.disabled = !!a;                                   // 管理者IDは追加時のみ入力可
    document.getElementById('af-name').value = a ? a.name : '';
    var role = document.getElementById('af-role');
    role.value = a ? a.role : '';
    role.disabled = !!self;                                // 自分のロールは変えられない
    var active = document.getElementById('af-active');
    active.checked = a ? a.active : true;
    active.disabled = !!self;                              // 自分は無効化できない
    document.getElementById('af-password-req').hidden = !!a;
    document.getElementById('af-password-hint').textContent = a
      ? '変更するときだけ入力（空欄なら変更しない）。8文字以上・英字と数字を混在'
      : '8文字以上・英字と数字を混在';
    O.openModal('admin-modal');
  }

  function save() {
    var form = document.getElementById('admin-form');
    O.clearFormErrors(form);
    var alert = document.getElementById('admin-form-alert');
    var a = editingId ? byId(editingId) : null;
    var codeEl = document.getElementById('af-code');
    var nameEl = document.getElementById('af-name');
    var roleEl = document.getElementById('af-role');
    var pwEl = document.getElementById('af-password');
    var activeEl = document.getElementById('af-active');
    var ok = true;

    // 3. 必須チェック / 4. 管理者IDの形式 / 5. 重複
    var code = codeEl.value.trim();
    if (!a) {
      if (!code) { O.setFieldError(codeEl, '管理者IDを入力してください'); ok = false; }
      else if (!/^[A-Za-z0-9]{4,20}$/.test(code)) { O.setFieldError(codeEl, '半角英数4〜20文字で入力してください'); ok = false; }
      else if (admins.some(function (x) { return x.code.toLowerCase() === code.toLowerCase(); })) { O.setFieldError(codeEl, 'この管理者IDはすでに使われています'); ok = false; }
    }
    var name = nameEl.value.trim();
    if (!name) { O.setFieldError(nameEl, '名前を入力してください'); ok = false; }
    if (!roleEl.value) { O.setFieldError(roleEl, 'ロールを選択してください'); ok = false; }
    // 6. パスワード（追加時は必須・編集時は入力したときだけ）
    var pw = pwEl.value;
    if (!a && !pw) { O.setFieldError(pwEl, 'パスワードを入力してください'); ok = false; }
    else if (pw && !(pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw))) { O.setFieldError(pwEl, '8文字以上で、英字と数字を混在させてください'); ok = false; }
    if (!ok) return;

    if (a) {
      var demote = a.role === 'manager' && roleEl.value !== 'manager';
      var disable = a.active && !activeEl.checked;
      // 7. 自分自身チェック（M11）
      if (a.code === ME && (roleEl.value !== a.role || !activeEl.checked)) {
        alert.textContent = '自分自身のロール変更・無効化はできません';
        alert.hidden = false;
        return;
      }
      // 8. 支配人数チェック
      if ((demote || disable) && a.role === 'manager' && a.active && activeManagers().length <= 1) {
        alert.textContent = '有効な支配人が1人だけのため、この管理者を無効化・降格できません';
        alert.hidden = false;
        return;
      }
      a.name = name;
      a.role = roleEl.value;
      a.active = activeEl.checked;
    } else {
      admins.push({
        id: Math.max.apply(null, admins.map(function (x) { return x.id; })) + 1,
        code: code, name: name, role: roleEl.value, active: activeEl.checked, last_login_at: null,
      });
    }
    AdminData.save('admins');
    O.closeModal('admin-modal');
    O.toast('保存しました');
    render();
  }

  AdminData.onReady(function (db) {
    admins = db.admins;
    // トップバーに「管理者ID（ロール名）」
    var me = admins.find(function (a) { return a.code === ME; });
    var userEl = document.getElementById('topbar-user');
    if (userEl && me) userEl.textContent = me.code + '（' + ROLE_LABEL[me.role] + '）';

    render();
    document.getElementById('admin-add-btn').addEventListener('click', function () { openModal(null); });
    document.getElementById('admin-save-btn').addEventListener('click', save);
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-edit-admin]');
      if (t) openModal(Number(t.dataset.editAdmin));
    });
  });
})();
