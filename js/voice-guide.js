/* =========================================================
   音声案内コンポーネント  voice-guide
   ---------------------------------------------------------
   使い方:
     1) 各ページの <head> で css/voice-guide.css を読み込む
        <link rel="stylesheet" href="../css/voice-guide.css">
     2) 画面上部に下記 HTML を 1 個置く（data-audio に音声パスを指定）
        <div class="voice-guide" data-audio="../voice/01_seat-select.mp3">
          <button class="voice-guide__body" type="button">
            予約する席を選択してください。<br>
            選択後、次へを押して進んでください
          </button>
          <button class="voice-guide__speaker" type="button"></button>
        </div>
     3) </body> の前で js/voice-guide.js を読み込む
        <script src="../js/voice-guide.js" defer></script>
   ---------------------------------------------------------
   動作:
     ・吹き出しをタップ → 再生中なら停止 / 停止中なら最初から再生
     ・スピーカーをタップ → ミュート ON / OFF
     ・音声が終わると自動的に「停止」状態に戻る
   オプション（div の属性で指定）:
     ・data-audio    … 音声ファイルのパス（必須）
     ・data-autoplay … "false" にするとページ表示時の自動再生をしない
   ========================================================= */
(function () {
  "use strict";

  // ★ スピーカーアイコンは CSS の background-image（PNG画像）で表示するため
  //    JS 側でのアイコン注入は不要。ミュート状態は .is-muted クラスで切り替わる。

  function initOne(root) {
    if (root._vgInit) return;        // 二重初期化を防止
    root._vgInit = true;

    var body    = root.querySelector(".voice-guide__body");
    var speaker = root.querySelector(".voice-guide__speaker");
    var src     = root.getAttribute("data-audio");

    if (!body || !speaker || !src) {
      console.warn("[voice-guide] 必要な要素または data-audio がありません", root);
      return;
    }

    // aria 属性のみ付与（アイコンは CSS background-image で表示）
    speaker.setAttribute("type", "button");
    speaker.setAttribute("aria-pressed", "false");
    speaker.setAttribute("aria-label", "音声をミュート");
    body.setAttribute("type", "button");
    body.setAttribute("aria-label", "音声案内を再生 / 停止");

    // 音声を用意
    var audio = new Audio(src);
    audio.preload = "auto";
    root._audio = audio;

    function play() {
      audio.currentTime = 0;
      var p = audio.play();
      // ブラウザの自動再生制限などで失敗してもエラーにしない
      if (p && typeof p.catch === "function") {
        p.catch(function () {});
      }
    }
    function stop() {
      audio.pause();
      audio.currentTime = 0;
    }

    // 吹き出し: 再生 / 停止 のトグル
    body.addEventListener("click", function () {
      if (audio.paused) {
        play();
      } else {
        stop();
      }
    });

    // スピーカー: ミュート切り替え
    speaker.addEventListener("click", function () {
      audio.muted = !audio.muted;
      root.classList.toggle("is-muted", audio.muted);
      speaker.setAttribute("aria-pressed", String(audio.muted));
      speaker.setAttribute(
        "aria-label",
        audio.muted ? "音声のミュートを解除" : "音声をミュート"
      );
    });

    // 再生状態に応じて見た目を更新
    audio.addEventListener("play",  function () { root.classList.add("is-playing"); });
    audio.addEventListener("pause", function () { root.classList.remove("is-playing"); });
    audio.addEventListener("ended", function () { root.classList.remove("is-playing"); });

    // ページ表示時に自動再生を試みる（data-autoplay="false" で無効）
    if (root.getAttribute("data-autoplay") !== "false") {
      play();
    }
  }

  function initAll() {
    var list = document.querySelectorAll(".voice-guide");
    for (var i = 0; i < list.length; i++) {
      initOne(list[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  // 動的に追加した場合に手動で呼べるよう公開
  window.VoiceGuide = { init: initAll, initOne: initOne };
})();
