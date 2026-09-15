/* お気に入り作品の読み書き */

(function () {

  var PREFIX = 'hal_favorites';

  /* 会員ごとに別のキーで保存する。
     こうしておくと共用PCで他人のお気に入りが混ざらず、
     API化したとき（会員に紐づく）と同じ意味になる。 */
  function storageKey() {
    return PREFIX + '_' + HalAPI.memberId();
  }

  // ── 読み込み ──

  /* お気に入りの movieId 配列を返す。未ログイン・未登録なら [] */
  function list() {
    if (!HalAPI.isLoggedIn()) return [];
    // TODO(API化): return HalAPI.get('/api/me/favorites', { auth: true })
    try {
      var raw = localStorage.getItem(storageKey());
      var ids = JSON.parse(raw || '[]');
      if (!Array.isArray(ids)) return [];
      return ids.map(Number).filter(function (n) { return !isNaN(n); });
    } catch (e) {
      return [];
    }
  }

  function has(movieId) {
    return list().indexOf(Number(movieId)) !== -1;
  }

  function count() {
    return list().length;
  }

  // ── 書き込み ──

  function save(ids) {
    // TODO(API化): POST / DELETE に差し替える
    try {
      localStorage.setItem(storageKey(), JSON.stringify(ids));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* 戻り値: 'added' | 'already' | 'login-required' */
  function add(movieId) {
    if (!HalAPI.isLoggedIn()) return 'login-required';
    var id  = Number(movieId);
    var ids = list();
    if (ids.indexOf(id) !== -1) return 'already';
    ids.unshift(id);            // 新しく追加したものが先頭に来る
    save(ids);
    return 'added';
  }

  /* 戻り値: 'removed' | 'none' | 'login-required' */
  function remove(movieId) {
    if (!HalAPI.isLoggedIn()) return 'login-required';
    var id  = Number(movieId);
    var ids = list();
    var i   = ids.indexOf(id);
    if (i === -1) return 'none';
    ids.splice(i, 1);
    save(ids);
    return 'removed';
  }

  /* 戻り値: 'added' | 'removed' | 'login-required' */
  function toggle(movieId) {
    if (!HalAPI.isLoggedIn()) return 'login-required';
    return has(movieId) ? remove(movieId) : add(movieId);
  }

  // ── 未ログイン時のログイン誘導（決定事項：ログインへ誘導する） ──

  function promptLogin() {
    if (confirm('お気に入りの登録にはログインが必要です。\nログインページへ移動しますか？')) {
      HalAPI.goLogin();
    }
  }

  // カードやボタンから呼ぶ用のまとめ役。
  // お気に入りを切り替えて、トーストまで出す。
  // 戻り値: true = 登録された / false = 外された or 何もしなかった
  function toggleWithFeedback(movieId) {
    var result = toggle(movieId);

    if (result === 'login-required') {
      promptLogin();
      return false;
    }

    if (window.HalUI) {
      HalUI.toast(result === 'added' ? 'お気に入りに追加しました' : 'お気に入りから外しました');
    }
    return result === 'added';
  }

  // ── 公開 ──

  window.HalFav = {
    list:               list,
    has:                has,
    count:              count,
    add:                add,
    remove:             remove,
    toggle:             toggle,
    promptLogin:        promptLogin,
    toggleWithFeedback: toggleWithFeedback
  };

})();
