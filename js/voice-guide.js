/* ============================================================
   HAL CINEMA — voice-guide.js
   音声案内コンポーネント

   【動作仕様】
   ・.voice-guide（赤枠全体）をクリック → 再生 / 再生中なら停止
   ・.voice-guide-btn（スピーカー丸）をクリック → ミュートON/OFF
   ・ミュート中は赤枠クリック無効（opacity低下はCSSで制御）
   ・再生終了 → 自動リセット
   ・複数コンポーネントがあっても同時再生しない

   【クラスの付き先（CSSと対応）】
   ・再生中  → .voice-guide に .playing を付与
   ・ミュート → .voice-guide に .muted  を付与

   【HTML構造（変更不要）】
   <div class="voice-guide" data-audio="../voice/...wav">
     <p class="voice-guide-text">テキスト</p>
     <button class="voice-guide-btn">
       <img src="../images/volum_on.png" alt="音声">
     </button>
   </div>
   ============================================================ */

(function () {
  'use strict';

  var IMG_ON  = '../images/volum_on.png';
  var IMG_OFF = '../images/volume_off.png';

  /* 現在再生中の情報（同時再生防止） */
  var active = {
    audio:   null,
    wrapper: null,
  };

  /* ----------------------------------------------------------
     停止してリセット
  ---------------------------------------------------------- */
  function stopCurrent() {
    if (active.audio) {
      active.audio.pause();
      active.audio.currentTime = 0;
    }
    if (active.wrapper) {
      active.wrapper.classList.remove('playing');
    }
    active.audio   = null;
    active.wrapper = null;
  }

  /* ----------------------------------------------------------
     .voice-guide（赤枠全体）クリック → 再生 / 停止
  ---------------------------------------------------------- */
  function handleWrapperClick(wrapper) {
    /* ミュート中は何もしない */
    if (wrapper.classList.contains('muted')) return;

    /* 同じ枠を再クリック → 停止 */
    if (active.wrapper === wrapper) {
      stopCurrent();
      return;
    }

    /* 別が再生中なら止める */
    stopCurrent();

    var src = wrapper.dataset.audio;
    if (!src) {
      console.warn('[voice-guide] data-audio が設定されていません:', wrapper);
      return;
    }

    var audio = new Audio(src);

    audio.addEventListener('ended', function () {
      wrapper.classList.remove('playing');
      active.audio   = null;
      active.wrapper = null;
    });

    audio.addEventListener('error', function () {
      console.warn('[voice-guide] 音声ファイルを読み込めませんでした:', src);
      wrapper.classList.remove('playing');
      active.audio   = null;
      active.wrapper = null;
    });

    active.audio   = audio;
    active.wrapper = wrapper;
    wrapper.classList.add('playing');
    audio.play();
  }

  /* ----------------------------------------------------------
     .voice-guide-btn（スピーカー丸）クリック → ミュートON/OFF
     ※ 赤枠全体へのクリック伝播を stopPropagation で止める
  ---------------------------------------------------------- */
  function handleSpeakerClick(e, wrapper) {
    e.stopPropagation(); /* 再生/停止が誤作動しないように */

    var muted = wrapper.classList.toggle('muted');
    var img   = wrapper.querySelector('.voice-guide-btn img');
    if (img) {
      img.src = muted ? IMG_OFF : IMG_ON;
      img.alt = muted ? 'ミュート中' : '音声';
    }

    var btn = wrapper.querySelector('.voice-guide-btn');
    if (btn) {
      btn.setAttribute('aria-label', muted ? '音声をオンにする' : '音声をオフにする');
    }

    /* ミュートにした瞬間、このコンポーネントが再生中なら止める */
    if (muted && active.wrapper === wrapper) {
      stopCurrent();
    }
  }

  /* ----------------------------------------------------------
     初期化：全 .voice-guide にイベントを設定
  ---------------------------------------------------------- */
  function init() {
    var guides = document.querySelectorAll('.voice-guide');

    guides.forEach(function (wrapper) {
      var speaker = wrapper.querySelector('.voice-guide-btn');

      if (!speaker) {
        console.warn('[voice-guide] .voice-guide-btn が見つかりません:', wrapper);
        return;
      }

      /* 赤枠全体クリック → 再生/停止 */
      wrapper.addEventListener('click', function () {
        handleWrapperClick(wrapper);
      });

      /* スピーカーボタン → ミュート切り替え（伝播は内部でstop） */
      speaker.addEventListener('click', function (e) {
        handleSpeakerClick(e, wrapper);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
