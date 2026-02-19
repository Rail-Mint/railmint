# Real Wallet E2E (Synpress + Playwright)

This suite validates real MetaMask connection flows for Studio routes.

## 1) Install dependencies

```bash
npm install
npx playwright install chromium
```

## 2) Configure wallet env

```bash
cp .env.wallet.example .env.wallet
```

Export vars from `.env.wallet` in your shell before running tests.

## 3) Build wallet cache (deterministic seed)

```bash
npm run e2e:wallet:cache
```

## 4) Run tests

Local chain mode (recommended for CI/local reliability):

```bash
npm run e2e:wallet:local
```

Testnet mode:

```bash
npm run e2e:wallet:testnet
```

Headless mode:

```bash
npm run e2e:wallet:headless
```

## Notes

- Wallet setup file: `test/wallet-setup/basic.setup.ts`
- Wallet Playwright config: `playwright.wallet.config.ts`
- Wallet specs: `tests/wallet/*.spec.ts`
- Synpress cache directory: `.cache-synpress/`
