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

  var API_BASE = 'http://localhost:8080';
  var THREADS_KEY = 'halcinema_chat_threads';
  var ACTIVE_KEY  = 'halcinema_chat_active_id';

  var INTENTS = [
    { id: 'assistant', label: 'アシスタントに質問する', trigger: 'アシスタントに質問したいです' },
    { id: 'recommend', label: 'おすすめ映画を聞く',     trigger: 'おすすめの映画を教えてください' },
    { id: 'reserve',   label: 'AIで予約する',           trigger: 'AIで予約をしたいです' }
  ];

  var GREETINGS = {
    'chat-messages-full':   'こんにちは！HALシネマのアシスタントです。\n上映スケジュール・予約・劇場案内など、なんでもお気軽にご質問ください。',
    'chat-messages-widget': '何かお手伝いできることはありますか？'
  };

  /* ──────────────────────────────────────────────────────────
     会話スレッド管理
     localStorage に複数スレッド（新規チャットごとの会話）を保持し、
     「新規チャット」「履歴から呼び出し」を可能にする。
     state = 現在アクティブなスレッド（intent/messages/slots/log）。
     ────────────────────────────────────────────────────────── */
  function emptySlots() {
    return { movieId: 0, scheduleId: 0, seatCount: 0, seatIds: [], paymentMethod: 0, cardId: 0 };
  }

  function generateThreadId() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function createThread() {
    var now = Date.now();
    return { id: generateThreadId(), intent: null, messages: [], slots: emptySlots(), log: [], createdAt: now, updatedAt: now };
  }

  function loadAllThreads() {
    try {
      var raw = localStorage.getItem(THREADS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveAllThreads() {
    try { localStorage.setItem(THREADS_KEY, JSON.stringify(threads)); } catch (e) { /* ignore */ }
  }

  function persistActiveId() {
    try { localStorage.setItem(ACTIVE_KEY, activeId); } catch (e) { /* ignore */ }
  }

  var threads  = loadAllThreads();
  var activeId = null;
  try { activeId = localStorage.getItem(ACTIVE_KEY); } catch (e) { /* ignore */ }

  var state = null;
  for (var _i = 0; _i < threads.length; _i++) {
    if (threads[_i].id === activeId) { state = threads[_i]; break; }
  }
  if (!state) {
    state = createThread();
    threads.push(state);
    activeId = state.id;
  }
  persistActiveId();

  function saveState() {
    state.updatedAt = Date.now();
    var idx = -1;
    for (var i = 0; i < threads.length; i++) { if (threads[i].id === state.id) { idx = i; break; } }
    if (idx === -1) threads.push(state); else threads[idx] = state;
    saveAllThreads();
  }

  function resetContainerDom(containerId) {
    var container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
  }

  function threadTitle(t) {
    for (var i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i].id === t.intent) return INTENTS[i].label;
    }
    return '新規チャット';
  }

  function threadPreview(t) {
    var log = t.log || [];
    for (var i = log.length - 1; i >= 0; i--) {
      var entry = log[i];
      if (entry.text) return entry.text.slice(0, 42);
      if (entry.rich) {
        if (entry.rich.kind === 'seat_picker')           return '座席を選択してください';
        if (entry.rich.kind === 'movie_cards')           return 'おすすめ映画をご紹介しました';
        if (entry.rich.kind === 'reservation_confirmed') return 'ご予約が完了しました';
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
    closeHistoryPanel(containerId);
    state = createThread();
    activeId = state.id;
    persistActiveId();
    resetContainerDom(containerId);
    addMessage(containerId, 'bot', GREETINGS[containerId] || '');
    showIntentPicker(containerId);
  }

  function switchThread(containerId, id) {
    if (id === state.id) { closeHistoryPanel(containerId); return; }
    var found = null;
    for (var i = 0; i < threads.length; i++) { if (threads[i].id === id) { found = threads[i]; break; } }
    if (!found) return;

    closeHistoryPanel(containerId);
    state = found;
    activeId = id;
    persistActiveId();
    resetContainerDom(containerId);
    addMessage(containerId, 'bot', GREETINGS[containerId] || '');
    if (state.intent && state.log && state.log.length) {
      state.log.forEach(function (entry) { renderLogEntry(containerId, entry); });
    } else {
      showIntentPicker(containerId);
    }
  }

  function deleteThread(containerId, id) {
    threads = threads.filter(function (t) { return t.id !== id; });
    saveAllThreads();
    if (id === state.id) {
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

    var sorted = threads
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
        item.className = 'chat-history-item' + (t.id === state.id ? ' is-active' : '');

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
    state.log = state.log || [];
    state.log.push(entry);
    saveState();
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

    if (rich.kind === 'seat_picker') {
      buildSeatPickerBlock(block, containerId, rich);
    } else if (rich.kind === 'movie_cards') {
      buildMovieCardsBlock(block, rich.payload);
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

  function buildSeatPickerBlock(block, containerId, rich) {
    var payload = rich.payload || {};
    var seats = payload.seats || [];

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
    seats.forEach(function (s) {
      if (!rowsMap[s.rowLabel]) { rowsMap[s.rowLabel] = []; order.push(s.rowLabel); }
      rowsMap[s.rowLabel].push(s);
    });

    var grid = document.createElement('div');
    grid.className = 'seat-grid';

    var selected = {};

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

          if (rich.answered || seat.status !== 0) {
            btn.disabled = true;
            if (seat.status !== 0) btn.classList.add('taken');
          } else {
            btn.addEventListener('click', function () {
              if (selected[seat.seatId]) {
                delete selected[seat.seatId];
                btn.classList.remove('selected');
              } else {
                selected[seat.seatId] = seat;
                btn.classList.add('selected');
              }
              confirmBtn.disabled = Object.keys(selected).length === 0;
            });
          }
          rowEl.appendChild(btn);
        });

      grid.appendChild(rowEl);
    });

    block.appendChild(grid);

    if (rich.answered) return;

    var confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'rich-confirm-btn';
    confirmBtn.textContent = '選択した座席で確定';
    confirmBtn.disabled = true;
    confirmBtn.addEventListener('click', function () {
      var chosen = Object.keys(selected).map(function (id) { return selected[id]; });
      if (!chosen.length) return;

      confirmBtn.disabled = true;
      grid.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      block.classList.add('is-answered');
      rich.answered = true;
      saveState();

      var labels = chosen
        .sort(function (a, b) { return a.seatNumber - b.seatNumber; })
        .map(function (s) { return s.rowLabel + s.seatNumber; });

      state.slots.seatIds = chosen.map(function (s) { return s.seatId; });
      saveState();

      var text = '座席 ' + labels.join('、') + ' を選択しました。';
      recordAndRender(containerId, { role: 'user', text: text });
      sendToChat(containerId, text);
    });
    block.appendChild(confirmBtn);
  }

  function buildMovieCardsBlock(block, movies) {
    (movies || []).forEach(function (m) {
      var meta = [];
      if (m.genre) meta.push(m.genre);
      if (m.duration) meta.push(m.duration + '分');
      if (m.rating) meta.push(m.rating);

      var card = document.createElement('div');
      card.className = 'chat-movie-card';
      card.innerHTML =
        '<p class="chat-movie-card-title">' + escapeHtml(m.title || '') + '</p>'
        + (meta.length ? '<p class="chat-movie-card-meta">' + escapeHtml(meta.join(' ・ ')) + '</p>' : '')
        + (m.synopsis ? '<p class="chat-movie-card-synopsis">' + escapeHtml(m.synopsis) + '</p>' : '');
      block.appendChild(card);
    });
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
     意図選択（3択クイックリプライ）
     ────────────────────────────────────────────────────────── */
  function showIntentPicker(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var wrap = document.createElement('div');
    wrap.className = 'quick-replies';
    INTENTS.forEach(function (intent) {
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
    state.intent   = intent.id;
    state.messages = [];
    state.slots    = emptySlots();
    state.log      = [];
    saveState();

    recordAndRender(containerId, { role: 'user', text: intent.trigger });
    sendToChat(containerId, intent.trigger);
  }

  /* ──────────────────────────────────────────────────────────
     /api/chat 呼び出し
     ────────────────────────────────────────────────────────── */
  function sendToChat(containerId, text) {
    state.messages.push({ role: 'user', content: text });
    saveState();
    showTyping(containerId);

    var headers = { 'Content-Type': 'application/json' };
    var token = localStorage.getItem('hal_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ intent: state.intent, messages: state.messages, slots: state.slots })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      })
      .then(function (data) {
        hideTyping(containerId);

        state.messages = data.messages || state.messages;
        state.slots    = data.slots || state.slots;
        saveState();

        if (data.reply) {
          recordAndRender(containerId, { role: 'bot', text: data.reply });
        }
        if (data.recommendedMovies && data.recommendedMovies.length) {
          recordAndRender(containerId, { role: 'bot', rich: { kind: 'movie_cards', payload: data.recommendedMovies } });
        }
        if (data.uiAction) {
          recordAndRender(containerId, { role: 'bot', rich: { kind: data.uiAction.type, payload: data.uiAction } });
        }
      })
      .catch(function () {
        hideTyping(containerId);
        addMessage(containerId, 'bot', '通信に失敗しました。少し時間をおいて再度お試しください。');
      });
  }

  function submitUserText(containerId, text) {
    if (!state.intent) {
      // 意図未選択のまま自由入力された場合はアシスタント扱いにする
      state.intent   = 'assistant';
      state.messages = [];
      state.slots    = emptySlots();
      state.log      = [];
      saveState();
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

    if (state.intent && state.log && state.log.length) {
      state.log.forEach(function (entry) { renderLogEntry(containerId, entry); });
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
