/* マイページの「お気に入り」タブ */

(function () {

  function render() {
    var grid  = document.getElementById('favorite-grid');
    var empty = document.getElementById('favorite-empty-msg');
    if (!grid) return;

    var ids = HalFav.list();

    if (ids.length === 0) {
      grid.innerHTML = '';
      if (empty) {
        empty.hidden = false;
        empty.textContent = HalAPI.isLoggedIn()
          ? 'お気に入りに登録した作品はありません'
          : 'お気に入りを使うにはログインしてください';
      }
      return;
    }

    HalAPI.get('/api/movies')
      .then(function (movies) {
        var byId = {};
        (movies || []).forEach(function (m) { byId[m.movieId] = m; });

        // 登録した順（新しいものが先頭）を保つ
        var list = ids
          .map(function (id) { return byId[id]; })
          .filter(Boolean);

        if (list.length === 0) {
          grid.innerHTML = '';
          if (empty) {
            empty.hidden = false;
            empty.textContent = 'お気に入りに登録した作品はありません';
          }
          return;
        }

        if (empty) empty.hidden = true;
        HalMovie.render(grid, list, { showInfo: true });
      })
      .catch(function () {
        HalMovie.renderError(grid);
        if (empty) empty.hidden = true;
      });
  }

  function init() {
    render();

    // カードのハートで外したらその場で一覧を作り直す
    document.addEventListener('hal:favorites-changed', render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
