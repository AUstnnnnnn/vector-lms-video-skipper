// ==UserScript==
// @name         Video Skipper — Vector LMS
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Speed controls for Vector LMS — strips audit_data from tracking_finish to bypass fast-forward detection
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

  // --- XHR interception: strip audit_data from tracking_finish ---
  // The server uses audit_data to detect fast-forward; remove it before the request fires.
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._interceptUrl = url;
    return origOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (this._interceptUrl && this._interceptUrl.includes('tracking_') && body) {
      try {
        // audit_data and context_updates are nested inside a `json` field as a JSON string
        const params = new URLSearchParams(body);
        if (params.has('json')) {
          const inner = JSON.parse(params.get('json'));
          delete inner.audit_data;
          delete inner.context_updates;
          params.set('json', JSON.stringify(inner));
          body = params.toString();
        }
        // also strip any top-level audit_data just in case
        params.delete('audit_data');
        body = params.toString();
      } catch (e) {}
    }
    return origSend.apply(this, [body]);
  };

  // Also intercept fetch (in case the page ever switches)
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    if (init && init.body && typeof input === 'string' && input.includes('tracking_finish')) {
      try {
        const params = new URLSearchParams(init.body);
        params.delete('audit_data');
        init = { ...init, body: params.toString() };
      } catch (e) {}
    }
    return origFetch.apply(this, [input, init]);
  };

  // --- jQuery ajaxSend hook (belt-and-suspenders over XHR patch) ---
  function hookJQuery() {
    if (!window.$) return false;
    $(document).ajaxSend(function (event, xhr, settings) {
      if (settings.url && settings.url.includes('tracking_')) {
        try {
          const params = new URLSearchParams(settings.data);
          if (params.has('json')) {
            const inner = JSON.parse(params.get('json'));
            delete inner.audit_data;
            delete inner.context_updates;
            params.set('json', JSON.stringify(inner));
            settings.data = params.toString();
          }
          params.delete('audit_data');
          settings.data = params.toString();
        } catch (e) {}
      }
    });
    return true;
  }

  const jqHookInterval = setInterval(() => {
    if (hookJQuery()) clearInterval(jqHookInterval);
  }, 200);

  // --- Nullify slip player audit methods after it initializes ---
  function patchSlipPlayer() {
    try {
      const $slip = window.$player?.sl_jwplayer?.call(window.$player);
      if ($slip) {
        if ($slip.get_audit_data) $slip.get_audit_data = () => null;
        if ($slip.get_context_changes) $slip.get_context_changes = () => null;
        $slip.uses_suppression_rules = false;
        $slip.audit_level = 0;
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Retry patching until slip player is ready
  const patchInterval = setInterval(() => {
    if (patchSlipPlayer()) clearInterval(patchInterval);
  }, 500);

  // --- UI (injected after DOM ready) ---
  function initUI() {
    const SPEEDS = [1, 2, 4, 8, 16];
    let speedIdx = 0;
    let enforceInterval = null;

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
  }

  if (document.body) {
    initUI();
  } else {
    document.addEventListener('DOMContentLoaded', initUI);
  }
})();
