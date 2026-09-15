/* トップページ（index.html）の作品行を組み立てる */

(function () {

  var allMovies = [];

  // ── ちいさなヘルパー ──

  function el(id) {
    return document.getElementById(id);
  }

  function show(section, visible) {
    if (section) section.hidden = !visible;
  }

  // ── 本日のランキング ──

  function renderRanking() {
    var section = el('section-ranking');
    var list    = el('ranking-list');

    return HalRanking.today(allMovies).then(function (rows) {
      if (rows.length === 0) {
        show(section, false);
        return;
      }
      HalMovie.render(list, rows.map(function (r) { return r.movie; }), { ranked: true });
      show(section, true);
    }).catch(function () {
      show(section, false);
    });
  }

  // ── 3. お気に入り（0件なら行ごと隠す） ──

  function renderFavorites() {
    var section = el('section-favorite');
    var list    = el('favorite-list');

    var ids = HalFav.list();
    if (ids.length === 0) {
      show(section, false);
      return;
    }

    // 登録した順（新しいものが先頭）を保ったまま作品を引く
    var byId = {};
    allMovies.forEach(function (m) { byId[m.movieId] = m; });

    var movies = ids
      .map(function (id) { return byId[id]; })
      .filter(Boolean);

    if (movies.length === 0) {
      show(section, false);
      return;
    }

    HalMovie.render(list, movies);
    show(section, true);
  }

  // ── 4. 上映中 / 上映予定 ──

  function renderNowAndComing() {
    HalMovie.render(
      el('now-playing-list'),
      allMovies.filter(function (m) { return m.isShowing === 1; }),
      { emptyMessage: '現在上映中の作品はありません。' }
    );

    HalMovie.render(
      el('coming-soon-list'),
      allMovies.filter(function (m) { return m.isShowing !== 1; }),
      { emptyMessage: '公開予定の作品はありません。' }
    );
  }

  // ── 起動 ──

  function init() {
    HalUI.initRowScroll();

    HalAPI.get('/api/movies')
      .then(function (movies) {
        allMovies = Array.isArray(movies) ? movies : [];

        renderNowAndComing();
        renderFavorites();

        return renderRanking();
      })
      .then(function () {
        HalUI.refreshRowScroll();
      })
      .catch(function () {
        HalMovie.renderError(el('now-playing-list'));
        HalMovie.renderError(el('coming-soon-list'));
      });

    /* カードのハートが押されたら、お気に入り行を作り直す。 */
    document.addEventListener('hal:favorites-changed', function () {
      renderFavorites();
      HalUI.refreshRowScroll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
