/*!
 * TipCryp Widget v1.1.0
 * https://tipcryp.me
 *
 * Embeddable crypto tipping widget for streamers and creators.
 * Tips go directly to creator wallets — zero platform fees.
 *
 * Usage:
 *   <script src="https://cdn.jsdelivr.net/npm/tipcryp-widget@1.1.0/widget.js"
 *           data-key="tcm_your_api_key"
 *           data-creator="your-name"
 *           data-wallet-eth="0x..."
 *           data-wallet-btc="bc1q..."
 *           data-wallet-xrp="r..."
 *           data-theme="dark"
 *           data-position="right">
 *   </script>
 *
 * Changelog v1.1.0:
 *   - Added QR code for destination wallet (updates on token change)
 *   - Removed Creator Payout Mode toggle
 *   - BTC / XRP labelled "(Exodus only)" in token dropdown
 *   - Send Tip button: theme cyan (#22d3ee) with black text
 *   - Bottom bar: white text, "Tipcryp.me" in cyan
 *
 * MIT License — Copyright (c) 2026 TipCryp Ecosystem
 */
(function (w, d) {
  'use strict';

  // ── Prevent double-init ──
  if (w.__TipCrypLoaded) return;
  w.__TipCrypLoaded = true;

  // ── Read config from script tag ──
  var scriptTag = d.currentScript || (function () {
    var scripts = d.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var CONFIG = {
    apiKey:    (scriptTag.getAttribute('data-key')        || '').replace(/[^a-z0-9_]/g, ''),
    creator:   (scriptTag.getAttribute('data-creator')    || 'Creator').replace(/[<>"'&]/g, ''),
    ethAddr:   (scriptTag.getAttribute('data-wallet-eth') || '').trim(),
    btcAddr:   (scriptTag.getAttribute('data-wallet-btc') || '').trim(),
    xrpAddr:   (scriptTag.getAttribute('data-wallet-xrp') || '').trim(),
    theme:     (scriptTag.getAttribute('data-theme')      || 'dark'),
    position:  (scriptTag.getAttribute('data-position')   || 'right'),
    currency:  (scriptTag.getAttribute('data-currency')   || 'ETH'),
  };

  // ── Validate API key format ──
  if (!CONFIG.apiKey || !/^tcm_[a-z0-9_]{20,}$/.test(CONFIG.apiKey)) {
    console.warn('[TipCryp] Invalid or missing data-key. Widget not loaded.');
    return;
  }

  // ── Token prices (updated from API) ──
  var PRICES = { ETH: 3200, BTC: 95000, USDT: 1, XRP: 0.55 };

  // ── Token → address map (from config) ──
  var ADDRS = {
    ETH:  CONFIG.ethAddr,
    USDT: CONFIG.ethAddr,  // Same EVM address for ERC-20
    BTC:  CONFIG.btcAddr,
    XRP:  CONFIG.xrpAddr,
  };

  var USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
  var NETS = {
    ETH:  'Ethereum Mainnet',
    USDT: 'Ethereum Mainnet (ERC-20)',
    BTC:  'Bitcoin Mainnet',
    XRP:  'XRP Ledger',
  };
  var EXPLORERS = {
    ETH:  'https://etherscan.io/address/' + CONFIG.ethAddr,
    USDT: 'https://etherscan.io/address/' + CONFIG.ethAddr,
    BTC:  'https://mempool.space/address/' + CONFIG.btcAddr,
    XRP:  'https://xrpscan.com/account/'  + CONFIG.xrpAddr,
  };

  // ── State ──
  var state = {
    connected:    false,
    account:      null,
    provider:     null,
    providerType: null,
    token:        CONFIG.currency || 'ETH',
    txPending:    false,
    open:         false,
    toastTimer:   null,
  };

  // ══════════════════════════════════════════════
  // CSS
  // ══════════════════════════════════════════════
  var CSS = [
    '#tcm-widget-fab{position:fixed;z-index:2147483640;',
    CONFIG.position === 'left' ? 'left:20px;' : 'right:20px;',
    'bottom:20px;display:flex;flex-direction:column;align-items:',
    CONFIG.position === 'left' ? 'flex-start;' : 'flex-end;',
    'gap:12px;font-family:system-ui,sans-serif;}',

    '#tcm-trigger-btn{width:56px;height:56px;border-radius:50%;background:#22d3ee;',
    'border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;',
    'box-shadow:0 4px 20px rgba(34,211,238,.45);transition:transform .2s,box-shadow .2s;',
    'touch-action:manipulation;-webkit-tap-highlight-color:transparent;}',
    '#tcm-trigger-btn:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(34,211,238,.6);}',
    '#tcm-trigger-btn svg{width:26px;height:26px;pointer-events:none;}',

    '#tcm-panel{width:340px;background:linear-gradient(to bottom,#111418,#0a0c10);',
    'border:1px solid rgba(34,211,238,.22);border-radius:20px;',
    'box-shadow:0 20px 60px rgba(0,0,0,.7);display:none;flex-direction:column;',
    'overflow:hidden;max-height:calc(100vh - 120px);}',
    '#tcm-panel.open{display:flex;}',

    '#tcm-panel-head{background:rgba(0,0,0,.4);border-bottom:1px solid rgba(255,255,255,.06);',
    'padding:14px 16px;display:flex;align-items:center;justify-content:space-between;}',
    '#tcm-panel-title{font-size:.92rem;font-weight:700;color:#fff;',
    'font-family:system-ui,sans-serif;letter-spacing:-.01em;}',
    '#tcm-panel-sub{font-family:monospace;font-size:.62rem;color:#64748b;margin-top:2px;}',
    '#tcm-close-btn{background:none;border:1px solid rgba(255,255,255,.1);',
    'border-radius:6px;color:#666;width:26px;height:26px;cursor:pointer;',
    'font-size:.9rem;display:flex;align-items:center;justify-content:center;transition:color .2s;}',
    '#tcm-close-btn:hover{color:#fff;border-color:rgba(255,255,255,.3);}',

    '#tcm-panel-body{padding:16px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;}',

    '.tcm-label{font-family:monospace;font-size:.62rem;text-transform:uppercase;',
    'letter-spacing:.1em;color:#22d3ee;font-weight:700;margin-bottom:6px;display:block;}',

    '.tcm-wallet-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;}',
    '.tcm-wallet-btn{display:flex;align-items:center;gap:8px;padding:10px 12px;',
    'background:#0a0a0a;border:1px solid #1e1e1e;border-radius:9px;color:#e2e8f0;',
    'font-family:monospace;font-size:.82rem;cursor:pointer !important;',
    'pointer-events:auto !important;transition:border-color .2s,background .2s,transform .1s;',
    'touch-action:manipulation;width:100%;text-align:left;white-space:nowrap;overflow:hidden;}',
    '.tcm-wallet-btn *{pointer-events:none !important;}',
    '.tcm-wallet-btn:hover{border-color:#22d3ee;background:#0a1418;transform:translateY(-1px);}',
    '.tcm-wallet-btn.tcm-connected{border-color:#4ade80;}',
    '.tcm-wallet-btn svg{width:22px;height:22px;flex-shrink:0;overflow:visible;}',
    '.tcm-wname{flex:1;}.tcm-wdot{width:6px;height:6px;border-radius:50%;',
    'background:#1e1e1e;flex-shrink:0;transition:background .3s;}',
    '.tcm-wallet-btn.tcm-connected .tcm-wdot{background:#4ade80;}',

    '.tcm-connected-bar{display:none;align-items:center;gap:6px;',
    'background:#050505;border:1px solid rgba(74,222,128,.25);border-radius:7px;',
    'padding:8px 11px;font-family:monospace;font-size:.72rem;margin-top:7px;}',
    '.tcm-connected-bar.show{display:flex;}',
    '.tcm-pulse{width:6px;height:6px;border-radius:50%;background:#4ade80;',
    'animation:tcmPulse 2s infinite;flex-shrink:0;}',
    '@keyframes tcmPulse{0%,100%{opacity:1;}50%{opacity:.4;}}',
    '.tcm-conn-name{color:#4ade80;font-weight:700;flex-shrink:0;}',
    '.tcm-conn-addr{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#94a3b8;}',
    '.tcm-disc-btn{background:none;border:1px solid #333;border-radius:4px;',
    'color:#666;font-size:.62rem;padding:2px 7px;cursor:pointer;font-family:monospace;',
    'transition:border-color .2s,color .2s;flex-shrink:0;}',
    '.tcm-disc-btn:hover{border-color:#f87171;color:#f87171;}',

    '.tcm-select-wrap{position:relative;}',
    '.tcm-select-wrap::after{content:"▾";position:absolute;right:11px;top:50%;',
    'transform:translateY(-50%);color:#22d3ee;font-size:.85rem;pointer-events:none;}',
    '.tcm-select{width:100%;appearance:none;-webkit-appearance:none;background:#000;',
    'color:#fff;border:1px solid #1e1e1e;border-radius:7px;padding:11px 30px 11px 12px;',
    'font-family:monospace;font-size:.85rem;cursor:pointer;outline:none;transition:border-color .2s;}',
    '.tcm-select:focus,.tcm-select:hover{border-color:#22d3ee;}',
    '.tcm-select option{background:#0a0a0a;color:#fff;}',

    '.tcm-addr-box{background:#050505;border:1px solid #1e1e1e;border-radius:7px;',
    'padding:10px 12px;font-family:monospace;font-size:.72rem;color:#334155;',
    'word-break:break-all;line-height:1.7;min-height:42px;transition:border-color .3s,color .3s;}',
    '.tcm-addr-box.active{color:#4ade80;border-color:rgba(74,222,128,.3);}',

    /* QR Code */
    '.tcm-qr-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;',
    'background:#050505;border:1px solid rgba(34,211,238,.15);border-radius:10px;padding:12px;}',
    '.tcm-qr-wrap canvas{border-radius:6px;display:block;}',
    '.tcm-qr-label{font-family:monospace;font-size:.6rem;color:#475569;text-align:center;}',

    '.tcm-amount-wrap{position:relative;}',
    '.tcm-amount-wrap input{width:100%;background:rgba(34,211,238,.04);color:#fff;',
    'border:1px solid rgba(34,211,238,.2);border-radius:7px;',
    'padding:12px 56px 12px 12px;font-family:monospace;font-size:1rem;',
    'outline:none;}',
    '.tcm-amount-unit{position:absolute;right:12px;top:50%;transform:translateY(-50%);',
    'color:#22d3ee;font-family:monospace;font-size:.8rem;font-weight:700;pointer-events:none;}',

    /* Send button — theme cyan, black text */
    '.tcm-send-btn{width:100%;padding:13px;background:#22d3ee;color:#000;border:none;',
    'border-radius:8px;font-family:system-ui,sans-serif;font-weight:900;',
    'font-size:.9rem;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;',
    'transition:background .2s,box-shadow .2s,transform .1s;',
    'box-shadow:0 0 20px rgba(34,211,238,.3);}',
    '.tcm-send-btn:hover{background:#67e8f9;box-shadow:0 0 30px rgba(34,211,238,.5);',
    'transform:translateY(-1px);}',
    '.tcm-send-btn:active{transform:translateY(0);}',

    '.tcm-tx-result{display:none;background:rgba(74,222,128,.05);',
    'border:1px solid rgba(74,222,128,.2);border-radius:9px;padding:12px 14px;}',
    '.tcm-tx-result.show{display:block;}',
    '.tcm-tx-ok{display:flex;align-items:center;gap:7px;margin-bottom:8px;}',
    '.tcm-tx-ok span:first-child{color:#4ade80;font-size:1.1rem;}',
    '.tcm-tx-ok span:last-child{font-size:.9rem;font-weight:700;color:#fff;',
    'font-family:system-ui,sans-serif;}',
    '.tcm-tx-rows{font-family:monospace;font-size:.7rem;color:#94a3b8;',
    'display:flex;flex-direction:column;gap:4px;}',
    '.tcm-tx-rows a{color:#22d3ee;word-break:break-all;}',

    '.tcm-modal-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);',
    'z-index:2147483645;align-items:center;justify-content:center;padding:1rem;}',
    '.tcm-modal-ov.show{display:flex;}',
    '.tcm-modal{background:#0d0d0d;border:1px solid #2a2a2a;border-radius:12px;',
    'padding:1.4rem;width:100%;max-width:340px;}',
    '.tcm-modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.9rem;}',
    '.tcm-modal-head h3{font-family:system-ui,sans-serif;font-size:.88rem;color:#22d3ee;font-weight:700;}',
    '.tcm-modal-x{background:none;border:1px solid #333;border-radius:5px;',
    'color:#666;width:26px;height:26px;cursor:pointer;font-size:.9rem;',
    'display:flex;align-items:center;justify-content:center;}',
    '.tcm-modal-x:hover{color:#fff;border-color:#666;}',
    '.tcm-modal-body{font-size:.85rem;color:#ccc;line-height:1.8;}',
    '.tcm-modal-note{font-family:monospace;font-size:.68rem;color:#475569;',
    'margin-top:.75rem;border-top:1px solid #1a1a1a;padding-top:.75rem;word-break:break-all;}',

    '.tcm-divider{border:none;border-top:1px solid rgba(255,255,255,.05);margin:2px 0;}',

    /* Bottom bar — white text, cyan brand */
    '.tcm-zero-fee{display:flex;align-items:center;gap:7px;',
    'background:rgba(74,222,128,.04);border:1px solid rgba(74,222,128,.12);',
    'border-radius:8px;padding:8px 12px;}',
    '.tcm-zero-fee-icon{color:#4ade80;font-size:.85rem;flex-shrink:0;}',
    '.tcm-zero-fee-text{font-family:monospace;font-size:.62rem;color:#ffffff;}',
    '.tcm-zero-fee-brand{color:#22d3ee;}',

    '#tcm-toast{position:fixed;bottom:90px;',
    CONFIG.position === 'left' ? 'left:20px;' : 'right:20px;',
    'background:#111620;border:1px solid rgba(255,255,255,.08);border-radius:10px;',
    'padding:10px 18px;font-family:monospace;font-size:.74rem;color:#e2e8f0;',
    'z-index:2147483641;transition:opacity .3s,transform .3s;opacity:0;',
    'transform:translateY(10px);pointer-events:none;max-width:280px;}',
    '#tcm-toast.show{opacity:1;transform:translateY(0);}',
    '#tcm-toast.success{border-color:rgba(74,222,128,.4);color:#4ade80;}',
    '#tcm-toast.error{border-color:rgba(248,113,113,.4);color:#f87171;}',
    '#tcm-toast.info{border-color:rgba(34,211,238,.3);color:#22d3ee;}',
  ].join('');

  // ══════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════
  function el(id) { return d.getElementById(id); }

  function escHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function toast(msg, type, dur) {
    var t = el('tcm-toast');
    if (!t) return;
    clearTimeout(state.toastTimer);
    t.textContent = msg;
    t.className = 'show ' + (type || '');
    state.toastTimer = setTimeout(function () { t.className = ''; }, dur || 4000);
  }

  function showAddress(token) {
    var box = el('tcm-addr-box');
    var addr = ADDRS[token] || '';
    if (addr) {
      box.textContent = addr;
      box.classList.add('active');
    } else {
      box.textContent = 'No address configured for ' + token;
      box.classList.remove('active');
    }
    // Update QR code
    generateQR(addr, token);
  }

  function updateQuickAmts(token) {
    var wrap = el('tcm-quick-amts');
    if (!wrap) return;
    var presets = { ETH:[0.01,0.05,0.1], BTC:[0.0001,0.001,0.005], USDT:[5,10,25], XRP:[10,50,100] };
    var vals = presets[token] || [];
    wrap.innerHTML = vals.map(function(v) {
      return '<button onclick="window.__TipCryp._setAmt(' + v + ')" style="background:#0a0a0a;border:1px solid #2a2a2a;border-radius:6px;color:#22d3ee;font-family:monospace;font-size:.72rem;padding:4px 10px;cursor:pointer;">' + v + ' ' + token + '</button>';
    }).join('');
  }

  function refreshUSD() {
    var token = state.token;
    var amt = parseFloat((el('tcm-amount-input') || {}).value) || 0;
    var usd = Math.round(amt * (PRICES[token] || 0));
    var usdEl = el('tcm-usd-val');
    if (usdEl) usdEl.textContent = '≈ $' + usd.toLocaleString() + ' USD';
  }

  function fetchPrices() {
    fetch('https://api.coinlore.net/api/tickers/?ids=80,2321,33285,58')
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (!data || !data.data) return;
        data.data.forEach(function(c){
          if (c.symbol === 'ETH')  PRICES.ETH  = parseFloat(c.price_usd);
          if (c.symbol === 'BTC')  PRICES.BTC  = parseFloat(c.price_usd);
          if (c.symbol === 'USDT') PRICES.USDT = parseFloat(c.price_usd);
          if (c.symbol === 'XRP')  PRICES.XRP  = parseFloat(c.price_usd);
        });
        refreshUSD();
      })
      .catch(function(){});
  }

  // ══════════════════════════════════════════════
  // QR CODE GENERATOR
  // ── Uses qrcodejs (already loaded by api-key.html)
  // ── or falls back to loading it dynamically
  // ══════════════════════════════════════════════
  var _qrLib = null;

  function generateQR(address, token) {
    var container = el('tcm-qr-container');
    var label     = el('tcm-qr-label');
    if (!container) return;

    if (!address) {
      container.innerHTML = '<p style="font-family:monospace;font-size:.62rem;color:#334155;text-align:center;padding:20px 0;">Select a token to see QR</p>';
      if (label) label.textContent = '—';
      return;
    }

    if (label) label.textContent = 'Scan to send ' + token;

    function render() {
      container.innerHTML = '';
      try {
        new w.QRCode(container, {
          text: address,
          width: 148,
          height: 148,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: w.QRCode.CorrectLevel.M,
        });
      } catch(e) {
        container.innerHTML = '<p style="font-family:monospace;font-size:.62rem;color:#f87171;text-align:center;">QR unavailable</p>';
      }
    }

    if (w.QRCode) {
      render();
    } else {
      // Dynamically load qrcodejs if not present on page
      var s = d.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      s.onload = render;
      s.onerror = function() {
        container.innerHTML = '<p style="font-family:monospace;font-size:.62rem;color:#f87171;text-align:center;">QR library failed to load</p>';
      };
      d.head.appendChild(s);
    }
  }

  // ══════════════════════════════════════════════
  // HTML
  // ══════════════════════════════════════════════
  var WALLET_NAMES = { metamask:'MetaMask', coinbase:'Coinbase', rabby:'Rabby', exodus:'Exodus' };

  function buildHTML() {
    var tokenOpts = '';
    if (CONFIG.ethAddr)  tokenOpts += '<option value="ETH">ETH — Ethereum</option>';
    if (CONFIG.ethAddr)  tokenOpts += '<option value="USDT">USDT — Tether (ERC-20)</option>';
    if (CONFIG.btcAddr)  tokenOpts += '<option value="BTC">BTC — Bitcoin (Exodus only)</option>';
    if (CONFIG.xrpAddr)  tokenOpts += '<option value="XRP">XRP — XRP Ledger (Exodus only)</option>';

    if (!tokenOpts) {
      console.warn('[TipCryp] No wallet addresses configured.');
      tokenOpts = '<option value="" disabled>No wallets configured</option>';
    }

    return '<div id="tcm-widget-fab">' +

      '<div id="tcm-panel" aria-label="TipCryp donation widget" role="dialog">' +

        '<div id="tcm-panel-head">' +
          '<div>' +
            '<div id="tcm-panel-title">Tip ' + escHtml(CONFIG.creator) + '</div>' +
            '<div id="tcm-panel-sub">Crypto goes directly to their wallet</div>' +
          '</div>' +
          '<button id="tcm-close-btn" onclick="window.__TipCryp.close()" aria-label="Close">&#x2715;</button>' +
        '</div>' +

        '<div id="tcm-panel-body">' +

          // ① Wallet connect
          '<div>' +
            '<span class="tcm-label">&#9312; Connect Wallet</span>' +
            '<div class="tcm-wallet-grid">' +
              _walletBtn('metamask', 'MetaMask',  _svgMetaMask()) +
              _walletBtn('coinbase', 'Coinbase',  _svgCoinbase()) +
              _walletBtn('rabby',    'Rabby',     _svgRabby()) +
              _walletBtn('exodus',   'Exodus',    _svgExodus()) +
            '</div>' +
            '<div class="tcm-connected-bar" id="tcm-conn-bar">' +
              '<div class="tcm-pulse"></div>' +
              '<span class="tcm-conn-name" id="tcm-conn-name"></span>' +
              '<span class="tcm-conn-addr" id="tcm-conn-addr"></span>' +
              '<button class="tcm-disc-btn" onclick="window.__TipCryp.disconnect()">Disconnect</button>' +
            '</div>' +
          '</div>' +

          '<hr class="tcm-divider"/>' +

          // ② Token select
          '<div>' +
            '<label class="tcm-label" for="tcm-token-select">&#9313; Select Token</label>' +
            '<div class="tcm-select-wrap">' +
              '<select id="tcm-token-select" class="tcm-select" onchange="window.__TipCryp.onTokenChange()">' +
                '<option value="" disabled selected>— Choose Token —</option>' +
                tokenOpts +
              '</select>' +
            '</div>' +
          '</div>' +

          '<hr class="tcm-divider"/>' +

          // ③ Destination address + QR
          '<div>' +
            '<span class="tcm-label">&#9314; Destination — Creator Wallet</span>' +
            '<div class="tcm-addr-box" id="tcm-addr-box">Select a token to see address</div>' +
            '<div id="tcm-addr-meta" style="display:none;margin-top:5px;align-items:center;gap:6px;font-family:monospace;font-size:.62rem;">' +
              '<span style="width:5px;height:5px;border-radius:50%;background:#4ade80;flex-shrink:0;"></span>' +
              '<span id="tcm-addr-net" style="color:#4ade80;"></span>' +
              '<span id="tcm-addr-explorer" style="margin-left:auto;"></span>' +
            '</div>' +
            '<div class="tcm-qr-wrap" style="margin-top:10px;">' +
              '<div id="tcm-qr-container"><p style="font-family:monospace;font-size:.62rem;color:#334155;text-align:center;padding:20px 0;">Select a token to see QR</p></div>' +
              '<div class="tcm-qr-label" id="tcm-qr-label">—</div>' +
            '</div>' +
          '</div>' +

          '<hr class="tcm-divider"/>' +

          // ④ Amount
          '<div>' +
            '<label class="tcm-label" for="tcm-amount-input">&#9315; Amount</label>' +
            '<div class="tcm-amount-wrap">' +
              '<input type="number" id="tcm-amount-input" min="0" step="any" placeholder="0.00" oninput="window.__TipCryp.onAmountInput()"/>' +
              '<span class="tcm-amount-unit" id="tcm-amount-unit">—</span>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;margin-top:5px;font-family:monospace;font-size:.7rem;">' +
              '<span style="color:#22d3ee;" id="tcm-usd-val">≈ $0 USD</span>' +
              '<span style="color:#475569;" id="tcm-fee-label">&#9981; Network fee varies</span>' +
            '</div>' +
            '<div id="tcm-quick-amts" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;"></div>' +
          '</div>' +

          // Send button
          '<button class="tcm-send-btn" id="tcm-send-btn" onclick="window.__TipCryp.send()">&#10230; SEND TIP</button>' +

          // TX result
          '<div class="tcm-tx-result" id="tcm-tx-result">' +
            '<div class="tcm-tx-ok"><span>&#10003;</span><span>Tip Sent — Thank you!</span></div>' +
            '<div class="tcm-tx-rows">' +
              '<div>Token: <span id="tcm-tx-token"></span></div>' +
              '<div>Amount: <span id="tcm-tx-amount"></span></div>' +
              '<div>TX: <a id="tcm-tx-link" href="#" target="_blank" rel="noopener noreferrer"></a></div>' +
            '</div>' +
          '</div>' +

          // Zero-fee badge
          '<div class="tcm-zero-fee">' +
            '<span class="tcm-zero-fee-icon">&#9672;</span>' +
            '<span class="tcm-zero-fee-text">100% direct to creator &middot; Zero platform fees &middot; Powered by <span class="tcm-zero-fee-brand">Tipcryp.me</span></span>' +
          '</div>' +

        '</div>' +
      '</div>' +

      // FAB trigger button
      '<button id="tcm-trigger-btn" onclick="window.__TipCryp.toggle()" aria-label="Send a crypto tip" aria-expanded="false">' +
        '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>' +
      '</button>' +

      // Wallet install modal
      '<div class="tcm-modal-ov" id="tcm-modal">' +
        '<div class="tcm-modal">' +
          '<div class="tcm-modal-head">' +
            '<h3 id="tcm-modal-title">Wallet Info</h3>' +
            '<button class="tcm-modal-x" onclick="window.__TipCryp.closeModal()">&#x2715;</button>' +
          '</div>' +
          '<div class="tcm-modal-body" id="tcm-modal-body"></div>' +
          '<div class="tcm-modal-note" id="tcm-modal-note"></div>' +
        '</div>' +
      '</div>' +

      '<div id="tcm-toast"></div>' +

    '</div>';
  }

  function _walletBtn(id, name, svgHtml) {
    return '<button class="tcm-wallet-btn" id="tcm-btn-' + id + '" onclick="window.__TipCryp.connect(\'' + id + '\')" aria-label="Connect ' + name + '">' +
      svgHtml +
      '<span class="tcm-wname">' + name + '</span>' +
      '<span class="tcm-wdot"></span>' +
    '</button>';
  }

  function _svgMetaMask() {
    return '<svg viewBox="0 0 35 33" xmlns="http://www.w3.org/2000/svg"><polygon fill="#e2761b" stroke="#e2761b" stroke-linecap="round" stroke-linejoin="round" points="32.958,0.5 19.184,10.178 21.681,4.136"/><polygon fill="#e4761b" stroke="#e4761b" stroke-linecap="round" stroke-linejoin="round" points="2.042,0.5 15.704,10.274 13.319,4.136"/><polygon fill="#e4761b" stroke="#e4761b" stroke-linecap="round" stroke-linejoin="round" points="27.893,23.61 24.178,29.291 32.186,31.483 34.467,23.736"/><polygon fill="#e4761b" stroke="#e4761b" stroke-linecap="round" stroke-linejoin="round" points="0.533,23.736 2.814,31.483 10.822,29.291 7.107,23.61"/><polygon fill="#d7c1b3" stroke="#d7c1b3" stroke-linecap="round" stroke-linejoin="round" points="10.822,29.291 15.641,26.968 11.448,23.791"/><polygon fill="#d7c1b3" stroke="#d7c1b3" stroke-linecap="round" stroke-linejoin="round" points="19.359,26.968 24.178,29.291 23.552,23.791"/><polygon fill="#f6851b" stroke="#f6851b" stroke-linecap="round" stroke-linejoin="round" points="22.753,22.977 19.745,30.111 24.178,29.291"/><polygon fill="#f6851b" stroke="#f6851b" stroke-linecap="round" stroke-linejoin="round" points="12.247,22.977 15.255,30.111 18.546,22.591"/></svg>';
  }
  function _svgCoinbase() {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="92" height="92" rx="20" fill="#1652f0"/><rect x="22" y="22" width="56" height="56" rx="10" fill="#fff"/><rect x="36" y="42" width="28" height="16" rx="5" fill="#1652f0"/></svg>';
  }
  function _svgRabby() {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="92" height="92" rx="20" fill="#8583FF"/><ellipse cx="50" cy="58" rx="27" ry="19" fill="#fff"/><ellipse cx="50" cy="36" rx="20" ry="16" fill="#fff"/><circle cx="40" cy="38" r="5" fill="#8583FF"/><circle cx="60" cy="38" r="5" fill="#8583FF"/><circle cx="40" cy="38" r="2.5" fill="#fff"/><circle cx="60" cy="38" r="2.5" fill="#fff"/></svg>';
  }
  function _svgExodus() {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="92" height="92" rx="20" fill="#0D0D1A"/><polygon points="50,12 88,75 12,75" fill="none" stroke="#00D4AA" stroke-width="6" stroke-linejoin="round"/><polygon points="50,28 76,72 24,72" fill="#00D4AA" opacity="0.18"/><circle cx="50" cy="52" r="11" fill="#00D4AA"/><circle cx="50" cy="52" r="5" fill="#0D0D1A"/></svg>';
  }

  // ══════════════════════════════════════════════
  // WALLET CONNECT
  // ══════════════════════════════════════════════
  var WALLET_INSTALL = {
    metamask: { url:'https://metamask.io', note:'MetaMask is a browser extension wallet for ETH & ERC-20 tokens.' },
    coinbase:  { url:'https://www.coinbase.com/wallet', note:'Coinbase Wallet supports ETH & ERC-20 tokens.' },
    rabby:     { url:'https://rabby.io', note:'Rabby is a multi-chain browser extension wallet.' },
    exodus:    { url:'https://www.exodus.com', note:'Exodus supports BTC, ETH, XRP, and 250+ assets.' },
  };

  function setConnected(account, walletName) {
    state.connected  = true;
    state.account    = account;
    var bar  = el('tcm-conn-bar');
    var name = el('tcm-conn-name');
    var addr = el('tcm-conn-addr');
    if (bar)  bar.classList.add('show');
    if (name) name.textContent = walletName;
    if (addr) addr.textContent = account.slice(0,6) + '…' + account.slice(-4);
    ['metamask','coinbase','rabby','exodus'].forEach(function(id) {
      var b = el('tcm-btn-' + id);
      if (b) b.classList.toggle('tcm-connected', id === state.providerType);
    });
    toast('Connected: ' + walletName, 'success');
  }

  var API = {
    toggle: function () {
      var panel = el('tcm-panel');
      var btn   = el('tcm-trigger-btn');
      if (!panel) return;
      state.open = !state.open;
      panel.classList.toggle('open', state.open);
      if (btn) btn.setAttribute('aria-expanded', state.open);
    },
    close: function () {
      var panel = el('tcm-panel');
      var btn   = el('tcm-trigger-btn');
      if (panel) panel.classList.remove('open');
      if (btn)   btn.setAttribute('aria-expanded', 'false');
      state.open = false;
    },
    closeModal: function () {
      var m = el('tcm-modal');
      if (m) m.classList.remove('show');
    },

    connect: async function (type) {
      var providers = {
        metamask: w.ethereum && !w.ethereum.isCoinbaseWallet ? w.ethereum : null,
        coinbase:  w.ethereum && w.ethereum.isCoinbaseWallet  ? w.ethereum : (w.coinbaseWalletExtension || null),
        rabby:     w.ethereum && w.ethereum.isRabby            ? w.ethereum : null,
        exodus:    w.exodus   ? w.exodus.ethereum : null,
      };

      var provider = providers[type];

      if (!provider) {
        var info = WALLET_INSTALL[type] || {};
        var modal = el('tcm-modal');
        var title = el('tcm-modal-title');
        var body  = el('tcm-modal-body');
        var note  = el('tcm-modal-note');
        if (title) title.textContent = (WALLET_NAMES[type] || type) + ' Not Found';
        if (body)  body.innerHTML = WALLET_NAMES[type] + ' extension is not installed.<br><a href="' + (info.url||'#') + '" target="_blank" rel="noopener noreferrer" style="color:#22d3ee;">Install ' + WALLET_NAMES[type] + ' →</a>';
        if (note)  note.textContent = info.note || '';
        if (modal) modal.classList.add('show');
        return;
      }

      try {
        state.providerType = type;
        state.provider     = provider;
        var accs = await provider.request({ method:'eth_requestAccounts' });
        if (!accs || !accs.length) { toast('No accounts found.','error'); return; }
        setConnected(accs[0], WALLET_NAMES[type]);

        provider.on('accountsChanged', function(accs) {
          if (!accs.length) API.disconnect();
          else setConnected(accs[0], WALLET_NAMES[type]);
        });
        provider.on('chainChanged', function () { w.location.reload(); });

      } catch (err) {
        if (err.code === 4001) toast('Connection cancelled.', 'error');
        else toast('Error: ' + err.message, 'error');
      }
    },

    disconnect: function () {
      state.connected  = false;
      state.account    = null;
      state.provider   = null;
      state.providerType = null;
      var bar = el('tcm-conn-bar');
      if (bar) bar.classList.remove('show');
      ['metamask','coinbase','rabby','exodus'].forEach(function(id) {
        var b = el('tcm-btn-' + id);
        if (b) b.classList.remove('tcm-connected');
      });
      toast('Wallet disconnected.', 'info');
    },

    onTokenChange: function () {
      var tokenSel = el('tcm-token-select');
      if (!tokenSel) return;
      var token = tokenSel.value;
      if (!token) return;
      state.token = token;
      el('tcm-amount-unit').textContent = token;
      showAddress(token);
      updateQuickAmts(token);
      refreshUSD();
      var fees = { ETH:'&#9981; ~$1–3 gas', USDT:'&#9981; ~$2–5 ERC-20 gas', BTC:'&#9981; ~$0.50–2', XRP:'&#9981; ~$0.001' };
      var feeEl = el('tcm-fee-label');
      if (feeEl) feeEl.innerHTML = fees[token] || '&#9981; Network fee varies';

      // Show address meta
      var meta = el('tcm-addr-meta');
      var netEl = el('tcm-addr-net');
      var expEl = el('tcm-addr-explorer');
      if (meta) meta.style.display = 'flex';
      if (netEl) netEl.textContent = NETS[token] || '';
      if (expEl) {
        expEl.innerHTML = EXPLORERS[token]
          ? '<a href="' + EXPLORERS[token] + '" target="_blank" rel="noopener noreferrer" style="color:#22d3ee;font-size:.6rem;text-decoration:none;">View on Explorer ↗</a>'
          : '';
      }
    },

    onAmountInput: function () { refreshUSD(); },

    _setAmt: function(v) {
      var inp = el('tcm-amount-input');
      if (inp) { inp.value = v; refreshUSD(); }
    },

    send: async function () {
      if (state.txPending) { toast('Transaction in progress. Please wait.', 'error'); return; }

      var token  = el('tcm-token-select').value;
      var amount = parseFloat(el('tcm-amount-input').value);
      var toAddr = ADDRS[token];

      if (!state.connected) { toast('Please connect a wallet first.', 'error'); return; }
      if (!token)            { toast('Please select a token.', 'error'); return; }
      if (!toAddr)           { toast('No wallet address configured for ' + token, 'error'); return; }
      if (!amount || amount <= 0) { toast('Please enter an amount.', 'error'); return; }

      // Exodus / BTC / XRP — deep-link URI
      if (state.providerType === 'exodus' || token === 'BTC' || token === 'XRP') {
        var uris = {
          BTC:  'bitcoin:'  + toAddr + '?amount=' + amount,
          ETH:  'ethereum:' + toAddr + '?value='  + amount,
          USDT: 'ethereum:' + toAddr + '?value='  + amount,
          XRP:  'xrpl:'     + toAddr + '?amount=' + amount,
        };
        w.location.href = uris[token] || '#';
        toast('Opening wallet app — confirm tip inside.', 'info', 6000);
        return;
      }

      // ETH on-chain
      if (token === 'ETH') {
        try {
          state.txPending = true;
          toast('Confirm the tip in your wallet…', 'info', 12000);
          var weiHex = '0x' + BigInt(Math.round(amount * 1e18)).toString(16);
          var txHash = await state.provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: state.account, to: toAddr, value: weiHex }],
          });
          state.txPending = false;
          API._showTxResult('ETH', amount, txHash);
        } catch (err) {
          state.txPending = false;
          if (err.code === 4001) toast('Transaction cancelled.', 'error');
          else toast('TX failed: ' + err.message, 'error');
        }
        return;
      }

      // USDT ERC-20
      if (token === 'USDT') {
        try {
          state.txPending = true;
          toast('Confirm the USDT tip in your wallet…', 'info', 12000);
          var units     = BigInt(Math.round(amount * 1e6));
          var paddedTo  = toAddr.replace('0x','').toLowerCase().padStart(64,'0');
          var paddedAmt = units.toString(16).padStart(64,'0');
          var data      = '0xa9059cbb' + paddedTo + paddedAmt;
          var txHash    = await state.provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: state.account, to: USDT_CONTRACT, data: data }],
          });
          state.txPending = false;
          API._showTxResult('USDT', amount, txHash);
        } catch (err) {
          state.txPending = false;
          if (err.code === 4001) toast('Transaction cancelled.', 'error');
          else toast('TX failed: ' + err.message, 'error');
        }
      }
    },

    _showTxResult: function (token, amount, txHash) {
      var res = el('tcm-tx-result');
      if (res) res.classList.add('show');
      var tkEl = el('tcm-tx-token');   if (tkEl) tkEl.textContent  = token;
      var amEl = el('tcm-tx-amount');  if (amEl) amEl.textContent  = amount + ' ' + token;
      var link = el('tcm-tx-link');
      if (link) {
        link.textContent = txHash.slice(0,20) + '…';
        link.href = 'https://etherscan.io/tx/' + txHash;
      }
      toast('Tip sent! Thank you for supporting ' + escHtml(CONFIG.creator), 'success', 6000);
    },
  };

  // ══════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════
  function init() {
    var style = d.createElement('style');
    style.id  = 'tcm-widget-styles';
    style.textContent = CSS;
    d.head.appendChild(style);

    var wrapper = d.createElement('div');
    wrapper.id  = 'tcm-widget-root';
    wrapper.innerHTML = buildHTML();
    d.body.appendChild(wrapper);

    // Set default token
    var tokenSel = el('tcm-token-select');
    if (tokenSel && CONFIG.currency) {
      Array.from(tokenSel.options).forEach(function(opt) {
        if (opt.value === CONFIG.currency) opt.selected = true;
      });
      API.onTokenChange();
    }

    w.__TipCryp = API;

    var modal = el('tcm-modal');
    if (modal) modal.addEventListener('click', function(e) {
      if (e.target === modal) API.closeModal();
    });

    fetchPrices();
    setInterval(fetchPrices, 60000);

    console.log('%c TipCryp Widget v1.1.0 loaded', 'color:#22d3ee;font-weight:bold;');
    console.log('%c Creator: ' + CONFIG.creator + ' | Key: ' + CONFIG.apiKey.slice(0,12) + '...', 'color:#64748b;');
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window, document));
