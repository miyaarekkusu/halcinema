/* API のベースURL・fetch・認証まわりの共通処理 */

(function () {

  var API_BASE = window.HAL_API_BASE || 'http://localhost:8080';

  var TOKEN_KEY  = 'hal_token';
  var MEMBER_KEY = 'hal_member';

  // ── ログイン状態 ──

  function token() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    return !!token();
  }

  /* ログイン中の会員情報 { id, lastName, firstName, email } / 未ログインは null */
  function member() {
    try {
      return JSON.parse(localStorage.getItem(MEMBER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  /* 会員ID。未ログインなら 0（お気に入りの保存キーなどに使う） */
  function memberId() {
    var m = member();
    return (m && m.id) ? m.id : 0;
  }

  function logout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(MEMBER_KEY);
    } catch (e) { /* プライベートモードなどで失敗しても無視 */ }
  }

  /* 現在のページを戻り先にしてログインページへ送る */
  function goLogin() {
    var back = location.pathname.split('/').pop() + location.search;
    location.href = 'login.html?redirect=' + encodeURIComponent(back);
  }

  // ── fetch ラッパー ──

  function authHeaders() {
    var t = token();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  // path    : '/api/movies' のようなパス（API_BASE は自動で付く）
  // options : { method, body, auth }
  // auth: true なら Authorization ヘッダを付ける
  // 戻り値  : Promise<パースしたJSON>
  function fetchJSON(path, options) {
    options = options || {};

    var headers = { 'Content-Type': 'application/json' };
    if (options.auth) {
      var a = authHeaders();
      for (var k in a) { headers[k] = a[k]; }
    }

    var init = {
      method:  options.method || 'GET',
      headers: headers
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    return fetch(API_BASE + path, init).then(function (res) {
      if (!res.ok) {
        var err = new Error('API ' + res.status + ' ' + path);
        err.status = res.status;
        throw err;
      }
      if (res.status === 204) return null;
      return res.json();
    });
  }

  function get(path, options)        { return fetchJSON(path, Object.assign({}, options, { method: 'GET' })); }
  function post(path, body, options) { return fetchJSON(path, Object.assign({}, options, { method: 'POST', body: body })); }
  function del(path, options)        { return fetchJSON(path, Object.assign({}, options, { method: 'DELETE' })); }

  // ── 公開 ──

  window.HalAPI = {
    BASE:        API_BASE,
    token:       token,
    isLoggedIn:  isLoggedIn,
    member:      member,
    memberId:    memberId,
    logout:      logout,
    goLogin:     goLogin,
    authHeaders: authHeaders,
    fetchJSON:   fetchJSON,
    get:         get,
    post:        post,
    del:         del
  };

})();
