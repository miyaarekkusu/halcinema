/* ============================================================
   step-progress.js
   予約フロー各ページのステップ進捗バーを自動挿入する
   ============================================================ */
(function () {
  var STEPS = [
    { label: '座席選択',     href: 'zaseki.html' },
    { label: '券種選択',     href: 'ticket-select.html' },
    { label: 'フード・グッズ', href: 'food-select.html' },
    { label: '注文確認',     href: 'order-confirm.html' },
    { label: '決済',         href: 'payment.html' },
    { label: '完了',         href: 'complete.html' },
  ];

  // 現在のページ名から何番目かを判定
  var path = location.pathname;
  var current = -1;
  STEPS.forEach(function (s, i) {
    if (path.indexOf(s.href.replace('.html', '')) !== -1) current = i;
  });
  if (current === -1) return; // 対象外ページは何もしない

  // バー要素生成
  var wrap = document.createElement('div');
  wrap.className = 'flow-progress';

  STEPS.forEach(function (s, i) {
    var state = i < current ? 'done' : i === current ? 'active' : '';

    var step = document.createElement('div');
    step.className = 'flow-step ' + state;
    step.innerHTML =
      '<span class="flow-step-num">' + (i + 1) + '</span>' +
      '<span class="flow-step-label">' + s.label + '</span>';

    wrap.appendChild(step);

    if (i < STEPS.length - 1) {
      var line = document.createElement('div');
      line.className = 'flow-line' + (i < current ? ' done' : '');
      wrap.appendChild(line);
    }
  });

  // ステップヘッダーの直前に挿入（ヘッダーバーの上）
  var stepHeader = document.querySelector(
    '.zaseki-step-header, .ts-step-header, .fs-step-header, .oc-step-header'
  );
  if (stepHeader) {
    stepHeader.parentNode.insertBefore(wrap, stepHeader);
  } else {
    var main = document.querySelector('main') || document.body;
    main.insertBefore(wrap, main.firstChild);
  }
})();
