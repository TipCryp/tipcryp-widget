# TipCryp Widget

> Embeddable crypto tipping widget for streamers and creators.  
> Tips go **directly to your wallet** — zero platform fees.

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-22d3ee.svg)]()
[![Platform](https://img.shields.io/badge/tipcryp.me-live-4ade80.svg)](https://tipcryp.me)

---

## What's included

| File | Description |
|---|---|
| `widget.js` | The embeddable tipping widget — drop one `<script>` tag on any site |
| `api-key.html` | Creator Dashboard — registration, payment, API key issuance |

---

## Quick Start

### 1. Get your API key
Visit [tipcryp.me/api-key.html](https://tipcryp.me/api-key.html), register, and pay $100/year (or hold 2,500 $TCM for free access).

### 2. Add the widget to your site
Paste this snippet before `</body>` on any page:

```html
<script src="https://tipcryp.me/widget.js"
        data-key="tcm_your_api_key_here"
        data-creator="your-name"
        data-wallet-eth="0xYourEthAddress"
        data-wallet-btc="bc1qYourBtcAddress"
        data-wallet-xrp="rYourXrpAddress"
        data-theme="dark"
        data-position="right">
</script>
```

That's it. A floating tip button appears in the corner — no backend required.

---

## Configuration

| Attribute | Required | Default | Description |
|---|---|---|---|
| `data-key` | ✅ | — | Your API key (`tcm_...`) |
| `data-creator` | ✅ | `Creator` | Your display name |
| `data-wallet-eth` | ⚠️ | — | ETH/USDT wallet address (EVM) |
| `data-wallet-btc` | ⚠️ | — | Bitcoin wallet address |
| `data-wallet-xrp` | ⚠️ | — | XRP Ledger address |
| `data-theme` | ❌ | `dark` | `dark` only (light coming soon) |
| `data-position` | ❌ | `right` | `right` or `left` |
| `data-currency` | ❌ | `ETH` | Default selected token |

> ⚠️ At least one wallet address is required. Configure only the tokens you want to accept.

---

## Supported Tokens

| Token | Network | Wallet Support |
|---|---|---|
| ETH | Ethereum Mainnet | MetaMask, Coinbase, Rabby, Exodus |
| USDT | Ethereum Mainnet (ERC-20) | MetaMask, Coinbase, Rabby, Exodus |
| BTC | Bitcoin Mainnet | **Exodus only** |
| XRP | XRP Ledger | **Exodus only** |

---

## Features

- ✅ Zero platform commission — 100% goes to your wallet
- ✅ QR code auto-generates for each token (great for stream overlays)
- ✅ Live USD price conversion
- ✅ MetaMask, Coinbase Wallet, Rabby, Exodus support
- ✅ One script tag — no npm, no build step
- ✅ Phishing & clickjacking protection built in
- ✅ Mobile friendly

---

## Access Plans

| Plan | Price | Details |
|---|---|---|
| Creator Pass | $100 / year | Annual licence, unlimited usage |
| $TCM Holder | Free (permanent) | Hold 2,500 [$TCM](https://tipcryp.io) — tokens are yours to keep |

---

## Changelog

### v1.1.0
- Added QR code for destination wallet (updates on token change)
- Removed Creator Payout Mode toggle
- BTC / XRP labelled "(Exodus only)" in token dropdown
- Send Tip button: theme cyan with black text
- Bottom bar: white text, "Tipcryp.me" in cyan
- Creator Dashboard: registration form moved to left, payment console to right

### v1.0.0
- Initial release

---

## Security

- API keys validated client-side (`tcm_[a-z0-9_]{20,}`)
- Iframe / clickjacking blocked
- Domain phishing guard (page self-destructs on unknown domains)
- Blind-signing TX guard with toast warnings
- Link integrity guard for external URLs
- postMessage origin whitelist
- CSP headers: OWASP Top 10 2025, Mozilla Observatory A+

> ⚠️ **Never commit your API key to a public repository.**

---

## License

MIT — see [LICENSE](LICENSE)

---

## Links

- 🌐 [tipcryp.me](https://tipcryp.me)
- 💬 [Telegram Community](https://t.me/+WtbDPLuRTLE4NTQx)
- 💰 [$TCM ICO](https://tipcryp.io)
