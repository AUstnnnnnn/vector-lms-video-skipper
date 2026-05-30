// ==UserScript==
// @name         Video Skipper — Vector LMS
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Speed controls for Vector LMS — no seeking, no videojs API, just native playbackRate
// @match        file://*/*Sexual*Assault*Prevention*
// @match        file://*/*Vector*LMS*
// @match        file://*/*safecolleges*
// @match        https://*.safecolleges.com/*
// @match        https://*.trainingcdn.com/*
// @match        https://*.vectorsolutions.com/*
// @match        https://*.vectorlmssolutions.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SPEEDS = [1, 2, 4, 8, 16];
  let speedIdx = 0;

  function getVideo() {
    return document.querySelector('video.vjs-tech') || document.querySelector('video');
  }

  let enforceInterval = null;

  function applySpeed(rate) {
    const vid = getVideo();
    if (vid) vid.playbackRate = rate;
    speedBtn.textContent = rate + 'x';

    // Continuously re-enforce rate since the player resets it
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
  speedBtn.style.minWidth = '36px';
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
})();
