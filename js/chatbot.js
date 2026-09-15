/* ============================================================
   HAL CINEMA — chatbot.js
   チャットボット専用JS（フルページ + ウィジェット共通）
   common.js が先に読み込まれている前提

   最初のボット発話で3択（アシスタント／おすすめ映画／AI予約）を
   提示し、選ばれた意図に固定した状態で POST /api/chat を呼ぶ。
   会話は「スレッド」単位で localStorage に複数保持し、ヘッダーの
   新規チャット／履歴ボタンで切り替えられる。ポップアップを閉じても
   同じスレッドから続きから再開できる。
   ============================================================ */

(function () {

  var API_BASE = window.HAL_API_BASE;
  var THREADS_KEY_PREFIX = 'halcinema_chat_threads_';
  var ACTIVE_KEY_PREFIX  = 'halcinema_chat_active_id_';

  /* ──────────────────────────────────────────────────────────
     モード（意図の選択肢セット）
     ・assistant: お問い合わせ専用（1択のみ＝ピッカーを出さず即会話開始）。
       ポップアップウィジェットは常にこのモード。
     ・chatbot: おすすめ映画／AI予約（2択）。html/ai-chatbot.html の
       フルページのみ、<body data-chat-mode="chatbot"> で切り替える。
     未指定のフルページ（chatbot.html 等）はデフォルトで assistant。
     ────────────────────────────────────────────────────────── */
  var INTENT_SETS = {
    assistant: [
      { id: 'assistant', label: 'アシスタントに質問する', trigger: 'アシスタントに質問したいです' }
    ],
    chatbot: [
      { id: 'recommend', label: 'おすすめ映画を聞く', trigger: 'おすすめの映画を教えてください' },
      { id: 'reserve',   label: 'AIで予約する',       trigger: 'AIで予約をしたいです' }
    ]
  };
  var ALL_INTENTS = INTENT_SETS.assistant.concat(INTENT_SETS.chatbot);

  function getChatMode(containerId) {
    if (containerId === 'chat-messages-widget') return 'assistant';
    var mode = document.body && document.body.dataset ? document.body.dataset.chatMode : null;
    return (mode && INTENT_SETS[mode]) ? mode : 'assistant';
  }

  function getIntents(containerId) {
    return INTENT_SETS[getChatMode(containerId)] || INTENT_SETS.assistant;
  }

  var GREETINGS = {
    'chat-messages-full':   'こんにちは！HALシネマのアシスタントです。\n上映スケジュール・予約・劇場案内など、なんでもお気軽にご質問ください。',
    'chat-messages-widget': '何かお手伝いできることはありますか？'
  };
  var GREETINGS_CHATBOT_FULL = 'こんにちは！HALシネマのAIチャットボットです。\nおすすめ映画・AI予約をお手伝いします。お気軽にご相談ください。';

  function greetingFor(containerId) {
    if (containerId === 'chat-messages-full' && getChatMode(containerId) === 'chatbot') {
      return GREETINGS_CHATBOT_FULL;
    }
    return GREETINGS[containerId] || '';
  }

  /* ──────────────────────────────────────────────────────────
     会話スレッド管理
     モードごとに独立した localStorage プールへ複数スレッド（新規チャット
     ごとの会話）を保持し、「新規チャット」「履歴から呼び出し」を可能にする。
     store = { threadsKey, activeKey, threads, activeId, state }
     state = そのモードで現在アクティブなスレッド（intent/messages/slots/log）。
     ────────────────────────────────────────────────────────── */
  function emptySlots() {
    return { movieId: 0, showDate: '', scheduleId: 0, seatCount: 0, seatIds: [], holdToken: '', paymentMethod: 0, cardId: 0 };
  }

  function generateThreadId() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function createThread() {
    var now = Date.now();
    return { id: generateThreadId(), intent: null, messages: [], slots: emptySlots(), log: [], createdAt: now, updatedAt: now };
  }

  function loadAllThreads(threadsKey) {
    try {
      var raw = localStorage.getItem(threadsKey);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveAllThreads(store) {
    try { localStorage.setItem(store.threadsKey, JSON.stringify(store.threads)); } catch (e) { /* ignore */ }
  }

  function persistActiveId(store) {
    try { localStorage.setItem(store.activeKey, store.activeId); } catch (e) { /* ignore */ }
  }

  var stores = {};
  Object.keys(INTENT_SETS).forEach(function (mode) {
    var threadsKey = THREADS_KEY_PREFIX + mode;
    var activeKey  = ACTIVE_KEY_PREFIX + mode;
    var threads = loadAllThreads(threadsKey);
    var activeId = null;
    try { activeId = localStorage.getItem(activeKey); } catch (e) { /* ignore */ }

    var state = null;
    for (var i = 0; i < threads.length; i++) {
      if (threads[i].id === activeId) { state = threads[i]; break; }
    }
    if (!state) {
      state = createThread();
      threads.push(state);
      activeId = state.id;
    }

    var store = { threadsKey: threadsKey, activeKey: activeKey, threads: threads, activeId: activeId, state: state };
    persistActiveId(store);
    stores[mode] = store;
  });

  function getStore(containerId) {
    return stores[getChatMode(containerId)];
  }

  function saveState(store) {
    store.state.updatedAt = Date.now();
    var idx = -1;
    for (var i = 0; i < store.threads.length; i++) { if (store.threads[i].id === store.state.id) { idx = i; break; } }
    if (idx === -1) store.threads.push(store.state); else store.threads[idx] = store.state;
    saveAllThreads(store);
  }

  function resetContainerDom(containerId) {
    var container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
  }

  function threadTitle(t) {
    for (var i = 0; i < ALL_INTENTS.length; i++) {
      if (ALL_INTENTS[i].id === t.intent) return ALL_INTENTS[i].label;
    }
    return '新規チャット';
  }

  function threadPreview(t) {
    var log = t.log || [];
    for (var i = log.length - 1; i >= 0; i--) {
      var entry = log[i];
      if (entry.text) return entry.text.slice(0, 42);
      if (entry.rich) {
        if (entry.rich.kind === 'date_picker')             return '日にちを選択してください';
        if (entry.rich.kind === 'schedule_picker')        return '上映回を選択してください';
        if (entry.rich.kind === 'seat_picker')            return '座席を選択してください';
        if (entry.rich.kind === 'payment_picker')         return 'お支払い方法を選択してください';
        if (entry.rich.kind === 'movie_cards')            return 'おすすめ映画をご紹介しました';
        if (entry.rich.kind === 'reservation_confirmed')  return 'ご予約が完了しました';
      }
    }
    return 'まだメッセージがありません';
  }

  function formatThreadDate(ts) {
    var d = new Date(ts);
    var now = new Date();
    var time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return time;
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + time;
  }

  function startNewChat(containerId) {
    // 進行中のAI予約があれば座席仮押さえを解放してから新規チャットへ切り替える
    // （common.js、ヘッダーからの離脱時と同じ仕組み）。
    if (window.HALSeatHold) window.HALSeatHold.release();
    closeHistoryPanel(containerId);
    var store = getStore(containerId);
    store.state = createThread();
    store.activeId = store.state.id;
    persistActiveId(store);
    resetContainerDom(containerId);
    addMessage(containerId, 'bot', greetingFor(containerId));
    showIntentPicker(containerId);
  }

  function switchThread(containerId, id) {
    var store = getStore(containerId);
    if (id === store.state.id) { closeHistoryPanel(containerId); return; }
    var found = null;
    for (var i = 0; i < store.threads.length; i++) { if (store.threads[i].id === id) { found = store.threads[i]; break; } }
    if (!found) return;

    // 切り替え元のスレッドで進行中のAI予約があれば座席仮押さえを解放する。
    if (window.HALSeatHold) window.HALSeatHold.release();

    closeHistoryPanel(containerId);
    store.state = found;
    store.activeId = id;
    persistActiveId(store);
    resetContainerDom(containerId);
    addMessage(containerId, 'bot', greetingFor(containerId));
    if (store.state.intent && store.state.log && store.state.log.length) {
      store.state.log.forEach(function (entry) { renderLogEntry(containerId, entry); });
    } else {
      showIntentPicker(containerId);
    }
  }

  function deleteThread(containerId, id) {
    var store = getStore(containerId);
    store.threads = store.threads.filter(function (t) { return t.id !== id; });
    saveAllThreads(store);
    if (id === store.state.id) {
      startNewChat(containerId);
    } else {
      openHistoryPanel(containerId);
    }
  }

  function closeHistoryPanel(containerId) {
    var el = document.getElementById('chat-history-overlay-' + containerId);
    if (el) el.remove();
  }

  function openHistoryPanel(containerId) {
    closeHistoryPanel(containerId);
    var store = getStore(containerId);
    var parent = containerId === 'chat-messages-full'
      ? document.querySelector('.chatbot-page')
      : document.getElementById('widget-panel');
    if (!parent) return;

    var overlay = document.createElement('div');
    overlay.className = 'chat-history-overlay';
    overlay.id = 'chat-history-overlay-' + containerId;

    var header = document.createElement('div');
    header.className = 'chat-history-header';
    var title = document.createElement('p');
    title.className = 'chat-history-title';
    title.textContent = '会話履歴';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'chat-history-close-btn';
    closeBtn.setAttribute('aria-label', '閉じる');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function () { closeHistoryPanel(containerId); });
    header.appendChild(title);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    var newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'chat-history-new-btn';
    newBtn.textContent = '+ 新規チャット';
    newBtn.addEventListener('click', function () { startNewChat(containerId); });
    overlay.appendChild(newBtn);

    var list = document.createElement('div');
    list.className = 'chat-history-list';

    var sorted = store.threads
      .filter(function (t) { return t.log && t.log.length; })
      .slice()
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; });

    if (!sorted.length) {
      var empty = document.createElement('p');
      empty.className = 'chat-history-empty';
      empty.textContent = 'まだ会話履歴がありません。';
      list.appendChild(empty);
    } else {
      sorted.forEach(function (t) {
        var item = document.createElement('div');
        item.className = 'chat-history-item' + (t.id === store.state.id ? ' is-active' : '');

        var main = document.createElement('button');
        main.type = 'button';
        main.className = 'chat-history-item-main';
        main.innerHTML =
          '<p class="chat-history-item-title">' + escapeHtml(threadTitle(t)) + '</p>'
          + '<p class="chat-history-item-preview">' + escapeHtml(threadPreview(t)) + '</p>'
          + '<p class="chat-history-item-date">' + formatThreadDate(t.updatedAt) + '</p>';
        main.addEventListener('click', function () { switchThread(containerId, t.id); });

        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'chat-history-item-delete';
        delBtn.setAttribute('aria-label', 'この会話を削除');
        delBtn.innerHTML = '&times;';
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          deleteThread(containerId, t.id);
        });

        item.appendChild(main);
        item.appendChild(delBtn);
        list.appendChild(item);
      });
    }

    overlay.appendChild(list);
    parent.appendChild(overlay);
  }

  var voiceFull   = false;
  var voiceWidget = false;
  var currentUtter = null;
  var currentBtn   = null;

  function nowStr() {
    return new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ──────────────────────────────────────────────────────────
     読み上げ（SpeechSynthesis API）
     ────────────────────────────────────────────────────────── */
  function speak(text, btn) {
    if (!window.speechSynthesis) return;

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
     メッセージ DOM 生成（プレーンテキストの吹き出し）
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

    var qr = container.querySelector('.quick-replies');
    if (qr) qr.remove();

    var isBot = role === 'bot';
    var escaped = escapeHtml(text).replace(/\n/g, '<br>');

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

    var btn = wrap.querySelector('.speak-btn');
    if (btn) {
      btn.addEventListener('click', function () { speak(text, btn); });
    }

    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;

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
     会話ログ（表示用）— state.messages（API往復用の生履歴）とは別に、
     再表示のためだけの軽量ログを持つ。rich は answered フラグを
     直接書き換えられるよう、常に同じオブジェクト参照を保持する。
     ────────────────────────────────────────────────────────── */
  function recordAndRender(containerId, entry) {
    var store = getStore(containerId);
    store.state.log = store.state.log || [];
    store.state.log.push(entry);
    saveState(store);
    renderLogEntry(containerId, entry);
  }

  function renderLogEntry(containerId, entry) {
    if (entry.rich) {
      renderRichBlock(containerId, entry.rich);
    } else {
      addMessage(containerId, entry.role, entry.text);
    }
  }

  /* ──────────────────────────────────────────────────────────
     リッチブロック（座席ピッカー／映画カード／予約完了サマリー）
     ────────────────────────────────────────────────────────── */
  function renderRichBlock(containerId, rich) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var block = document.createElement('div');
    block.className = 'chat-rich-block chat-rich-' + rich.kind;
    if (rich.answered) block.classList.add('is-answered');

    if (rich.kind === 'date_picker') {
      buildDatePickerBlock(block, containerId, rich);
    } else if (rich.kind === 'schedule_picker') {
      buildSchedulePickerBlock(block, containerId, rich);
    } else if (rich.kind === 'payment_picker') {
      buildPaymentPickerBlock(block, containerId, rich);
    } else if (rich.kind === 'seat_picker') {
      buildSeatPickerBlock(block, containerId, rich);
    } else if (rich.kind === 'movie_cards') {
      buildMovieCardsBlock(block, rich.payload, containerId);
    } else if (rich.kind === 'reservation_confirmed') {
      buildReservationSummaryBlock(block, rich.payload);
    } else {
      return;
    }

    container.appendChild(block);
    container.scrollTop = container.scrollHeight;

    if (rich.kind === 'reservation_confirmed') {
      showRestartOption(containerId);
    }
  }

  /* ── 上映回ピッカー：今週(7日間)のスケジュールをその場でボタン表示 ──
     DeepSeekの文章生成を待たず、バックエンドが決定的に返すリストを
     そのままボタン化する。1クリックで scheduleId が確定し、次のターンで
     座席ピッカー（buildSeatPickerBlock）に進む。 */
  function formatScheduleDate(dateStr) {
    var parts = (dateStr || '').split('-');
    if (parts.length !== 3) return dateStr || '';
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return Number(parts[1]) + '/' + Number(parts[2]) + '(' + wd + ')';
  }

  /* ── 日にちピッカー：今後14日間のうち上映がある日を1週間ずつボタン表示 ──
     作品詳細ページ(movie-detail.html)の日付タブ（前週/次週ボタン）と同じ
     操作感にするため、7件ずつページ送りする（rich.page に現在ページを
     保持し、再表示時にも同じページを保つ）。日にちを1つ選ぶと、その日の
     上映時間一覧（buildSchedulePickerBlock）に進む2段階フロー。 */
  function buildDatePickerBlock(block, containerId, rich) {
    var store = getStore(containerId);
    var payload = rich.payload || {};
    var dates = payload.dates || [];

    if (!dates.length) {
      var empty = document.createElement('p');
      empty.className = 'schedule-picker-empty';
      empty.textContent = '直近2週間の上映日はありません。';
      block.appendChild(empty);
      return;
    }

    var PAGE_SIZE  = 7;
    var totalPages = Math.ceil(dates.length / PAGE_SIZE);
    var page       = rich.page || 0;

    var nav = document.createElement('div');
    nav.className = 'date-picker-nav';

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'date-picker-arrow';
    prevBtn.setAttribute('aria-label', '前の週');
    prevBtn.innerHTML = '&#8249;';

    var list = document.createElement('div');
    list.className = 'date-picker-list';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'date-picker-arrow';
    nextBtn.setAttribute('aria-label', '次の週');
    nextBtn.innerHTML = '&#8250;';

    function renderPage() {
      list.innerHTML = '';
      var start = page * PAGE_SIZE;
      dates.slice(start, start + PAGE_SIZE).forEach(function (d) {
        var dateLabel = formatScheduleDate(d.date);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'date-picker-btn';
        btn.disabled = !!rich.answered;
        btn.textContent = dateLabel;

        if (!rich.answered) {
          btn.addEventListener('click', function () {
            nav.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
            block.classList.add('is-answered');
            rich.answered = true;

            store.state.slots.showDate = d.date;
            saveState(store);

            var text = dateLabel + 'を予約したいです。';
            recordAndRender(containerId, { role: 'user', text: text });
            sendToChat(containerId, text);
          });
        }

        list.appendChild(btn);
      });

      prevBtn.disabled = !!rich.answered || page === 0;
      nextBtn.disabled = !!rich.answered || page >= totalPages - 1;
    }

    prevBtn.addEventListener('click', function () {
      if (rich.answered || page === 0) return;
      page -= 1;
      rich.page = page;
      renderPage();
    });
    nextBtn.addEventListener('click', function () {
      if (rich.answered || page >= totalPages - 1) return;
      page += 1;
      rich.page = page;
      renderPage();
    });

    renderPage();

    nav.appendChild(prevBtn);
    nav.appendChild(list);
    nav.appendChild(nextBtn);
    block.appendChild(nav);
  }

  function buildSchedulePickerBlock(block, containerId, rich) {
    var store = getStore(containerId);
    var payload = rich.payload || {};
    var schedules = payload.schedules || [];

    if (!schedules.length) {
      var empty = document.createElement('p');
      empty.className = 'schedule-picker-empty';
      empty.textContent = 'この日の上映回はありません。';
      block.appendChild(empty);
      return;
    }

    var list = document.createElement('div');
    list.className = 'schedule-picker-list';

    schedules.forEach(function (s) {
      var dateLabel = formatScheduleDate(s.showDate);
      var timeLabel = (s.startTime || '').slice(0, 5);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'schedule-picker-btn';
      btn.disabled = !!rich.answered;
      btn.innerHTML =
        '<span class="schedule-picker-time">' + escapeHtml(timeLabel) + '</span>'
        + '<span class="schedule-picker-screen">' + escapeHtml(s.screenName || '') + '</span>'
        + '<span class="schedule-picker-seats">残り' + s.availableSeats + '席</span>';

      if (!rich.answered) {
        btn.addEventListener('click', function () {
          list.querySelectorAll('.schedule-picker-btn').forEach(function (b) { b.disabled = true; });
          block.classList.add('is-answered');
          rich.answered = true;

          store.state.slots.scheduleId = s.scheduleId;
          saveState(store);

          var text = dateLabel + ' ' + timeLabel + '（' + (s.screenName || '') + '）で予約します。';
          recordAndRender(containerId, { role: 'user', text: text });
          sendToChat(containerId, text);
        });
      }

      list.appendChild(btn);
    });

    block.appendChild(list);
  }

  // 通常予約(zaseki.html)の2D座席選択と同じ見た目・情報構成（列番号ヘッダー＋
  // 座席グリッド＋「選択中の座席」タグ一覧を下に表示）をチャット内で再現する。
  /* ── 支払い方法ピッカー：保存済みカード／新規カード登録／QR／窓口をボタン表示 ──
     「新しいクレジットカードを登録して支払う」を選ぶと、mypage.htmlのカード追加
     モーダルと同じ入力項目をチャット内にインラインで表示する。送信すると
     /api/me/cards に登録し、そのcardIdでそのまま支払い方法を確定する。 */
  function buildPaymentPickerBlock(block, containerId, rich) {
    var store = getStore(containerId);
    var payload = rich.payload || {};
    var payments = payload.payments || [];

    if (!payments.length) {
      var empty = document.createElement('p');
      empty.className = 'schedule-picker-empty';
      empty.textContent = 'お支払い方法が見つかりませんでした。';
      block.appendChild(empty);
      return;
    }

    var list = document.createElement('div');
    list.className = 'payment-picker-list';

    function confirmPayment(method, cardId, label) {
      list.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      block.classList.add('is-answered');
      rich.answered = true;

      store.state.slots.paymentMethod = method;
      store.state.slots.cardId = cardId || 0;
      saveState(store);

      var text = label + 'で支払います。';
      recordAndRender(containerId, { role: 'user', text: text });
      sendToChat(containerId, text);
    }

    payments.forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'payment-picker-btn';
      btn.textContent = p.label;
      btn.disabled = !!rich.answered;

      if (!rich.answered) {
        if (p.isNewCard) {
          btn.addEventListener('click', function () {
            if (list.querySelector('.payment-new-card-form')) return;
            list.appendChild(buildNewCardForm(containerId, list, confirmPayment));
          });
        } else {
          btn.addEventListener('click', function () {
            confirmPayment(p.method, p.cardId, p.label);
          });
        }
      }

      list.appendChild(btn);
    });

    block.appendChild(list);
  }

  // 「新しいクレジットカードを登録して支払う」選択時のインライン入力フォーム。
  // mypage.htmlのカード追加モーダルと同じ項目・同じAPI(/api/me/cards)を使う。
  function buildNewCardForm(containerId, list, confirmPayment) {
    var wrap = document.createElement('form');
    wrap.className = 'payment-new-card-form';
    wrap.innerHTML =
      '<label>カード名義<input type="text" class="form-input" data-field="holder" required autocomplete="cc-name"></label>'
      + '<label>カード番号<input type="text" class="form-input" data-field="number" inputmode="numeric" maxlength="19" placeholder="1234 5678 9012 3456" required autocomplete="cc-number"></label>'
      + '<div class="payment-new-card-row">'
      + '<label>有効期限（月）<input type="number" class="form-input" data-field="month" min="1" max="12" required autocomplete="cc-exp-month"></label>'
      + '<label>有効期限（年）<input type="number" class="form-input" data-field="year" min="2026" max="2099" required autocomplete="cc-exp-year"></label>'
      + '</div>'
      + '<p class="payment-new-card-note">※ カード番号は下4桁のみ保存されます。CVVの入力は不要です。</p>'
      + '<p class="payment-new-card-error" hidden></p>'
      + '<button type="submit" class="rich-confirm-btn">このカードで登録して支払う</button>';

    var errorEl = wrap.querySelector('.payment-new-card-error');

    wrap.addEventListener('submit', function (e) {
      e.preventDefault();
      var holder = wrap.querySelector('[data-field="holder"]').value.trim();
      var number = wrap.querySelector('[data-field="number"]').value.trim();
      var month  = parseInt(wrap.querySelector('[data-field="month"]').value, 10);
      var year   = parseInt(wrap.querySelector('[data-field="year"]').value, 10);

      var token = localStorage.getItem('hal_token');
      if (!token) {
        errorEl.textContent = 'ログインが必要です。';
        errorEl.hidden = false;
        return;
      }

      var submitBtn = wrap.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '登録中…';
      errorEl.hidden = true;

      fetch(API_BASE + '/api/me/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ cardHolder: holder, cardNumber: number, expireMonth: month, expireYear: year })
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) {
            errorEl.textContent = 'カードの登録に失敗しました: ' + (result.data.error || '入力内容をご確認ください');
            errorEl.hidden = false;
            submitBtn.disabled = false;
            submitBtn.textContent = 'このカードで登録して支払う';
            return;
          }
          wrap.remove();
          confirmPayment(1, result.data.cardId, result.data.cardBrand + ' •••• ' + result.data.last4);
        })
        .catch(function () {
          errorEl.textContent = '通信に失敗しました。もう一度お試しください。';
          errorEl.hidden = false;
          submitBtn.disabled = false;
          submitBtn.textContent = 'このカードで登録して支払う';
        });
    });

    return wrap;
  }

  function buildSeatPickerBlock(block, containerId, rich) {
    var store = getStore(containerId);
    var payload = rich.payload || {};
    var seats = payload.seats || [];
    var requiredCount = (store.state.slots && store.state.slots.seatCount > 0) ? store.state.slots.seatCount : 1;

    var countHint = document.createElement('p');
    countHint.className = 'seat-grid-count-hint';
    block.appendChild(countHint);

    function updateCountHint(current) {
      if (rich.answered) {
        countHint.textContent = '';
        return;
      }
      countHint.textContent = requiredCount + '席選択してください（' + current + ' / ' + requiredCount + '）';
      countHint.classList.toggle('is-complete', current === requiredCount);
    }
    updateCountHint(0);

    if (payload.prices && payload.prices.length) {
      var priceNote = document.createElement('p');
      priceNote.className = 'seat-grid-price-note';
      priceNote.textContent = '料金: ' + payload.prices.map(function (p) {
        return p.label + ' ¥' + p.price;
      }).join(' / ') + '（本予約では一般料金で確定します）';
      block.appendChild(priceNote);
    }

    var rowsMap = {};
    var order = [];
    var maxCols = 0;
    seats.forEach(function (s) {
      if (!rowsMap[s.rowLabel]) { rowsMap[s.rowLabel] = []; order.push(s.rowLabel); }
      rowsMap[s.rowLabel].push(s);
      if (s.seatNumber > maxCols) maxCols = s.seatNumber;
    });

    var grid = document.createElement('div');
    grid.className = 'seat-grid';

    // 列番号ヘッダー行（通常予約の2Dマップと同じスクリーン方向の目印）
    var headerRow = document.createElement('div');
    headerRow.className = 'seat-grid-row seat-grid-header';
    var headerSpacer = document.createElement('span');
    headerSpacer.className = 'seat-grid-row-label';
    headerRow.appendChild(headerSpacer);
    for (var c = 1; c <= maxCols; c++) {
      var colNum = document.createElement('span');
      colNum.className = 'seat-grid-col-num';
      colNum.textContent = c;
      headerRow.appendChild(colNum);
    }
    grid.appendChild(headerRow);

    var selected = {};

    // ── 下部「選択中の座席」パネル（zaseki.html の選択中座席パネルと同じ構成）──
    var selectedPanel = document.createElement('div');
    selectedPanel.className = 'seat-grid-selected-panel';
    selectedPanel.innerHTML =
      '<div class="seat-grid-selected-header">'
      + '<span class="seat-grid-selected-label">選択中の座席</span>'
      + '<span class="seat-grid-selected-badge">0</span>席'
      + '</div>'
      + '<div class="seat-grid-selected-tags"></div>';
    var selectedBadge = selectedPanel.querySelector('.seat-grid-selected-badge');
    var selectedTags  = selectedPanel.querySelector('.seat-grid-selected-tags');

    function deselectSeat(seat) {
      delete selected[seat.seatId];
      var btnEl = grid.querySelector('.seat-grid-btn[data-seat-id="' + seat.seatId + '"]');
      if (btnEl) btnEl.classList.remove('selected');
      var count = Object.keys(selected).length;
      updateCountHint(count);
      renderSelectedTags();
      if (confirmBtn) confirmBtn.disabled = count !== requiredCount;
    }

    function renderSelectedTags() {
      var chosen = Object.keys(selected).map(function (id) { return selected[id]; });
      selectedBadge.textContent = chosen.length;

      if (!chosen.length) {
        selectedTags.innerHTML = '<p class="seat-grid-empty-msg">座席をクリックして選択してください</p>';
        return;
      }
      selectedTags.innerHTML = '';
      chosen
        .sort(function (a, b) { return a.rowLabel === b.rowLabel ? a.seatNumber - b.seatNumber : a.rowLabel.localeCompare(b.rowLabel); })
        .forEach(function (seat) {
          var tag = document.createElement('span');
          tag.className = 'seat-grid-selected-tag';
          tag.textContent = seat.rowLabel + seat.seatNumber;
          if (!rich.answered) {
            tag.addEventListener('click', function () { deselectSeat(seat); });
          }
          selectedTags.appendChild(tag);
        });
    }

    order.forEach(function (rowLabel) {
      var rowEl = document.createElement('div');
      rowEl.className = 'seat-grid-row';

      var labelEl = document.createElement('span');
      labelEl.className = 'seat-grid-row-label';
      labelEl.textContent = rowLabel;
      rowEl.appendChild(labelEl);

      rowsMap[rowLabel]
        .slice()
        .sort(function (a, b) { return a.seatNumber - b.seatNumber; })
        .forEach(function (seat) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'seat-grid-btn';
          btn.textContent = seat.seatNumber;
          btn.dataset.seatId = seat.seatId;

          if (rich.answered || seat.status !== 0) {
            btn.disabled = true;
            if (seat.status !== 0) btn.classList.add('taken');
          } else {
            btn.addEventListener('click', function () {
              if (selected[seat.seatId]) {
                deselectSeat(seat);
                return;
              }
              if (Object.keys(selected).length >= requiredCount) return;
              selected[seat.seatId] = seat;
              btn.classList.add('selected');
              var count = Object.keys(selected).length;
              updateCountHint(count);
              renderSelectedTags();
              confirmBtn.disabled = count !== requiredCount;
            });
          }
          rowEl.appendChild(btn);
        });

      grid.appendChild(rowEl);
    });

    block.appendChild(grid);
    block.appendChild(selectedPanel);
    renderSelectedTags();

    if (rich.answered) return;

    var confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'rich-confirm-btn';
    confirmBtn.textContent = '選択した座席で確定';
    confirmBtn.disabled = true;
    // 「選択した座席で確定」：Web予約(zaseki.js)と同じ座席仮押さえ(hold)を取得
    // してから次へ進む。他のお客様がその間に取ってしまっていた場合は409が
    // 返るので、その座席だけ選択解除してもう一度選んでもらう。
    confirmBtn.addEventListener('click', async function () {
      var chosen = Object.keys(selected).map(function (id) { return selected[id]; });
      if (!chosen.length) return;

      confirmBtn.disabled = true;
      confirmBtn.textContent = '座席を確保しています…';

      var seatIds   = chosen.map(function (s) { return s.seatId; });
      var scheduleId = store.state.slots.scheduleId;
      var holdToken  = (crypto.randomUUID ? crypto.randomUUID() : ('hold-' + Date.now() + '-' + Math.random().toString(36).slice(2)));

      try {
        var holdRes = await fetch(API_BASE + '/api/schedules/' + scheduleId + '/hold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seatIds: seatIds, holdToken: holdToken })
        });

        if (holdRes.status === 409) {
          var data = await holdRes.json().catch(function () { return {}; });
          var unavailable = data.unavailable || [];
          alert('選択された座席の一部はちょうど他のお客様が手続き中です。お手数ですが別の座席をお選びください。');
          unavailable.forEach(function (seatId) {
            var seat = selected[seatId];
            if (!seat) return;
            delete selected[seatId];
            var btnEl = grid.querySelector('.seat-grid-btn[data-seat-id="' + seatId + '"]');
            if (btnEl) { btnEl.classList.remove('selected'); btnEl.classList.add('taken'); btnEl.disabled = true; }
          });
          var count = Object.keys(selected).length;
          updateCountHint(count);
          renderSelectedTags();
          confirmBtn.disabled = count !== requiredCount;
          confirmBtn.textContent = '選択した座席で確定';
          return;
        }
        if (!holdRes.ok) {
          alert('座席の確保に失敗しました。もう一度お試しください。');
          confirmBtn.disabled = false;
          confirmBtn.textContent = '選択した座席で確定';
          return;
        }
      } catch (e) {
        console.warn('仮押さえAPIに接続できませんでした（オフラインで続行）:', e);
      }

      try {
        sessionStorage.setItem('halcinema_hold', JSON.stringify({ token: holdToken, scheduleId: scheduleId, seatIds: seatIds }));
      } catch (e) { /* ignore */ }

      grid.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      block.classList.add('is-answered');
      rich.answered = true;

      var labels = chosen
        .sort(function (a, b) { return a.seatNumber - b.seatNumber; })
        .map(function (s) { return s.rowLabel + s.seatNumber; });

      store.state.slots.seatIds = seatIds;
      store.state.slots.holdToken = holdToken;
      saveState(store);
      renderSelectedTags();

      var text = '座席 ' + labels.join('、') + ' を選択しました。';
      recordAndRender(containerId, { role: 'user', text: text });
      sendToChat(containerId, text);
    });
    block.appendChild(confirmBtn);
  }

  /* ── おすすめ映画：上映スケジュール同様のポスターカードをグリッド表示 ──
     common.css の .card/.movie-card はホバー時だけ表示される
     オーバーレイ＋固定アスペクト比＋overflow:hiddenの構成で、常時表示の
     アクションボタン2つを収めるのに向かないため、chatbot.css側に
     専用のカードスタイルを持つ（見た目のトーンは合わせる）。 */
  var POSTER_PLACEHOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
    + '<rect x="2" y="2" width="20" height="20" rx="3"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></svg>'
    + '<span class="chat-recommend-poster-label">POSTER</span>';

  function buildMovieCardsBlock(block, movies, containerId) {
    var grid = document.createElement('div');
    grid.className = 'chat-recommend-grid';

    (movies || []).forEach(function (m) {
      var meta = [];
      if (m.genre) meta.push(m.genre);
      if (m.duration) meta.push(m.duration + '分');
      if (m.rating) meta.push(m.rating);

      var card = document.createElement('div');
      card.className = 'chat-recommend-card';

      var poster = document.createElement('div');
      poster.className = 'chat-recommend-poster';
      if (m.imageUrl) {
        var img = document.createElement('img');
        img.src = '../' + m.imageUrl;
        img.alt = m.title || '';
        img.addEventListener('error', function () { poster.innerHTML = POSTER_PLACEHOLDER_SVG; });
        poster.appendChild(img);
      } else {
        poster.innerHTML = POSTER_PLACEHOLDER_SVG;
      }
      card.appendChild(poster);

      var info = document.createElement('div');
      info.className = 'chat-recommend-info';
      info.innerHTML =
        '<p class="chat-recommend-title">' + escapeHtml(m.title || '') + '</p>'
        + (meta.length ? '<p class="chat-recommend-meta">' + escapeHtml(meta.join(' ・ ')) + '</p>' : '');
      card.appendChild(info);

      var actions = document.createElement('div');
      actions.className = 'chat-recommend-actions';

      var reserveBtn = document.createElement('button');
      reserveBtn.type = 'button';
      reserveBtn.className = 'btn btn-primary btn-sm';
      reserveBtn.textContent = 'AI予約で進める';
      reserveBtn.addEventListener('click', function () { startReserveForMovie(containerId, m); });
      actions.appendChild(reserveBtn);

      var detailLink = document.createElement('a');
      detailLink.className = 'btn btn-ghost btn-sm';
      detailLink.href = 'movie-detail.html?id=' + m.movieId;
      detailLink.textContent = '詳細・通常予約';
      actions.appendChild(detailLink);

      card.appendChild(actions);
      grid.appendChild(card);
    });

    block.appendChild(grid);
  }

  // おすすめカードの「AI予約で進める」から、そのままAI予約(reserve)の
  // 新規スレッドを開始する。movieId をあらかじめ埋めておくので、次の
  // やり取りでは「何名様ですか？」から始まる。
  function startReserveForMovie(containerId, movie) {
    var store = getStore(containerId);
    store.state = createThread();
    store.state.intent = 'reserve';
    store.state.slots.movieId = movie.movieId;
    store.activeId = store.state.id;
    persistActiveId(store);
    saveState(store);

    resetContainerDom(containerId);
    addMessage(containerId, 'bot', greetingFor(containerId));

    var text = '「' + movie.title + '」を予約したいです。';
    recordAndRender(containerId, { role: 'user', text: text });
    sendToChat(containerId, text);
  }

  function buildReservationSummaryBlock(block, payload) {
    payload = payload || {};
    var tickets = payload.tickets || [];
    var seatLabels = tickets.map(function (t) { return t.rowLabel + t.seatNumber; }).join('、');

    function row(label, value) {
      if (!value) return '';
      return '<div class="reservation-summary-row"><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(String(value)) + '</dd></div>';
    }

    var card = document.createElement('div');
    card.className = 'reservation-summary';
    card.innerHTML =
      '<p class="reservation-summary-title">ご予約が完了しました</p>'
      + '<dl>'
      + row('予約番号', payload.reservationCode)
      + row('作品', payload.movieTitle)
      + row('日時', ((payload.showDate || '') + ' ' + (payload.startTime || '')).trim())
      + row('スクリーン', payload.screenName)
      + row('座席', seatLabels)
      + row('合計金額', payload.totalAmount != null ? payload.totalAmount + '円' : '')
      + '</dl>'
      + '<p class="reservation-summary-note">チケットのQRコードはマイページでご確認いただけます。</p>';
    block.appendChild(card);

    if (payload.movieTitle) {
      var goodsBtn = document.createElement('button');
      goodsBtn.type = 'button';
      goodsBtn.className = 'btn btn-ghost btn-sm chat-goods-btn';
      goodsBtn.textContent = '🍿 グッズ・売店で注文する';
      goodsBtn.addEventListener('click', function () { goToGoodsForReservation(payload); });
      card.appendChild(goodsBtn);
    }
  }

  // 予約確定後、その予約に紐づけてグッズ・売店ページへ遷移する。
  // goods.html は「reservationDataがあり、かつ ?fromReservation=1 で来た」場合だけ
  // booking-modeになる（js/goods.js）。?fromReservation=1 を付けずに直接遷移すると、
  // 過去の予約完了時に残ったreservationDataが原因で、ナビの「グッズ・物販」から
  // 単体で訪れただけなのに勝手に古い予約へ紐付いてしまうため、このボタン経由の
  // 遷移だけに限定する。
  function goToGoodsForReservation(payload) {
    var tickets = payload.tickets || [];
    var seats = tickets.map(function (t) { return t.rowLabel + t.seatNumber; });
    var data = {
      reservationId:   payload.reservationId,
      reservationCode: payload.reservationCode,
      movieTitle:      payload.movieTitle || '',
      screeningInfo:   ((payload.showDate || '') + ' ' + (payload.startTime || '').slice(0, 5)).trim(),
      seats:           seats,
      totalAmount:     payload.totalAmount || 0
    };
    try { sessionStorage.setItem('reservationData', JSON.stringify(data)); } catch (e) { /* ignore */ }
    location.href = 'goods.html?fromReservation=1';
  }

  function showRestartOption(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var wrap = document.createElement('div');
    wrap.className = 'quick-replies';
    var btn = document.createElement('button');
    btn.className = 'quick-reply-btn';
    btn.textContent = '新規チャットを始める';
    btn.addEventListener('click', function () {
      wrap.remove();
      startNewChat(containerId);
    });
    wrap.appendChild(btn);
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
  }

  /* ──────────────────────────────────────────────────────────
     意図選択（クイックリプライ）
     選択肢が1つしかないモード（アシスタント）ではピッカーを出さず、
     自由入力を待つだけにする（submitUserText 側で自動的に意図確定）。
     ────────────────────────────────────────────────────────── */
  function showIntentPicker(containerId) {
    var intents = getIntents(containerId);
    if (intents.length <= 1) return;

    var container = document.getElementById(containerId);
    if (!container) return;

    var wrap = document.createElement('div');
    wrap.className = 'quick-replies';
    intents.forEach(function (intent) {
      var btn = document.createElement('button');
      btn.className = 'quick-reply-btn';
      btn.textContent = intent.label;
      btn.addEventListener('click', function () {
        wrap.remove();
        chooseIntent(containerId, intent);
      });
      wrap.appendChild(btn);
    });
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
  }

  function chooseIntent(containerId, intent) {
    var store = getStore(containerId);
    store.state.intent   = intent.id;
    store.state.messages = [];
    store.state.slots    = emptySlots();
    store.state.log      = [];
    saveState(store);

    recordAndRender(containerId, { role: 'user', text: intent.trigger });
    sendToChat(containerId, intent.trigger);
  }

  /* ──────────────────────────────────────────────────────────
     /api/chat 呼び出し
     ────────────────────────────────────────────────────────── */
  // movie-detail.html が localStorage に書き込む閲覧履歴（新しい順）を
  // movieIdの配列として取り出す。おすすめ映画チャットで初回ターンから
  // 参考にするため、毎回のリクエストに乗せる（他intentでは無視される）。
  function getViewedMovieIds() {
    try {
      var list = JSON.parse(localStorage.getItem('hal_viewed_movies') || '[]');
      return list.map(function (v) { return v.movieId; });
    } catch (e) { return []; }
  }

  function sendToChat(containerId, text) {
    var store = getStore(containerId);
    store.state.messages.push({ role: 'user', content: text });
    saveState(store);
    showTyping(containerId);

    var headers = { 'Content-Type': 'application/json' };
    var token = localStorage.getItem('hal_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        intent: store.state.intent,
        messages: store.state.messages,
        slots: store.state.slots,
        viewedMovieIds: getViewedMovieIds()
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      })
      .then(function (data) {
        hideTyping(containerId);

        store.state.messages = data.messages || store.state.messages;
        store.state.slots    = data.slots || store.state.slots;
        saveState(store);

        if (data.reply) {
          recordAndRender(containerId, { role: 'bot', text: data.reply });
        }
        if (data.recommendedMovies && data.recommendedMovies.length) {
          recordAndRender(containerId, { role: 'bot', rich: { kind: 'movie_cards', payload: data.recommendedMovies } });
        }
        if (data.uiAction) {
          recordAndRender(containerId, { role: 'bot', rich: { kind: data.uiAction.type, payload: data.uiAction } });
          if (data.uiAction.type === 'reservation_confirmed') {
            publishConfirmedTicket(data.uiAction);
            // 予約が確定したので座席仮押さえの記録も消す（本予約済みでサーバー側の
            // 在庫はf_stock_status=1に切り替わっており、そのままでもリリース処理は
            // 無害だが、ヘッダー離脱時に無駄なrelease-hold呼び出しをしないため）。
            try { sessionStorage.removeItem('halcinema_hold'); } catch (e) { /* ignore */ }
          }
        }
      })
      .catch(function () {
        hideTyping(containerId);
        addMessage(containerId, 'bot', '通信に失敗しました。少し時間をおいて再度お試しください。');
      });
  }

  /* ──────────────────────────────────────────────────────────
     AI予約完了の即時反映
     ticket.html が予約完了時にマイページ用へ保存する sessionStorage
     'latestTicket' と同じ形へ変換して保存し（マイページ側の読み込み
     ロジックをそのまま流用できる）、さらに halcinema:ticketAdded
     イベントを飛ばす。マイページを開いたままAI予約を完了した場合、
     ページ再読み込みなしでチケット一覧に即反映される。
     ────────────────────────────────────────────────────────── */
  function publishConfirmedTicket(uiAction) {
    var tickets = uiAction.tickets || [];
    var latest = {
      reservationId:   uiAction.reservationId,
      reservationCode: uiAction.reservationCode,
      movieTitle:      uiAction.movieTitle || '',
      movieFormat:     '',
      screenInfo:      uiAction.screenName || '',
      screeningInfo:   ((uiAction.showDate || '') + ' ' + (uiAction.startTime || '').slice(0, 5)).trim(),
      seats:           tickets.map(function (t) { return t.rowLabel + t.seatNumber; }),
      ticketCount:     tickets.length,
      finalAmount:     uiAction.totalAmount,
      issuedAt:        new Date().toISOString(),
      status:          'reserved',
      tickets:         tickets,
      foods:           []
    };
    try { sessionStorage.setItem('latestTicket', JSON.stringify(latest)); } catch (e) { /* ignore */ }
    window.dispatchEvent(new CustomEvent('halcinema:ticketAdded', { detail: latest }));
  }

  function submitUserText(containerId, text) {
    var store = getStore(containerId);
    if (!store.state.intent) {
      // 意図未選択のまま自由入力された場合は、そのモードの先頭の意図を既定にする
      // （assistantモードは選択肢が1つしかないため常にそれになる）
      var fallback = getIntents(containerId)[0];
      store.state.intent   = fallback.id;
      store.state.messages = [];
      store.state.slots    = emptySlots();
      store.state.log      = [];
      saveState(store);
      var container = document.getElementById(containerId);
      var qr = container && container.querySelector('.quick-replies');
      if (qr) qr.remove();
    }
    recordAndRender(containerId, { role: 'user', text: text });
    sendToChat(containerId, text);
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
    submitUserText('chat-messages-full', text);
  }

  /* ──────────────────────────────────────────────────────────
     送信処理（ウィジェット）— common.js からも呼べるよう公開
     ────────────────────────────────────────────────────────── */
  function sendFromWidget(text) {
    var input = document.getElementById('chat-input-widget');
    if (input) input.value = '';
    if (!text || !text.trim()) return;
    submitUserText('chat-messages-widget', text.trim());
  }

  /* ──────────────────────────────────────────────────────────
     各サーフェス（フルページ／ウィジェット）の初期化
     すでに intent が確定していればログを再生し、未確定なら
     静的な初期クイックリプライを3択の意図ピッカーに差し替える。
     ────────────────────────────────────────────────────────── */
  function initSurface(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var staticQr = container.querySelector('.quick-replies');
    if (staticQr) staticQr.remove();

    var store = getStore(containerId);
    if (store.state.intent && store.state.log && store.state.log.length) {
      store.state.log.forEach(function (entry) { renderLogEntry(containerId, entry); });
    } else {
      showIntentPicker(containerId);
    }
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

    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    document.querySelectorAll('#chat-messages-full .speak-btn').forEach(function (b) {
      b.addEventListener('click', function () { speak(b.dataset.text, b); });
    });

    var voiceToggle = document.getElementById('voice-toggle-full');
    var voiceLabel  = document.getElementById('voice-label-full');
    if (voiceToggle) {
      voiceToggle.addEventListener('click', function () {
        voiceFull = !voiceFull;
        voiceToggle.classList.toggle('voice-on', voiceFull);
        if (voiceLabel) voiceLabel.textContent = voiceFull ? '音声 ON' : '音声 OFF';
      });
    }

    var newChatBtn = document.getElementById('new-chat-btn-full');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', function () { startNewChat('chat-messages-full'); });
    }
    var historyBtn = document.getElementById('history-btn-full');
    if (historyBtn) {
      historyBtn.addEventListener('click', function () { openHistoryPanel('chat-messages-full'); });
    }
  }

  /* ──────────────────────────────────────────────────────────
     ウィジェットの新規チャット／履歴ボタン設定
     ────────────────────────────────────────────────────────── */
  function initWidgetChatButtons() {
    var newChatBtn = document.getElementById('new-chat-btn-widget');
    if (newChatBtn) {
      newChatBtn.addEventListener('click', function () { startNewChat('chat-messages-widget'); });
    }
    var historyBtn = document.getElementById('history-btn-widget');
    if (historyBtn) {
      historyBtn.addEventListener('click', function () { openHistoryPanel('chat-messages-widget'); });
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
  document.addEventListener('DOMContentLoaded', function () {
    initFullPage();
    initWidgetChatButtons();
    initSurface('chat-messages-full');
    initSurface('chat-messages-widget');
  });

})();
