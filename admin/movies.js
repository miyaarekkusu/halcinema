/* ============================================================
   HAL CINEMA — movies.js（G03 作品・配給）
   ※ モック：データはこのファイル内のサンプル。保存はメモリ上のみ（再読み込みで戻る）
   API 接続時の置き換え先：
     GET/POST  /api/admin/movies          PATCH /api/admin/movies/{id}
     GET/POST  /api/admin/distributors    PATCH /api/admin/distributors/{id}
     GET/POST  /api/admin/contracts       PATCH /api/admin/contracts/{id}
   ============================================================ */
(function () {
  var O = window.Office;
  var TODAY = O.today;

  var GENRES = ['アクション / SF', 'アニメ / ミステリー', 'アニメ / スポーツ', 'アニメ / ファミリー', 'ドラマ', 'コメディ', 'ホラー', 'ミュージカル'];

  /* ── サンプルデータ ── */
  var movies = [
    { id: 1, title: 'ゴジラ-1.0',              title_en: 'GODZILLA MINUS ONE', genre: 'アクション / SF',   duration: 125, rating: 'G',    release_date: '2026-11-01', poster: 'godzilla-minus-one',      formats: ['2D', 'IMAX'] },
    { id: 2, title: '名探偵コナン 黒鉄の魚影',  title_en: '',                  genre: 'アニメ / ミステリー', duration: 113, rating: 'G',    release_date: '2026-11-08', poster: 'conan-black-iron',        formats: ['2D'] },
    { id: 3, title: 'THE FIRST SLAM DUNK',     title_en: '',                  genre: 'アニメ / スポーツ',  duration: 124, rating: 'G',    release_date: '2026-10-01', poster: 'first-slam-dunk',         formats: ['2D', '4DX'] },
    { id: 4, title: '君たちはどう生きるか',      title_en: 'The Boy and the Heron', genre: 'アニメ / ファミリー', duration: 124, rating: 'G', release_date: '2026-09-01', poster: 'boy-and-the-heron',  formats: ['2D'] },
    { id: 5, title: 'プラダを着た悪魔2',         title_en: 'The Devil Wears Prada 2', genre: 'コメディ',   duration: 118, rating: 'G',    release_date: '2026-12-10', poster: 'devil-wears-prada-2',     formats: ['2D'] },
    { id: 6, title: 'トイ・ストーリー5',         title_en: 'Toy Story 5',       genre: 'アニメ / ファミリー', duration: 105, rating: 'G',    release_date: '2026-12-19', poster: 'toy-story-5',             formats: ['2D', '3D'] },
    { id: 7, title: 'マイケル',                 title_en: 'Michael',           genre: 'ドラマ',            duration: 132, rating: 'PG12', release_date: '2026-11-20', poster: 'michael',                 formats: ['2D', 'IMAX'] },
    { id: 8, title: '口に関するアンケート',       title_en: '',                  genre: 'ホラー',            duration: 98,  rating: 'R15+', release_date: '2026-12-05', poster: 'kuchi-ni-kansuru-anketo', formats: ['2D'] },
  ];

  var distributors = [
    { id: 1, name: '東邦映画配給',        contact: '佐藤 健一', phone: '03-1234-5678', email: 'sato@example.jp',   active: true },
    { id: 2, name: 'ワールドピクチャーズ', contact: '鈴木 花子', phone: '06-2345-6789', email: 'suzuki@example.jp', active: true },
    { id: 3, name: 'スタジオ北斗',        contact: '高田 誠',   phone: '052-345-6789', email: '',                  active: true },
    { id: 4, name: '旧ミナト映画',        contact: '',          phone: '',             email: '',                  active: false },
  ];

  // status 0:有効 / 1:終了 / 2:打ち切り
  var contracts = [
    { id: 1, movie_id: 1, dist_id: 1, start: '2026-11-01', end: '2026-12-05', share: 50,   mg: 300000, status: 0, note: '' },
    { id: 2, movie_id: 2, dist_id: 1, start: '2026-11-08', end: '2026-12-31', share: 50,   mg: 0,      status: 0, note: '' },
    { id: 3, movie_id: 3, dist_id: 2, start: '2026-10-01', end: '2026-11-30', share: 45,   mg: 200000, status: 1, note: '' },
    { id: 4, movie_id: 4, dist_id: 3, start: '2026-09-01', end: '2026-10-31', share: 50,   mg: 0,      status: 1, note: '' },
    { id: 5, movie_id: 5, dist_id: 2, start: '2026-12-10', end: '2027-01-31', share: 45,   mg: 300000, status: 0, note: '' },
    { id: 6, movie_id: 6, dist_id: 2, start: '2026-12-19', end: '2027-02-28', share: 55,   mg: 500000, status: 0, note: '冬休み作品' },
    { id: 7, movie_id: 7, dist_id: 3, start: '2026-11-20', end: '2026-12-25', share: 47.5, mg: 1500000,      status: 0, note: '' },
    { id: 8, movie_id: 8, dist_id: 3, start: '2026-12-05', end: '2026-12-08', share: 40,   mg: 0,      status: 2, note: '動員不振のため打ち切り' },
  ];

  // 割り当て済み上映回（延長・打ち切り時の警告用のサンプル）
  var assignedShows = { 1: ['2026-12-03', '2026-12-04', '2026-12-05'], 7: ['2026-12-20', '2026-12-21', '2026-12-22', '2026-12-23'] };

  /* ── 参照ヘルパ ── */
  function byId(list, id) { return list.find(function (x) { return x.id === Number(id); }); }
  function movieContracts(movieId) { return contracts.filter(function (c) { return c.movie_id === movieId; }); }

  // 公開状態：上映中 > 公開予定 > 終映（設計書 B「公開状態の判定」）
  function movieStatus(movieId) {
    var active = movieContracts(movieId).filter(function (c) { return c.status === 0; });
    if (active.some(function (c) { return c.start <= TODAY && TODAY <= c.end; })) return 'showing';
    if (active.some(function (c) { return TODAY < c.start; })) return 'upcoming';
    return 'ended';
  }

  // 一覧に出す代表の契約（現在→今後→直近の順）
  function primaryContract(movieId) {
    var list = movieContracts(movieId).slice().sort(function (a, b) { return a.start < b.start ? 1 : -1; });
    return list.find(function (c) { return c.status === 0 && c.start <= TODAY && TODAY <= c.end; }) ||
           list.find(function (c) { return c.status === 0 && TODAY < c.start; }) ||
           list[0];
  }

  // 終了日を過ぎた有効契約は「終了」扱い
  function contractStatus(c) {
    if (c.status === 0 && c.end < TODAY) return 1;
    return c.status;
  }

  var STATUS_BADGE = {
    showing:  '<span class="badge badge--green">● 上映中</span>',
    upcoming: '<span class="badge badge--blue">○ 公開予定</span>',
    ended:    '<span class="badge badge--gray">― 終映</span>',
  };
  var CONTRACT_BADGE = [
    '<span class="badge badge--green">有効</span>',
    '<span class="badge badge--gray">終了</span>',
    '<span class="badge badge--red">打ち切り</span>',
  ];

  /* ════════ 作品タブ ════════ */
  function renderMovies() {
    var q = document.getElementById('movie-search').value.trim();
    var st = document.getElementById('movie-filter-status').value;
    var gn = document.getElementById('movie-filter-genre').value;
    var tbody = document.getElementById('movie-tbody');

    var rows = movies.filter(function (m) {
      if (q && m.title.indexOf(q) === -1 && (m.title_en || '').toLowerCase().indexOf(q.toLowerCase()) === -1) return false;
      if (st && movieStatus(m.id) !== st) return false;
      if (gn && m.genre !== gn) return false;
      return true;
    });

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">該当する作品がありません</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (m) {
      var c = primaryContract(m.id);
      var period = c ? O.md(c.start) + '〜' + O.md(c.end) + '<span class="sub">' + O.esc(byId(distributors, c.dist_id).name) + '</span>'
                     : '<span class="sub sub--warn">契約なし</span>';
      var poster = m.poster ? '<img class="poster-thumb" src="../images/poster/' + m.poster + '.jpg" alt="">' : '<span class="poster-thumb"></span>';
      // 上映実績がある作品は「削除」を出さず「非表示にする」（03 要相談2 で決定）
      var extra = hasShown(m.id)
        ? (m.hidden ? '<button class="toolbar__btn toolbar__btn--sm" data-unhide-movie="' + m.id + '">表示に戻す</button>'
                    : '<button class="toolbar__btn toolbar__btn--sm" data-hide-movie="' + m.id + '">非表示にする</button>')
        : '<button class="toolbar__btn toolbar__btn--sm toolbar__btn--ghost-red" data-delete-movie="' + m.id + '">削除</button>';
      return '<tr class="' + (m.hidden ? 'row--muted' : '') + '">' +
        '<td style="width:52px">' + poster + '</td>' +
        '<td><b>' + O.esc(m.title) + '</b>' + (m.title_en ? '<span class="sub">' + O.esc(m.title_en) + '</span>' : '') + '</td>' +
        '<td class="numeric">' + m.duration + '分</td>' +
        '<td>' + m.rating + '</td>' +
        '<td>' + STATUS_BADGE[movieStatus(m.id)] + (m.hidden ? ' <span class="badge badge--gray">非表示</span>' : '') + '</td>' +
        '<td>' + period + '</td>' +
        '<td class="actions"><button class="toolbar__btn toolbar__btn--sm" data-edit-movie="' + m.id + '">編集</button> ' + extra + '</td>' +
      '</tr>';
    }).join('');
  }

  // 上映実績あり＝上映開始日が今日以前の契約がある（API 接続後は t_SCHEDULE の上映済みの回の有無で判定）
  function hasShown(movieId) {
    return movieContracts(movieId).some(function (c) { return c.start <= TODAY; });
  }

  // 実績のない作品だけ削除できる（戻せない操作なので確認ダイアログを出す）
  function deleteMovie(id) {
    var m = byId(movies, id);
    var cs = movieContracts(id);
    O.confirm({
      title: '作品の削除',
      html: '<b>' + O.esc(m.title) + '</b> を削除します。' +
            (cs.length ? '<br>登録済みの契約 ' + cs.length + '件 も削除されます。' : '') +
            '<br>削除すると元に戻せません。よろしいですか？',
      okLabel: '削除する',
      onOk: function () {
        movies = movies.filter(function (x) { return x.id !== id; });
        contracts = contracts.filter(function (c) { return c.movie_id !== id; });
        O.toast('作品を削除しました');
        renderAll();
      },
    });
  }

  // 上映実績のある作品は非表示にする（利用者側の一覧に出さなくなる。データは残す）
  function hideMovie(id, hidden) {
    var m = byId(movies, id);
    if (!hidden) {
      m.hidden = false;
      O.toast('「' + m.title + '」を表示に戻しました');
      renderAll();
      return;
    }
    O.confirm({
      title: '作品を非表示にする',
      html: '<b>' + O.esc(m.title) + '</b> は上映実績があるため削除できません。<br>非表示にすると利用者側の作品一覧に表示されなくなります（売上・精算のデータは残ります）。よろしいですか？',
      okLabel: '非表示にする',
      onOk: function () {
        m.hidden = true;
        O.toast('「' + m.title + '」を非表示にしました');
        renderAll();
      },
    });
  }

  var editingMovieId = null;

  function openMovieModal(id) {
    var form = document.getElementById('movie-form');
    form.reset();
    O.clearFormErrors(form);
    editingMovieId = id || null;
    document.getElementById('movie-modal-title').textContent = id ? '作品を編集' : '作品を登録';
    if (id) {
      var m = byId(movies, id);
      form.querySelector('#mf-title').value = m.title;
      form.querySelector('#mf-title-en').value = m.title_en || '';
      form.querySelector('#mf-genre').value = m.genre;
      form.querySelector('#mf-duration').value = m.duration;
      form.querySelector('#mf-rating').value = m.rating;
      form.querySelector('#mf-release').value = m.release_date;
      form.querySelectorAll('#mf-formats input').forEach(function (cb) { cb.checked = (m.formats || []).indexOf(cb.value) !== -1; });
    }
    O.openModal('movie-modal');
  }

  function saveMovie() {
    var form = document.getElementById('movie-form');
    O.clearFormErrors(form);
    var title = form.querySelector('#mf-title');
    var genre = form.querySelector('#mf-genre');
    var dur = form.querySelector('#mf-duration');
    var rating = form.querySelector('#mf-rating');
    var rel = form.querySelector('#mf-release');
    var trailer = form.querySelector('#mf-trailer');
    var poster = form.querySelector('#mf-poster');
    var ok = true;

    if (!title.value.trim()) { O.setFieldError(title, 'タイトルを入力してください'); ok = false; }
    if (!genre.value) { O.setFieldError(genre, 'ジャンルを選択してください'); ok = false; }
    var d = Number(dur.value);
    if (!dur.value || !Number.isInteger(d) || d < 1 || d > 300) { O.setFieldError(dur, '1〜300の整数で入力してください'); ok = false; }
    if (!rating.value) { O.setFieldError(rating, 'レーティングを選択してください'); ok = false; }
    if (!rel.value) { O.setFieldError(rel, '公開日を入力してください'); ok = false; }
    if (trailer.value && !/^[A-Za-z0-9_-]{11}$/.test(trailer.value)) { O.setFieldError(trailer, 'YouTubeの動画ID（11文字）を入力してください'); ok = false; }
    if (poster.files[0] && poster.files[0].size > 1024 * 1024) { O.setFieldError(poster, '1MB以内の画像を選んでください'); ok = false; }
    if (!ok) return;

    var data = {
      title: title.value.trim(),
      title_en: form.querySelector('#mf-title-en').value.trim(),
      genre: genre.value, duration: d, rating: rating.value, release_date: rel.value,
      formats: Array.prototype.map.call(form.querySelectorAll('#mf-formats input:checked'), function (cb) { return cb.value; }),
    };

    if (editingMovieId) {
      Object.assign(byId(movies, editingMovieId), data);
    } else {
      data.id = Math.max.apply(null, movies.map(function (m) { return m.id; })) + 1;
      data.poster = null;
      movies.push(data);
    }
    O.closeModal('movie-modal');
    O.toast(editingMovieId ? '作品を更新しました' : '作品を登録しました。続けて「契約」タブで上映契約を登録してください');
    renderAll();
  }

  /* ════════ 配給会社タブ ════════ */
  function renderDistributors() {
    var q = document.getElementById('dist-search').value.trim();
    var tbody = document.getElementById('dist-tbody');
    var rows = distributors.filter(function (d) { return !q || d.name.indexOf(q) !== -1; });
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">該当する配給会社がありません</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (d) {
      var activeCount = contracts.filter(function (c) { return c.dist_id === d.id && contractStatus(c) === 0; }).length;
      var contact = [d.phone, d.email].filter(Boolean).join(' / ') || '<span class="sub">未登録</span>';
      return '<tr class="' + (d.active ? '' : 'row--muted') + '">' +
        '<td><b>' + O.esc(d.name) + '</b></td>' +
        '<td>' + (O.esc(d.contact) || '—') + '</td>' +
        '<td>' + contact + '</td>' +
        '<td class="numeric">' + activeCount + '本</td>' +
        '<td>' + (d.active ? '<span class="badge badge--green">有効</span>' : '<span class="badge badge--gray">無効</span>') + '</td>' +
        '<td class="actions"><button class="toolbar__btn toolbar__btn--sm" data-edit-dist="' + d.id + '">編集</button></td>' +
      '</tr>';
    }).join('');
  }

  var editingDistId = null;

  function openDistModal(id) {
    var form = document.getElementById('dist-form');
    form.reset();
    O.clearFormErrors(form);
    editingDistId = id || null;
    document.getElementById('dist-modal-title').textContent = id ? '配給会社を編集' : '配給会社を登録';
    if (id) {
      var d = byId(distributors, id);
      form.querySelector('#df-name').value = d.name;
      form.querySelector('#df-contact').value = d.contact;
      form.querySelector('#df-phone').value = d.phone;
      form.querySelector('#df-email').value = d.email;
      form.querySelector('#df-active').checked = d.active;
    }
    O.openModal('dist-modal');
  }

  function saveDist() {
    var form = document.getElementById('dist-form');
    O.clearFormErrors(form);
    var name = form.querySelector('#df-name');
    var phone = form.querySelector('#df-phone');
    var email = form.querySelector('#df-email');
    var ok = true;
    var n = name.value.trim();
    if (!n) { O.setFieldError(name, '社名を入力してください'); ok = false; }
    else if (distributors.some(function (d) { return d.name === n && d.id !== editingDistId; })) { O.setFieldError(name, '同じ社名がすでに登録されています'); ok = false; }
    if (phone.value && !/^[0-9-]+$/.test(phone.value)) { O.setFieldError(phone, '数字とハイフンで入力してください'); ok = false; }
    if (email.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value)) { O.setFieldError(email, 'メールアドレスの形式が正しくありません'); ok = false; }
    if (!ok) return;

    var data = {
      name: n, contact: form.querySelector('#df-contact').value.trim(),
      phone: phone.value.trim(), email: email.value.trim(),
      active: form.querySelector('#df-active').checked,
    };
    if (editingDistId) Object.assign(byId(distributors, editingDistId), data);
    else { data.id = Math.max.apply(null, distributors.map(function (d) { return d.id; })) + 1; distributors.push(data); }
    O.closeModal('dist-modal');
    O.toast('保存しました');
    renderAll();
  }

  /* ════════ 契約タブ ════════ */
  function renderContracts() {
    var st = document.getElementById('contract-filter-status').value;
    var mv = document.getElementById('contract-filter-movie').value;
    var ds = document.getElementById('contract-filter-dist').value;
    var tbody = document.getElementById('contract-tbody');

    var rows = contracts.filter(function (c) {
      if (st !== '' && contractStatus(c) !== Number(st)) return false;
      if (mv && c.movie_id !== Number(mv)) return false;
      if (ds && c.dist_id !== Number(ds)) return false;
      return true;
    }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">該当する契約がありません</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (c) {
      var s = contractStatus(c);
      var m = byId(movies, c.movie_id);
      var d = byId(distributors, c.dist_id);
      var sub = '';
      if (s === 0 && c.start <= TODAY) {
        var left = O.daysBetween(TODAY, c.end);
        sub = '<span class="sub' + (left <= 7 ? ' sub--warn' : '') + '">残り' + left + '日</span>';
      } else if (s === 0) {
        sub = '<span class="sub">開始まで' + O.daysBetween(TODAY, c.start) + '日</span>';
      }
      var actions = s === 0
        ? '<button class="toolbar__btn toolbar__btn--sm" data-extend="' + c.id + '">延長</button>' +
          '<button class="toolbar__btn toolbar__btn--sm toolbar__btn--ghost-red" data-cancel="' + c.id + '">打ち切り</button>'
        : '';
      return '<tr class="' + (s === 0 ? '' : 'row--muted') + '">' +
        '<td><b>' + O.esc(m.title) + '</b>' + (c.note ? '<span class="sub">' + O.esc(c.note) + '</span>' : '') + '</td>' +
        '<td>' + O.esc(d.name) + '</td>' +
        '<td>' + O.md(c.start) + '〜' + O.md(c.end) + sub + '</td>' +
        '<td class="numeric">' + O.pct(c.share) + '</td>' +
        '<td class="numeric">' + O.yen(c.mg) + '</td>' +
        '<td>' + CONTRACT_BADGE[s] + '</td>' +
        '<td class="actions">' + actions + '</td>' +
      '</tr>';
    }).join('');
  }

  function overlapping(movieId, start, end, exceptId) {
    return contracts.find(function (c) {
      return c.id !== exceptId && c.movie_id === movieId && c.status === 0 && c.start <= end && start <= c.end;
    });
  }

  function openContractModal() {
    var form = document.getElementById('contract-form');
    form.reset();
    O.clearFormErrors(form);
    O.openModal('contract-modal');
  }

  function saveContract() {
    var form = document.getElementById('contract-form');
    O.clearFormErrors(form);
    var movie = form.querySelector('#cf-movie');
    var dist = form.querySelector('#cf-dist');
    var start = form.querySelector('#cf-start');
    var end = form.querySelector('#cf-end');
    var share = form.querySelector('#cf-share');
    var mg = form.querySelector('#cf-mg');
    var ok = true;

    if (!movie.value) { O.setFieldError(movie, '作品を選択してください'); ok = false; }
    if (!dist.value) { O.setFieldError(dist, '配給会社を選択してください'); ok = false; }
    if (!start.value) { O.setFieldError(start, '開始日を入力してください'); ok = false; }
    if (!end.value) { O.setFieldError(end, '終了日を入力してください'); ok = false; }
    else if (start.value && end.value < start.value) { O.setFieldError(end, '開始日以降の日付を入力してください'); ok = false; }
    var sh = Number(share.value);
    if (share.value === '' || isNaN(sh) || sh < 0 || sh > 100) { O.setFieldError(share, '0〜100で入力してください'); ok = false; }
    var g = mg.value === '' ? 0 : Number(mg.value);
    if (isNaN(g) || g < 0) { O.setFieldError(mg, '0以上で入力してください'); ok = false; }
    if (!ok) return;

    var dup = overlapping(Number(movie.value), start.value, end.value, null);
    if (dup) {
      var alert = document.getElementById('contract-form-alert');
      alert.textContent = '期間が既存の契約（' + O.md(dup.start) + '〜' + O.md(dup.end) + '）と重なっています';
      alert.hidden = false;
      return;
    }

    contracts.push({
      id: Math.max.apply(null, contracts.map(function (c) { return c.id; })) + 1,
      movie_id: Number(movie.value), dist_id: Number(dist.value),
      start: start.value, end: end.value, share: Math.round(sh * 10) / 10, mg: g, status: 0,
      note: form.querySelector('#cf-note').value.trim(),
    });
    O.closeModal('contract-modal');
    O.toast('契約を登録しました');
    renderAll();
  }

  // 新しい終了日より後に割り当て済みの上映回
  function showsAfter(movieId, date) {
    return (assignedShows[movieId] || []).filter(function (d) { return d > date; });
  }

  var extendingId = null;

  function openExtendModal(id) {
    var c = byId(contracts, id);
    extendingId = c.id;
    var form = document.getElementById('extend-form');
    O.clearFormErrors(form);
    document.getElementById('extend-target').innerHTML =
      '<b>' + O.esc(byId(movies, c.movie_id).title) + '</b><br>現在の期間：' + O.md(c.start, true) + '〜' + O.md(c.end, true);
    var input = form.querySelector('#ef-end');
    input.value = c.end;
    input.min = c.start;
    document.getElementById('extend-warn').hidden = true;
    O.openModal('extend-modal');
  }

  function updateExtendWarn() {
    var c = byId(contracts, extendingId);
    var v = document.getElementById('ef-end').value;
    var warn = document.getElementById('extend-warn');
    var lost = v ? showsAfter(c.movie_id, v) : [];
    warn.hidden = !lost.length;
    if (lost.length) warn.textContent = O.md(lost[0]) + '以降の上映 ' + lost.length + '回 が契約期間外になります';
  }

  function saveExtend() {
    var c = byId(contracts, extendingId);
    var input = document.getElementById('ef-end');
    O.clearFormErrors(document.getElementById('extend-form'));
    if (!input.value) { O.setFieldError(input, '終了日を入力してください'); return; }
    if (input.value < c.start) { O.setFieldError(input, '開始日以降の日付を入力してください'); return; }
    var dup = overlapping(c.movie_id, c.start, input.value, c.id);
    if (dup) { O.setFieldError(input, '期間が既存の契約（' + O.md(dup.start) + '〜' + O.md(dup.end) + '）と重なっています'); return; }
    c.end = input.value;
    O.closeModal('extend-modal');
    O.toast('上映期間を ' + O.md(c.end, true) + ' までに変更しました');
    renderAll();
  }

  function cancelContract(id) {
    var c = byId(contracts, id);
    var m = byId(movies, c.movie_id);
    var lost = showsAfter(c.movie_id, TODAY);
    O.confirm({
      title: '契約を打ち切る',
      html: '<b>' + O.esc(m.title) + '</b>（' + O.md(c.start) + '〜' + O.md(c.end) + '）の契約を打ち切ります。<br>' +
            (lost.length ? '<span style="color:#fb923c">割り当て済みの上映 ' + lost.length + '回 が「契約外」になります。</span><br>' : '') +
            'この操作は元に戻せません。',
      okLabel: '打ち切る',
      onOk: function () {
        c.status = 2;
        O.toast('契約を打ち切りました');
        renderAll();
      },
    });
  }

  /* ════════ 共通 ════════ */
  function fillSelects() {
    var gf = document.getElementById('movie-filter-genre');
    var gm = document.getElementById('mf-genre');
    var genreOpts = GENRES.map(function (g) { return '<option>' + g + '</option>'; }).join('');
    gf.innerHTML = '<option value="">ジャンル：すべて</option>' + genreOpts;
    gm.innerHTML = '<option value="">選択してください</option>' + genreOpts;

    var movieOpts = movies.map(function (m) { return '<option value="' + m.id + '">' + O.esc(m.title) + '</option>'; }).join('');
    var keepMv = document.getElementById('contract-filter-movie').value;
    document.getElementById('contract-filter-movie').innerHTML = '<option value="">作品：すべて</option>' + movieOpts;
    document.getElementById('contract-filter-movie').value = keepMv;
    document.getElementById('cf-movie').innerHTML = '<option value="">選択してください</option>' + movieOpts;

    var keepDs = document.getElementById('contract-filter-dist').value;
    document.getElementById('contract-filter-dist').innerHTML = '<option value="">配給会社：すべて</option>' +
      distributors.map(function (d) { return '<option value="' + d.id + '">' + O.esc(d.name) + '</option>'; }).join('');
    document.getElementById('contract-filter-dist').value = keepDs;
    document.getElementById('cf-dist').innerHTML = '<option value="">選択してください</option>' +
      distributors.filter(function (d) { return d.active; })
        .map(function (d) { return '<option value="' + d.id + '">' + O.esc(d.name) + '</option>'; }).join('');
  }

  function renderAll() {
    var keepGenre = document.getElementById('movie-filter-genre').value;
    fillSelects();
    document.getElementById('movie-filter-genre').value = keepGenre;
    renderMovies();
    renderDistributors();
    renderContracts();
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderAll();

    ['movie-search', 'movie-filter-status', 'movie-filter-genre'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', renderMovies);
    });
    document.getElementById('dist-search').addEventListener('input', renderDistributors);
    ['contract-filter-status', 'contract-filter-movie', 'contract-filter-dist'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', renderContracts);
    });

    document.getElementById('movie-add-btn').addEventListener('click', function () { openMovieModal(null); });
    document.getElementById('movie-save-btn').addEventListener('click', saveMovie);
    document.getElementById('dist-add-btn').addEventListener('click', function () { openDistModal(null); });
    document.getElementById('dist-save-btn').addEventListener('click', saveDist);
    document.getElementById('contract-add-btn').addEventListener('click', openContractModal);
    document.getElementById('contract-save-btn').addEventListener('click', saveContract);
    document.getElementById('extend-save-btn').addEventListener('click', saveExtend);
    document.getElementById('ef-end').addEventListener('input', updateExtendWarn);

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset.editMovie) openMovieModal(Number(t.dataset.editMovie));
      else if (t.dataset.deleteMovie) deleteMovie(Number(t.dataset.deleteMovie));
      else if (t.dataset.hideMovie) hideMovie(Number(t.dataset.hideMovie), true);
      else if (t.dataset.unhideMovie) hideMovie(Number(t.dataset.unhideMovie), false);
      else if (t.dataset.editDist) openDistModal(Number(t.dataset.editDist));
      else if (t.dataset.extend) openExtendModal(Number(t.dataset.extend));
      else if (t.dataset.cancel) cancelContract(Number(t.dataset.cancel));
    });
  });
})();
