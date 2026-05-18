/* ============================================================
   HAL CINEMA — chatbot.js
   チャットボット専用JS（フルページ + ウィジェット共通）
   common.js が先に読み込まれている前提
   ============================================================ */

(function () {

  /* ──────────────────────────────────────────────────────────
     状態
     ────────────────────────────────────────────────────────── */
  var voiceFull   = false;
  var voiceWidget = false;
  var currentUtter = null;
  var currentBtn   = null;

  /* ──────────────────────────────────────────────────────────
     ダミー応答（2次開発で fetch('/api/chat') に差し替える）
     ────────────────────────────────────────────────────────── */
  var dummyMap = {
    'スケジュール': '本日の上映スケジュールをご案内します。\n【スクリーン1】14:00 / 17:30 / 20:00\n【スクリーン2】13:00 / 16:00 / 19:00\n詳細は上映スケジュールページをご確認ください。',
    '予約':        '座席のご予約は「上映スケジュール」から作品・日時を選んでいただき、座席選択画面でお好きなお席をお選びください。会員登録（無料）でさらにスムーズに予約できます。',
    '料金':        '【料金のご案内】\n一般：1,800円\n大学生：1,600円\n中高生：1,400円\n小学生・幼児：1,000円\n※各種割引・会員特典もございます。',
    'アクセス':    'HALシネマへのアクセスはこちらです。\n住所：〒XXX-XXXX 愛知県名古屋市XX区XX\n電車：XX線「XX駅」徒歩3分\n駐車場：隣接ビルに提携駐車場あり（2時間無料）',
    '映画':        '現在上映中の作品は「作品一覧」ページでご確認いただけます。上映中・公開予定の作品情報を随時更新しています。',
  };

  function getDummyReply(text) {
    for (var key in dummyMap) {
      if (text.indexOf(key) !== -1) return dummyMap[key];
    }
    return 'ありがとうございます。担当スタッフが確認次第ご返答いたします。\nお急ぎの場合はお問い合わせフォームからもご連絡いただけます。';
  }

  function nowStr() {
    return new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  /* ──────────────────────────────────────────────────────────
     読み上げ（SpeechSynthesis API）
     ────────────────────────────────────────────────────────── */
  function speak(text, btn) {
    if (!window.speechSynthesis) return;

    /* 同じボタンを再押しで停止 */
    if (currentBtn === btn && speechSynthesis.speaking) {
      stopSpeaking();
      return;
    }
    stopSpeaking();

    var utter = new SpeechSynthesisUtterance(text);
    utter.lang  = 'ja-JP';
    utter.rate  = 1.0;
    utter.pitch = 1.0;

    utter.onstart = function () {
      currentUtter = utter;
      currentBtn   = btn;
      if (btn) btn.classList.add('speaking');
    };
    utter.onend = utter.onerror = function () {
      if (btn) btn.classList.remove('speaking');
      currentUtter = null;
      currentBtn   = null;
    };

    speechSynthesis.speak(utter);
  }

  function stopSpeaking() {
    if (speechSynthesis.speaking) speechSynthesis.cancel();
    if (currentBtn) currentBtn.classList.remove('speaking');
    currentUtter = null;
    currentBtn   = null;
  }

  /* ──────────────────────────────────────────────────────────
     メッセージ DOM 生成
     ────────────────────────────────────────────────────────── */
  var botIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
    + '<rect x="3" y="8" width="18" height="12" rx="3"/>'
    + '<path d="M8 8V6a4 4 0 0 1 8 0v2"/>'
    + '<circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none"/>'
    + '<circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none"/>'
    + '<path d="M9 18h6"/></svg>';

  var userIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>'
    + '<circle cx="12" cy="7" r="4"/></svg>';

  var speakIconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>'
    + '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';

  function addMessage(containerId, role, text) {
    var container = document.getElementById(containerId);
    if (!container) return;

    /* クイックリプライ削除 */
    var qr = container.querySelector('.quick-replies');
    if (qr) qr.remove();

    var isBot = role === 'bot';
    var escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    var speakBtnHtml = isBot
      ? '<button class="speak-btn" data-text="' + text.replace(/"/g, '&quot;') + '">'
        + speakIconSvg
        + '<span class="speak-label">読み上げ</span>'
        + '<span class="wave-bars" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></span>'
        + '</button>'
      : '';

    var wrap = document.createElement('div');
    wrap.className = 'chat-msg ' + role;
    wrap.innerHTML = '<div class="msg-icon">' + (isBot ? botIconSvg : userIconSvg) + '</div>'
      + '<div>'
      + '<div class="msg-bubble">' + escaped + '</div>'
      + '<div class="msg-footer">'
      + '<span class="msg-time">' + nowStr() + '</span>'
      + speakBtnHtml
      + '</div></div>';

    /* speak-btn にイベントを付ける */
    var btn = wrap.querySelector('.speak-btn');
    if (btn) {
      btn.addEventListener('click', function () { speak(text, btn); });
    }

    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;

    /* 自動読み上げ */
    if (isBot) {
      var isWidget = containerId.indexOf('widget') !== -1;
      var autoOn   = isWidget ? voiceWidget : voiceFull;
      if (autoOn && btn) speak(text, btn);
    }
  }

  /* ──────────────────────────────────────────────────────────
     タイピングインジケーター
     ────────────────────────────────────────────────────────── */
  function showTyping(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'chat-msg bot typing-indicator';
    el.id = 'typing-' + containerId;
    el.innerHTML = '<div class="msg-icon">' + botIconSvg + '</div>'
      + '<div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping(containerId) {
    var el = document.getElementById('typing-' + containerId);
    if (el) el.remove();
  }

  /* ──────────────────────────────────────────────────────────
     送信処理（フルページ）
     ────────────────────────────────────────────────────────── */
  function sendFull() {
    var input = document.getElementById('chat-input-full');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';

    addMessage('chat-messages-full', 'user', text);
    showTyping('chat-messages-full');
    setTimeout(function () {
      hideTyping('chat-messages-full');
      addMessage('chat-messages-full', 'bot', getDummyReply(text));
    }, 900 + Math.random() * 600);
  }

  /* ──────────────────────────────────────────────────────────
     送信処理（ウィジェット）— common.js からも呼べるよう公開
     ────────────────────────────────────────────────────────── */
  function sendFromWidget(text) {
    var input = document.getElementById('chat-input-widget');
    if (input) input.value = '';
    if (!text || !text.trim()) return;
    text = text.trim();

    addMessage('chat-messages-widget', 'user', text);
    showTyping('chat-messages-widget');
    setTimeout(function () {
      hideTyping('chat-messages-widget');
      addMessage('chat-messages-widget', 'bot', getDummyReply(text));
    }, 900 + Math.random() * 600);
  }

  /* ──────────────────────────────────────────────────────────
     フルページのイベント設定
     ────────────────────────────────────────────────────────── */
  function initFullPage() {
    var sendBtn = document.getElementById('send-btn-full');
    var input   = document.getElementById('chat-input-full');
    if (!sendBtn || !input) return;

    sendBtn.addEventListener('click', sendFull);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendFull();
      }
    });

    /* textarea 自動リサイズ */
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    /* クイックリプライ */
    var qrArea = document.getElementById('quick-replies-full');
    if (qrArea) {
      qrArea.querySelectorAll('.quick-reply-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          input.value = btn.textContent;
          sendFull();
        });
      });
    }

    /* 既存の speak-btn（初期メッセージ） */
    document.querySelectorAll('#chat-messages-full .speak-btn').forEach(function (b) {
      b.addEventListener('click', function () { speak(b.dataset.text, b); });
    });

    /* 音声トグル（フルページヘッダー） */
    var voiceToggle = document.getElementById('voice-toggle-full');
    var voiceLabel  = document.getElementById('voice-label-full');
    if (voiceToggle) {
      voiceToggle.addEventListener('click', function () {
        voiceFull = !voiceFull;
        voiceToggle.classList.toggle('voice-on', voiceFull);
        if (voiceLabel) voiceLabel.textContent = voiceFull ? '音声 ON' : '音声 OFF';
      });
    }
  }

  /* ──────────────────────────────────────────────────────────
     公開 API（common.js のウィジェットから呼ぶ）
     ────────────────────────────────────────────────────────── */
  window.HALChat = {
    speak:          speak,
    sendFromWidget: sendFromWidget,
    setWidgetVoice: function (on) { voiceWidget = on; },
  };

  /* ──────────────────────────────────────────────────────────
     初期化
     ────────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', initFullPage);

})();
