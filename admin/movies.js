/* ============================================================
   HAL CINEMA — movies.js（G03 作品・配給）
   ※ データは data/admin/seed.json → db.json（AdminData 経由）。登録・編集・延長・打ち切りは DBファイルに保存する
   API 接続時の置き換え先：
     GET/POST  /api/admin/movies          PATCH /api/admin/movies/{id}
     GET/POST  /api/admin/distributors    PATCH /api/admin/distributors/{id}
     GET/POST  /api/admin/contracts       PATCH /api/admin/contracts/{id}
   ============================================================ */
(function () {
  var O = window.Office;
  var TODAY;   // データ読み込み後に入る

  var GENRES = ['アクション / SF', 'アニメ / ミステリー', 'アニメ / スポーツ', 'アニメ / ファミリー', 'ドラマ', 'コメディ', 'ホラー', 'ミュージカル'];

  /* ── データ（data/admin/seed.json → db.json から読み込み、変更は AdminData.save で保存） ── */
  var movies, distributors, contracts, assignedShows;

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
      return '<tr>' +
        '<td style="width:52px">' + poster + '</td>' +
        '<td><b>' + O.esc(m.title) + '</b>' + (m.title_en ? '<span class="sub">' + O.esc(m.title_en) + '</span>' : '') + '</td>' +
        '<td class="numeric">' + m.duration + '分</td>' +
        '<td>' + m.rating + '</td>' +
        '<td>' + STATUS_BADGE[movieStatus(m.id)] + '</td>' +
        '<td>' + period + '</td>' +
        '<td class="actions"><button class="toolbar__btn toolbar__btn--sm" data-edit-movie="' + m.id + '">編集</button></td>' +
      '</tr>';
    }).join('');
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
    AdminData.save('movies');
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
    AdminData.save('distributors');
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
    AdminData.save('contracts');
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
    AdminData.save('contracts');
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
        AdminData.save('contracts');
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

  AdminData.onReady(function (db) {
    TODAY = O.today;
    movies = db.movies;
    distributors = db.distributors;
    contracts = db.contracts;
    assignedShows = db.assigned_shows;
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
      else if (t.dataset.editDist) openDistModal(Number(t.dataset.editDist));
      else if (t.dataset.extend) openExtendModal(Number(t.dataset.extend));
      else if (t.dataset.cancel) cancelContract(Number(t.dataset.cancel));
    });
  });
})();
