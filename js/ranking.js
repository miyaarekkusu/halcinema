/* 本日のランキング（座席の予約数順） */

(function () {

  var TOP_N = 5;

  // ── ダミーの予約座席数 ──
  // API接続時はこの関数ごと消す。
  // リロードのたびに順位が入れ替わると確認しづらいので、
  // movieId から決まる固定値にしている（同じIDなら常に同じ数）。

  function dummySeatCount(movie) {
    if (movie.isShowing !== 1) return 0;      // 上映予定の作品は本日の上映回が無い

    var id = Number(movie.movieId) || 0;
    // 適当だが偏りのある値。20〜180席くらいに収まる
    var spread = (id * 53 + 17) % 100;
    var base   = (id * 29) % 60;
    return 20 + spread + base;
  }

  // ── 本日のランキングを返す ──
  // movies : /api/movies の結果
  // 戻り値 : Promise<[{ movie, seatCount, rank }]>

  function today(movies, limit) {
    var n = limit || TOP_N;

    // TODO(API化): ここを HalAPI.get('/api/movies/ranking?date=today') に差し替える。
    //              返ってきた movieId で movies から作品を引けば下と同じ形になる。
    var rows = (movies || [])
      .filter(function (m) { return m.isShowing === 1; })
      .map(function (m) {
        return { movie: m, seatCount: dummySeatCount(m) };
      })
      .filter(function (row) { return row.seatCount > 0; })
      .sort(function (a, b) {
        if (b.seatCount !== a.seatCount) return b.seatCount - a.seatCount;
        // 同数なら公開日が新しい順（決定事項）
        return new Date(b.movie.releaseDate) - new Date(a.movie.releaseDate);
      })
      .slice(0, n);

    rows.forEach(function (row, i) { row.rank = i + 1; });

    return Promise.resolve(rows);
  }

  window.HalRanking = {
    today: today
  };

})();
