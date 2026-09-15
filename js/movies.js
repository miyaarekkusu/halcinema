/* 作品一覧ページ（movies.html） */

(function () {

  var ALL_GENRES = '__all__';

  var allMovies      = [];
  var currentStatus  = 'now';        // 'now' | 'coming'
  var currentGenre   = ALL_GENRES;   // ALL_GENRES またはジャンル名

  // ── URL との同期 ──

  function readURL() {
    var params = new URLSearchParams(location.search);

    var status = params.get('status');
    if (status === 'now' || status === 'coming') currentStatus = status;

    var genre = params.get('genre');
    if (genre) currentGenre = genre;
  }

  function writeURL() {
    var params = new URLSearchParams();
    params.set('status', currentStatus);
    if (currentGenre !== ALL_GENRES) params.set('genre', currentGenre);
    history.replaceState(null, '', location.pathname + '?' + params.toString());
  }

  // ── ジャンルチップ ──
  // チップは「今の上映状況で実際に作品があるジャンル」だけ出す。
  // 上映予定にアニメが無いのに「アニメ」を押せてしまう、を防ぐ。

  function moviesByStatus(status) {
    return allMovies.filter(function (m) {
      return (status === 'now') ? m.isShowing === 1 : m.isShowing !== 1;
    });
  }

  function renderGenreChips() {
    var wrap = document.getElementById('genre-chips');
    if (!wrap) return;

    var pool   = moviesByStatus(currentStatus);
    var genres = HalMovie.collectGenres(pool, { min: 1 });

    // 選んでいたジャンルが今の上映状況に無ければ「すべて」に戻す
    var names = genres.map(function (g) { return g.name; });
    if (currentGenre !== ALL_GENRES && names.indexOf(currentGenre) === -1) {
      currentGenre = ALL_GENRES;
    }

    var chips = [{ name: ALL_GENRES, label: 'すべて', count: pool.length }]
      .concat(genres.map(function (g) {
        return { name: g.name, label: g.name, count: g.count };
      }));

    wrap.innerHTML = chips.map(function (c) {
      var on = (c.name === currentGenre);
      return '<button type="button" class="genre-chip' + (on ? ' active' : '') + '"'
        + ' data-genre="' + HalMovie.esc(c.name) + '"'
        + ' aria-pressed="' + (on ? 'true' : 'false') + '">'
        + HalMovie.esc(c.label)
        + '<span class="genre-chip-count">' + c.count + '</span>'
        + '</button>';
    }).join('');
  }

  // ── グリッドの描画 ──

  function renderGrid() {
    var grid = document.getElementById('movies-grid');
    if (!grid) return;

    var list = moviesByStatus(currentStatus);
    if (currentGenre !== ALL_GENRES) {
      list = HalMovie.filterByGenre(list, currentGenre);
    }

    list = list.slice().sort(function (a, b) {
      return new Date(b.releaseDate) - new Date(a.releaseDate);
    });

    var label = (currentStatus === 'now') ? '上映中' : '上映予定';
    var empty = (currentGenre === ALL_GENRES)
      ? label + 'の作品はありません。'
      : label + 'の「' + currentGenre + '」作品はありません。';

    HalMovie.render(grid, list, {
      showInfo:     true,
      extraClass:   'movie-grid-item',
      emptyMessage: empty
    });
  }

  function refresh() {
    renderGenreChips();
    renderGrid();
    writeURL();
  }

  // ── イベント ──

  function bindStatusTabs() {
    document.querySelectorAll('.filter-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.filter === currentStatus);

      tab.addEventListener('click', function () {
        document.querySelectorAll('.filter-tab').forEach(function (t) {
          t.classList.remove('active');
        });
        tab.classList.add('active');
        currentStatus = tab.dataset.filter;
        refresh();
      });
    });
  }

  function bindGenreChips() {
    var wrap = document.getElementById('genre-chips');
    if (!wrap) return;

    // チップは描き直されるので、親でクリックを拾う
    wrap.addEventListener('click', function (e) {
      var chip = e.target.closest('.genre-chip');
      if (!chip) return;
      currentGenre = chip.dataset.genre;
      refresh();
    });
  }

  // ── 起動 ──

  function init() {
    readURL();
    bindStatusTabs();
    bindGenreChips();

    HalAPI.get('/api/movies')
      .then(function (movies) {
        allMovies = Array.isArray(movies) ? movies : [];
        refresh();
      })
      .catch(function () {
        HalMovie.renderError(document.getElementById('movies-grid'));
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
