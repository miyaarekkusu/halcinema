/* ============================================================
   HAL CINEMA — common.js
   全ページ共通JS
   ・ハンバーガーメニュー
   ・チャットポップアップウィジェット（自動挿入）
   ============================================================ */

(function () {

  /* ──────────────────────────────────────────────────────────
     1. ハンバーガーメニュー
     ────────────────────────────────────────────────────────── */
  function initNav() {
    const toggle = document.getElementById('nav-toggle');
    const nav    = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      const isOpen = nav.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.classList.remove('open');
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     2. ポップアップウィジェット — HTML を body に自動挿入
     ────────────────────────────────────────────────────────── */
  function insertWidget() {
    /* chatbot.html 自身では挿入しない（フルページがあるため） */
    if (document.body.dataset.noWidget === 'true') return;

    const html = `
    <!-- チャットポップアップ（common.js が挿入） -->
    <button class="chat-widget-btn" id="widget-btn" aria-label="チャットを開く">
      <svg class="icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      <span class="widget-badge" id="widget-badge">1</span>
    </button>

    <div class="chat-widget-panel" id="widget-panel">
      <div class="widget-header">
        <div class="widget-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="8" width="18" height="12" rx="3"/>
            <path d="M8 8V6a4 4 0 0 1 8 0v2"/>
            <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none"/>
            <circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none"/>
            <path d="M9 18h6"/>
          </svg>
        </div>
        <div class="widget-header-info">
          <p class="widget-name">HAL アシスタント</p>
          <p class="widget-status">● オンライン</p>
        </div>
        <div class="widget-header-actions">
          <button class="widget-action-btn" id="voice-toggle-widget" title="自動読み上げ">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>
          <button class="widget-action-btn" id="widget-expand-btn" title="大きく表示">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
          <button class="widget-action-btn" id="widget-close-btn" title="閉じる">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="widget-messages" id="chat-messages-widget">
        <div class="chat-msg bot">
          <div class="msg-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="8" width="18" height="12" rx="3"/>
              <path d="M8 8V6a4 4 0 0 1 8 0v2"/>
              <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none"/>
              <circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none"/>
            </svg>
          </div>
          <div>
            <div class="msg-bubble">何かお手伝いできることはありますか？</div>
            <div class="msg-footer">
              <span class="msg-time">--:--</span>
              <button class="speak-btn" data-text="何かお手伝いできることはありますか？">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
                <span class="speak-label">読み上げ</span>
                <span class="wave-bars" aria-hidden="true">
                  <span></span><span></span><span></span><span></span><span></span>
                </span>
              </button>
            </div>
          </div>
        </div>
        <div class="quick-replies">
          <button class="quick-reply-btn" data-msg="上映中の映画を教えて">上映中の映画</button>
          <button class="quick-reply-btn" data-msg="予約したい">予約したい</button>
          <button class="quick-reply-btn" data-msg="料金を教えて">料金を教えて</button>
        </div>
      </div>

      <div class="widget-input-area">
        <div class="widget-input-wrap">
          <input class="widget-input" id="chat-input-widget" type="text" placeholder="メッセージを入力…">
          <button class="widget-send-btn" id="widget-send-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
  }

  /* ──────────────────────────────────────────────────────────
     3. ウィジェット イベント設定
     ────────────────────────────────────────────────────────── */
  function initWidget() {
    const btn   = document.getElementById('widget-btn');
    const panel = document.getElementById('widget-panel');
    if (!btn || !panel) return;

    let widgetOpen = false;

    /* 開閉 */
    function toggleWidget() {
      widgetOpen = !widgetOpen;
      btn.classList.toggle('open', widgetOpen);
      panel.classList.toggle('open', widgetOpen);
      btn.setAttribute('aria-label', widgetOpen ? 'チャットを閉じる' : 'チャットを開く');
      const badge = document.getElementById('widget-badge');
      if (widgetOpen && badge) badge.classList.add('hidden');
    }

    btn.addEventListener('click', toggleWidget);

    const closeBtn = document.getElementById('widget-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', toggleWidget);

    /* フルページへ遷移（chatbot.html のパスを合わせてください） */
    const expandBtn = document.getElementById('widget-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        location.href = 'chatbot.html';
      });
    }

    /* 読み上げトグル */
    const voiceBtn = document.getElementById('voice-toggle-widget');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', function () {
        const on = voiceBtn.classList.toggle('voice-on');
        voiceBtn.title = on ? '自動読み上げ ON' : '自動読み上げ OFF';
        /* chatbot.js が読み込まれていれば状態を同期 */
        if (typeof HALChat !== 'undefined') HALChat.setWidgetVoice(on);
      });
    }

    /* speak-btn（初期メッセージ） */
    panel.querySelectorAll('.speak-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        if (typeof HALChat !== 'undefined') HALChat.speak(b.dataset.text, b);
      });
    });

    /* クイックリプライ */
    panel.querySelectorAll('.quick-reply-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        if (typeof HALChat !== 'undefined') HALChat.sendFromWidget(b.dataset.msg);
      });
    });

    /* 送信ボタン・Enter */
    const sendBtn = document.getElementById('widget-send-btn');
    const input   = document.getElementById('chat-input-widget');
    if (sendBtn && input) {
      sendBtn.addEventListener('click', function () {
        if (typeof HALChat !== 'undefined') HALChat.sendFromWidget(input.value);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (typeof HALChat !== 'undefined') HALChat.sendFromWidget(input.value);
        }
      });
    }

    /* 初期メッセージの時刻を現在時刻にセット */
    const firstTime = panel.querySelector('.msg-time');
    if (firstTime) {
      firstTime.textContent = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }
  }

  /* ──────────────────────────────────────────────────────────
     4. ログイン状態に応じてヘッダーのログイン・会員登録ボタンを切り替え
     ────────────────────────────────────────────────────────── */
  function initAuthHeader() {
    const isLoggedIn = !!localStorage.getItem('hal_token');
    document.querySelectorAll('.header-actions a[href="login.html"], .header-actions a[href="register.html"]')
      .forEach(function (el) {
        el.style.display = isLoggedIn ? 'none' : '';
      });
  }

  /* ──────────────────────────────────────────────────────────
     5. DOM 準備後に全初期化
     ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    insertWidget();
    initWidget();
    initAuthHeader();
  });

})();
