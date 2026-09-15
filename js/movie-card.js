/* 作品カードのHTML生成とジャンルの取り扱い */

(function () {

  // ── 1. ちいさなユーティリティ ──

  /* HTMLに埋め込む前のエスケープ。作品名に " や & が入っても壊れないように */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function releaseYear(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.getFullYear();
  }

  function comingDateLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '公開予定';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月公開予定';
  }

  /* カードに出す1行メタ情報 */
  function metaLabel(m) {
    if (m.isShowing === 1) {
      var year = releaseYear(m.releaseDate);
      var dur  = m.duration ? m.duration + '分' : '';
      return [year, dur].filter(Boolean).join(' · ');
    }
    return comingDateLabel(m.releaseDate);
  }

  // ── 2. ジャンル ──
  // t_MOVIE.f_genre は "アニメ / ファミリー" のような自由文字列で、
  // 複数ジャンルが1カラムに入っている。
  // 分割して集合として扱うことで「ドラマ / コメディ」と
  // 「コメディ / ドラマ」の表記ゆれも吸収できる。

  function splitGenres(genre) {
    if (!genre) return [];
    return String(genre)
      .split(/[\/,、･・]/)          // 区切りは / のほか読点・中黒も一応拾う
      .map(function (g) { return g.trim(); })
      .filter(function (g) { return g.length > 0; });
  }

  function hasGenre(movie, genre) {
    return splitGenres(movie.genre).indexOf(genre) !== -1;
  }

  // 作品一覧からジャンルを集計する。
  // 戻り値: [{ name: 'アニメ', count: 4 }, ...] 件数の多い順
  // options.min を渡すと、その本数に満たないジャンルを落とす
  function collectGenres(movies, options) {
    options = options || {};
    var min = options.min || 1;

    var counts = {};
    movies.forEach(function (m) {
      splitGenres(m.genre).forEach(function (g) {
        counts[g] = (counts[g] || 0) + 1;
      });
    });

    return Object.keys(counts)
      .map(function (name) { return { name: name, count: counts[name] }; })
      .filter(function (g) { return g.count >= min; })
      .sort(function (a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name, 'ja');
      });
  }

  function filterByGenre(movies, genre) {
    if (!genre) return movies.slice();
    return movies.filter(function (m) { return hasGenre(m, genre); });
  }

  // ── 3. ポスター ──

  var POSTER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></svg>';
  var POSTER_PH  = POSTER_SVG + '<span class="movie-poster-ph-label">POSTER</span>';

  /* 画像が404のときプレースホルダーに差し替える（HTML側から onerror で呼ばれる） */
  function posterError(img) {
    var box = img.closest('.movie-poster-ph');
    if (box) box.innerHTML = POSTER_PH;
  }

  function posterTag(m) {
    // 先頭の / を落としてから encodeURI する。
    // （API が "/images/..." を返しても ../ と二重にならず、パスに空白が入っても壊れない）
    var url = m.imageUrl ? encodeURI(String(m.imageUrl).replace(/^\/+/, '')) : '';
    if (!url) {
      return '<div class="movie-poster-ph">' + POSTER_PH + '</div>';
    }
    // API は "images/poster/xxx.jpg" を返すので html/ からは ../ を足す
    return '<div class="movie-poster-ph">'
      + '<img src="../' + esc(url) + '" alt="' + esc(m.title) + '"'
      + ' loading="lazy" onerror="HalMovie.posterError(this)">'
      + '</div>';
  }

  // ── 4. お気に入りボタン ──

  var HEART = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.7-7.7 1.1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>';

  function favButton(m) {
    var on = HalFav.has(m.movieId);
    return '<button type="button" class="fav-btn' + (on ? ' is-on' : '') + '"'
      + ' data-movie-id="' + esc(m.movieId) + '"'
      + ' aria-pressed="' + (on ? 'true' : 'false') + '"'
      + ' aria-label="お気に入り">' + HEART + '</button>';
  }

  /* ボタンの見た目を現在の状態に合わせる */
  function syncFavButtons(root) {
    (root || document).querySelectorAll('.fav-btn').forEach(function (btn) {
      var on = HalFav.has(btn.dataset.movieId);
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* クリックは document 1箇所で拾う（カードは後から差し込まれるため） */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.fav-btn') : null;
    if (!btn) return;

    // カード全体がリンクになっている場合に詳細ページへ飛ばないようにする
    e.preventDefault();
    e.stopPropagation();

    HalFav.toggleWithFeedback(btn.dataset.movieId);
    syncFavButtons();

    // ホームの「お気に入り」行をその場で作り直す
    document.dispatchEvent(new CustomEvent('hal:favorites-changed'));
  });

  // ── 5. カード生成 ──
  // options:
  // rank       : 数値を渡すとランキング用の順位バッジを出す
  // showInfo   : true でカード下にタイトル・メタを表示（作品一覧用）
  // favorite   : false でお気に入りボタンを出さない（既定は出す）
  // extraClass : カードに追加するクラス名（作品一覧の movie-grid-item など）

  function buildCard(m, options) {
    options = options || {};

    var isNow  = m.isShowing === 1;
    var status = isNow ? 'now' : 'coming';
    var meta   = metaLabel(m);
    var href   = 'movie-detail.html?id=' + encodeURIComponent(m.movieId);

    var badge = isNow
      ? '<span class="badge badge-red movie-card-badge">上映中</span>'
      : '<span class="badge badge-dark movie-card-badge">公開予定</span>';

    var btn = isNow
      ? '<a href="' + href + '" class="btn btn-primary btn-sm">詳細・予約</a>'
      : '<a href="' + href + '" class="btn btn-secondary btn-sm">詳細を見る</a>';

    var rank = (options.rank != null)
      ? '<span class="movie-card-rank">' + esc(options.rank) + '</span>'
      : '';

    var fav = (options.favorite === false) ? '' : favButton(m);

    var info = options.showInfo
      ? '<div class="movie-card-info">'
        + '<p class="movie-card-info-title">' + esc(m.title) + '</p>'
        + '<p class="movie-card-info-meta">' + esc(meta) + '</p>'
        + '</div>'
      : '';

    var classes = 'card movie-card'
      + (options.rank != null ? ' movie-card--ranked' : '')
      + (options.extraClass ? ' ' + options.extraClass : '');

    return '<div class="' + classes + '"'
      + ' data-status="' + status + '"'
      + ' data-movie-id="' + esc(m.movieId) + '"'
      + ' data-genre="' + esc(m.genre) + '">'
      + posterTag(m)
      + badge
      + rank
      + fav
      + '<div class="movie-card-overlay">'
      + '<p class="movie-card-title">' + esc(m.title) + '</p>'
      + '<p class="text-sm text-sub">' + esc(meta) + '</p>'
      + btn
      + '</div>'
      + info
      + '</div>';
  }

  // カードをまとめて描画する。
  // container : 差し込み先の要素
  // movies    : 作品の配列
  // options   : buildCard と同じ + emptyMessage / ranked
  function render(container, movies, options) {
    if (!container) return;
    options = options || {};

    if (!movies || movies.length === 0) {
      container.innerHTML = '<p class="movie-row-empty">'
        + esc(options.emptyMessage || '該当する作品はありません。')
        + '</p>';
      return;
    }

    container.innerHTML = movies.map(function (m, i) {
      var opt = Object.assign({}, options);
      if (options.ranked) opt.rank = i + 1;
      return buildCard(m, opt);
    }).join('');

    if (window.HalUI) HalUI.refreshRowScroll();
  }

  /* 取得に失敗したときの表示 */
  function renderError(container, message) {
    if (!container) return;
    container.innerHTML = '<p class="movie-row-empty">'
      + esc(message || '作品情報の取得に失敗しました。') + '</p>';
  }

  // ── 公開 ──

  window.HalMovie = {
    esc:             esc,
    splitGenres:     splitGenres,
    hasGenre:        hasGenre,
    collectGenres:   collectGenres,
    filterByGenre:   filterByGenre,
    comingDateLabel: comingDateLabel,
    metaLabel:       metaLabel,
    releaseYear:     releaseYear,
    posterTag:       posterTag,
    posterError:     posterError,
    favButton:       favButton,
    syncFavButtons:  syncFavButtons,
    buildCard:       buildCard,
    render:          render,
    renderError:     renderError
  };

})();
