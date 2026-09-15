/* おすすめ映画（お気に入りベース） */

(function () {

  var LIMIT = 10;

  var WEIGHT_FAVORITE    = 2;   // 自分で登録したお気に入り
  var WEIGHT_RESERVATION = 1;   // 過去に予約した作品

  // ── 動作確認用のダミー（?mock=1 のときだけ使う） ──

  function isMockMode() {
    return new URLSearchParams(location.search).get('mock') === '1';
  }

  /* アニメ2本をお気に入りにしている想定 */
  var MOCK_FAVORITE_IDS = [2, 3];

  // ── 手がかりの取得 ──

  function favoriteIds() {
    return isMockMode() ? MOCK_FAVORITE_IDS.slice() : HalFav.list();
  }

  /* 戻り値: Promise<[{ movieTitle }]> 取れなければ [] */
  function fetchHistory() {
    if (isMockMode()) return Promise.resolve([]);
    if (!HalAPI.isLoggedIn()) return Promise.resolve([]);

    return HalAPI.get('/api/me/reservations', { auth: true })
      .then(function (rows) { return Array.isArray(rows) ? rows : []; })
      .catch(function () { return []; });   // 期限切れトークンなどは黙って無視する
  }

  // ── 好みのプロフィールを作る ──
  // 戻り値: {
  // genreWeight : { 'アニメ': 4, ... }  ジャンルごとの重み合計
  // usedIds     : { 3: true, ... }      おすすめから除外する作品
  // hasFavorite : お気に入りが手がかりに含まれるか
  // }

  function buildProfile(favIds, history, movies) {
    var byId    = {};
    var byTitle = {};
    movies.forEach(function (m) {
      byId[m.movieId]  = m;
      byTitle[m.title] = m;
    });

    var genreWeight = {};
    var usedIds     = {};
    var hasFavorite = false;

    function add(movie, weight) {
      if (!movie) return;
      usedIds[movie.movieId] = true;
      HalMovie.splitGenres(movie.genre).forEach(function (g) {
        genreWeight[g] = (genreWeight[g] || 0) + weight;
      });
    }

    favIds.forEach(function (id) {
      var m = byId[id];
      if (m) hasFavorite = true;
      add(m, WEIGHT_FAVORITE);
    });

    history.forEach(function (row) {
      // TODO(API化): row.movieId / row.genre が来るようになったら突き合わせ不要
      add(byTitle[row.movieTitle], WEIGHT_RESERVATION);
    });

    return { genreWeight: genreWeight, usedIds: usedIds, hasFavorite: hasFavorite };
  }

  /* いちばん重みの大きいジャンル。無ければ null */
  function topGenre(genreWeight) {
    var names = Object.keys(genreWeight);
    if (names.length === 0) return null;
    names.sort(function (a, b) {
      if (genreWeight[b] !== genreWeight[a]) return genreWeight[b] - genreWeight[a];
      return a.localeCompare(b, 'ja');
    });
    return names[0];
  }

  function scoreMovie(movie, genreWeight) {
    return HalMovie.splitGenres(movie.genre).reduce(function (sum, g) {
      return sum + (genreWeight[g] || 0);
    }, 0);
  }

  // ── 本体 ──
  // movies : /api/movies の結果
  // 戻り値 : Promise<{ reason, movies } | null>
  // null = おすすめを出せない（ホーム側で案内文に切り替える）

  function forMe(movies, limit) {
    var n      = limit || LIMIT;
    var favIds = favoriteIds();

    // お気に入りも無くログインもしていなければ、問い合わせるまでもない
    if (favIds.length === 0 && !HalAPI.isLoggedIn() && !isMockMode()) {
      return Promise.resolve(null);
    }

    return fetchHistory().then(function (history) {
      if (favIds.length === 0 && history.length === 0) return null;

      var profile = buildProfile(favIds, history, movies);
      var genre   = topGenre(profile.genreWeight);
      if (!genre) return null;

      // 上映中・公開予定のどちらも候補にする。
      // 同じスコアなら、いま予約できる上映中を先に出す。
      var scored = movies
        .filter(function (m) { return !profile.usedIds[m.movieId]; })
        .map(function (m) {
          return { movie: m, score: scoreMovie(m, profile.genreWeight) };
        })
        .filter(function (row) { return row.score > 0; })
        .sort(function (a, b) {
          if (b.score !== a.score) return b.score - a.score;
          if (a.movie.isShowing !== b.movie.isShowing) return b.movie.isShowing - a.movie.isShowing;
          return new Date(b.movie.releaseDate) - new Date(a.movie.releaseDate);
        })
        .slice(0, n);

      // ジャンルが一致する作品が1本も無ければ出さない
      if (scored.length === 0) return null;

      return {
        reason: profile.hasFavorite
          ? 'お気に入りの「' + genre + '」に近い作品'
          : genre + 'をよく観ているあなたに',
        movies: scored.map(function (row) { return row.movie; })
      };
    });
  }

  window.HalRecommend = {
    forMe: forMe
  };

})();
