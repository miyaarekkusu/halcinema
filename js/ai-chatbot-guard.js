/* ============================================================
   HAL CINEMA — ai-chatbot-guard.js
   AIチャットボット（おすすめ映画・AI予約）はログイン必須。
   <head> で defer なしの同期読み込みにし、本文が描画される前に
   未ログインならログインページへリダイレクトする
   （admin/admin-common.js の認証ガードと同じ考え方、判定対象は
   会員用の localStorage.hal_token）。
   ============================================================ */
if (!localStorage.getItem('hal_token')) {
  location.href = 'login.html?redirect=ai-chatbot.html';
}
