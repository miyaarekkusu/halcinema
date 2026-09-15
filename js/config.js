/* ============================================================
   HAL CINEMA — config.js
   バックエンドAPIのベースURLを一箇所で管理する。
   ローカル（Live Server等）では localhost:8080、それ以外
   （Vercel等にデプロイ後）は fly.io の本番URLを自動で使い分ける。

   ※ 全ページの <head> で他のスクリプトより先に（defer無しで）
     読み込むこと。window.HAL_API_BASE が確定してから
     common.js / chatbot.js / zaseki.js や各ページのインライン
     スクリプトが実行される必要があるため。

   fly.io へのデプロイ後、DEPLOYED_API_BASE を実際のURLに
   書き換えること（このファイルを直すだけで全ページに反映される）。
   ============================================================ */
(function () {
  var LOCAL_API_BASE    = 'http://localhost:8080';
  var DEPLOYED_API_BASE = 'https://halcinema-api.fly.dev'; // ← fly.io デプロイ後に書き換える

  var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  window.HAL_API_BASE = isLocal ? LOCAL_API_BASE : DEPLOYED_API_BASE;
})();
