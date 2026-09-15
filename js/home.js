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

  // ── 1. おすすめ（お気に入りベース） ──
  // 手がかりが無いときは人気順を出さない（下の「本日のランキング」と
  // 中身が同じ行が並ぶため）。代わりに、お気に入りを使えば出ることが
  // 分かる案内文を置く。行ごと消すと機能に気づいてもらえないため。

  var RECOMMEND_HINT =
    'お気に入りに登録すると、そのジャンルに近い作品をここにおすすめします。'
    + ' <a href="movies.html" class="movie-row-empty-link">作品一覧から探す →</a>';

  function renderRecommend() {
    var section = el('section-recommend');
    var list    = el('recommend-list');
    var reason  = el('recommend-reason');

    function showHint() {
      reason.textContent = '';
      list.innerHTML = '<p class="movie-row-empty">' + RECOMMEND_HINT + '</p>';
      show(section, true);
    }

    return HalRecommend.forMe(allMovies).then(function (result) {
      if (!result || result.movies.length === 0) {
        showHint();
        return;
      }

      reason.textContent = result.reason;
      HalMovie.render(list, result.movies);
      show(section, true);
    }).catch(showHint);
  }

  // ── 2. 本日のランキング ──

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

        return Promise.all([renderRanking(), renderRecommend()]);
      })
      .then(function () {
        HalUI.refreshRowScroll();
      })
      .catch(function () {
        HalMovie.renderError(el('now-playing-list'));
        HalMovie.renderError(el('coming-soon-list'));
      });

    /* カードのハートが押されたら、お気に入り行とおすすめ行を作り直す。
       おすすめはお気に入りを手がかりにしているので、
       ハートを押した瞬間に内容が変わるのが正しい。 */
    document.addEventListener('hal:favorites-changed', function () {
      renderFavorites();
      renderRecommend().then(function () {
        HalUI.refreshRowScroll();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
