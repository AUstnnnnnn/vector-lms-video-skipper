// ==UserScript==
// @name         Video Skipper — Vector LMS
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Speed controls for Vector LMS — delays tracking_finish until server timer is satisfied
// @match        file://*/*Sexual*Assault*Prevention*
// @match        file://*/*Vector*LMS*
// @match        file://*/*safecolleges*
// @match        https://*.safecolleges.com/*
// @match        https://*.trainingcdn.com/*
// @match        https://*.vectorsolutions.com/*
// @match        https://*.vectorlmssolutions.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // Record when tracking_start fires as our session baseline
  let sessionStartTime = Date.now();
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._interceptUrl = url;
    if (url && url.includes('tracking_start')) {
      this.addEventListener('load', () => { sessionStartTime = Date.now(); });
    }
    return origOpen.apply(this, [method, url, ...rest]);
  };

  // --- UI + logic (after DOM ready) ---
  function initUI() {
    const SPEEDS = [1, 2, 4, 8, 16];
    let speedIdx = 0;
    let enforceInterval = null;
    let countdownInterval = null;

    function getVideo() {
      return document.querySelector('video.vjs-tech') || document.querySelector('video');
    }

    function applySpeed(rate) {
      const vid = getVideo();
      if (vid) vid.playbackRate = rate;
      speedBtn.textContent = rate + 'x';
      clearInterval(enforceInterval);
      if (rate !== 1) {
        enforceInterval = setInterval(() => {
          const v = getVideo();
          if (v && v.playbackRate !== rate) v.playbackRate = rate;
        }, 50);
      }
    }

    function cycleSpeed() {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      applySpeed(SPEEDS[speedIdx]);
    }

    // Wrap finish_tracking to delay until server timer is satisfied
    function wrapFinishTracking() {
      if (!window.ss_player_tracking || !window.ss_player_tracking.finish_tracking) return false;
      if (window.ss_player_tracking._wrapped) return true;

      const orig = window.ss_player_tracking.finish_tracking;
      window.ss_player_tracking.finish_tracking = function (options) {
        const vid = getVideo();
        const duration = vid && isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 0;
        const elapsed = (Date.now() - sessionStartTime) / 1000;
        // Require 92% of video duration to have elapsed in real time
        const required = duration * 0.92;
        const wait = Math.max(0, required - elapsed);

        if (wait > 1) {
          showCountdown(wait, () => orig.call(window.ss_player_tracking, options));
        } else {
          orig.call(window.ss_player_tracking, options);
        }
      };
      window.ss_player_tracking._wrapped = true;
      return true;
    }

    const wrapInterval = setInterval(() => {
      if (wrapFinishTracking()) clearInterval(wrapInterval);
    }, 300);

    // Countdown display in the overlay
    function showCountdown(waitSecs, callback) {
      clearInterval(enforceInterval); // stop speed enforcement while waiting
      let remaining = Math.ceil(waitSecs);
      speedBtn.textContent = `${remaining}s`;
      speedBtn.title = 'Waiting for server timer…';

      countdownInterval = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(countdownInterval);
          speedBtn.textContent = '✓';
          setTimeout(callback, 100);
        } else {
          speedBtn.textContent = `${remaining}s`;
        }
      }, 1000);
    }

    // Build overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed',
      'bottom:12px',
      'right:12px',
      'z-index:2147483647',
      'display:flex',
      'gap:6px',
      'align-items:center',
      'background:rgba(0,0,0,0.72)',
      'border-radius:8px',
      'padding:6px 10px',
      'backdrop-filter:blur(4px)',
      'font-family:system-ui,sans-serif',
      'font-size:13px',
      'user-select:none',
    ].join(';');

    function makeBtn(label, title, onClick) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.title = title;
      btn.style.cssText = [
        'background:#ffffff22',
        'color:#fff',
        'border:none',
        'border-radius:5px',
        'padding:4px 9px',
        'cursor:pointer',
        'font-size:12px',
        'font-weight:600',
        'transition:background 0.15s',
        'white-space:nowrap',
      ].join(';');
      btn.addEventListener('mouseenter', () => btn.style.background = '#ffffff44');
      btn.addEventListener('mouseleave', () => btn.style.background = '#ffffff22');
      btn.addEventListener('click', onClick);
      return btn;
    }

    const speedBtn = makeBtn('1x', 'Cycle speed: 1x → 2x → 4x → 8x → 16x', cycleSpeed);
    speedBtn.style.minWidth = '42px';
    speedBtn.style.textAlign = 'center';

    const muteBtn = makeBtn('🔇', 'Toggle mute', () => {
      const vid = getVideo();
      if (!vid) return;
      vid.muted = !vid.muted;
      muteBtn.textContent = vid.muted ? '🔇' : '🔊';
    });

    const dismiss = makeBtn('✕', 'Hide overlay', () => overlay.remove());
    dismiss.style.cssText += ';background:transparent;opacity:0.5;padding:4px 6px;';
    dismiss.addEventListener('mouseenter', () => { dismiss.style.opacity = '1'; });
    dismiss.addEventListener('mouseleave', () => { dismiss.style.opacity = '0.5'; });

    overlay.append(speedBtn, muteBtn, dismiss);
    document.body.appendChild(overlay);
  }

  if (document.body) {
    initUI();
  } else {
    document.addEventListener('DOMContentLoaded', initUI);
  }
})();
