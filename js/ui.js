/* 画面共通の小さなUI部品 */

(function () {

  // ── 1. トースト ──

  var toastTimer = null;

  function toast(message) {
    var el = document.getElementById('hal-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hal-toast';
      el.className = 'hal-toast';
      document.body.appendChild(el);
    }

    el.textContent = message;
    // 一度クラスを外してから付け直すと、連続で出したときもアニメーションが再生される
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
    }, 2200);
  }

  // ── 2. 横スクロール行の矢印 ──
  // .movie-row-scroll を見つけて .movie-row で包み、左右の矢印を差し込む。
  // HTML側は今まで通り .movie-row-scroll を置くだけでよい。
  // カードを後から innerHTML で入れる行にも対応するため、
  // 初期化後に refresh() を呼べば矢印の表示状態が更新される。

  var ARROW_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
  var ARROW_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

  function makeArrow(dir) {
    var btn = document.createElement('button');
    btn.className = 'row-nav row-nav-' + dir;
    btn.type = 'button';
    btn.setAttribute('aria-label', dir === 'prev' ? '前へ' : '次へ');
    btn.innerHTML = (dir === 'prev' ? ARROW_PREV : ARROW_NEXT);
    return btn;
  }

  /* 端まで来たら矢印を隠す。スクロールしない行では両方隠す。 */
  function updateArrows(scroller, prevBtn, nextBtn) {
    var max = scroller.scrollWidth - scroller.clientWidth;
    if (max <= 4) {
      prevBtn.classList.add('is-hidden');
      nextBtn.classList.add('is-hidden');
      return;
    }
    prevBtn.classList.toggle('is-hidden', scroller.scrollLeft <= 4);
    nextBtn.classList.toggle('is-hidden', scroller.scrollLeft >= max - 4);
  }

  function attachRow(scroller) {
    if (scroller.dataset.rowNavReady === 'true') return;
    scroller.dataset.rowNavReady = 'true';

    var row = document.createElement('div');
    row.className = 'movie-row';
    scroller.parentNode.insertBefore(row, scroller);
    row.appendChild(scroller);

    var prevBtn = makeArrow('prev');
    var nextBtn = makeArrow('next');
    row.appendChild(prevBtn);
    row.appendChild(nextBtn);

    function step(dir) {
      // 見えている幅の8割ぶん送る（カードが半端に切れないよう少し余裕を持たせる）
      var amount = Math.round(scroller.clientWidth * 0.8);
      scroller.scrollBy({ left: dir * amount, behavior: 'smooth' });
    }

    prevBtn.addEventListener('click', function () { step(-1); });
    nextBtn.addEventListener('click', function () { step(1); });

    scroller.addEventListener('scroll', function () {
      updateArrows(scroller, prevBtn, nextBtn);
    });

    scroller._halUpdateArrows = function () {
      updateArrows(scroller, prevBtn, nextBtn);
    };

    updateArrows(scroller, prevBtn, nextBtn);
  }

  /* root 配下の .movie-row-scroll をすべて初期化する */
  function initRowScroll(root) {
    var scope = root || document;
    scope.querySelectorAll('.movie-row-scroll').forEach(attachRow);
    refreshRowScroll();
  }

  /* カードを流し込んだ後に呼ぶと矢印の出しわけが更新される */
  function refreshRowScroll() {
    document.querySelectorAll('.movie-row-scroll').forEach(function (s) {
      if (typeof s._halUpdateArrows === 'function') s._halUpdateArrows();
    });
  }

  /* 画面幅が変わると「スクロールが必要か」も変わるので追従させる */
  window.addEventListener('resize', refreshRowScroll);

  // ── 公開 ──

  window.HalUI = {
    toast:            toast,
    initRowScroll:    initRowScroll,
    refreshRowScroll: refreshRowScroll
  };

})();
