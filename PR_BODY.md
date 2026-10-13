# Pull Request Description

## Summary

This PR makes the repository runnable in a free/local environment by providing a SQLite fallback for the DB and adding a simple wallet registration endpoint for testing without Telegram auth or Postgres. It also adds a `.env.example` for local development.

Main goals:
- Allow running the app locally without a Postgres server.
- Provide an easy way to register wallets for local testing via POST `/api/wallets`.
- Keep existing Postgres + provider/webhook behavior intact when `DATABASE_URL` is provided.
- Provide a minimal `.env.example` with sensible defaults for local usage.

## What I changed

- Add SQLite fallback and local initialization when `DATABASE_URL` is not provided (`lib/db/index.ts`).
- Make DB schema aware of SQLite where necessary (`lib/db/schema.ts`).
- Add a minimal API route to register wallets for local testing: `POST /api/wallets` (`app/api/wallets/route.ts`).
- Add `.env.example` with defaults oriented to a free/local setup.
- (Branch) `fix/monitoring-save-wallets`

## Files touched (high level)

- `lib/db/index.ts` — SQLite fallback + initialization
- `lib/db/schema.ts` — schema tweaks to support SQLite fallback
- `app/api/wallets/route.ts` — new endpoint to register wallets (useful for local/dev)
- `.env.example` — environment file template for local dev

> Note: The repo retains Postgres support; if you set `DATABASE_URL` to a Postgres connection string the app will continue to use Postgres as before.

## How to test (local)

1. Checkout the branch:
   - `git fetch origin`
   - `git checkout fix/monitoring-save-wallets`

2. Install:
   - `pnpm install`

3. Create `.env` from example:
   - `cp .env.example .env`
   - (Edit `.env` if desired; default uses SQLite at `./wallet-watch.db`)

4. Start dev server:
   - `pnpm dev`

5. Optional: seed demo data (local)
   - In `.env` set:
     - `ALLOW_DEMO_SEED=true`
     - `NODE_ENV=development`
   - `pnpm db:seed:demo`

6. Register a wallet (example):
   - ```bash
     curl -v -X POST http://localhost:3000/api/wallets \
       -H "Content-Type: application/json" \
       -d '{"telegramChatId":"demo-ui-seed-user","blockchain":"STELLAR","walletAddress":"GBDZ5E7ENT5T3SUKGAU5KEVFGUKWIGKQFH45EZV4IRUHPYVI6Y7PTELI"}'
     ```

7. Trigger cron scanner manually (example):
   - Set `CRON_SECRET` in `.env`
   - `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/scan-wallets`

## Notes / Limitations

- `fetchLatestTransaction` (`lib/blockchain/providers.ts`) requires provider API keys (`ALCHEMY_API_KEY`, `HELIUS_API_KEY`, etc.) to fetch real transactions. Without those keys the cron scanner will throw errors for networks that require keys.
- Telegram alerts require `TELEGRAM_BOT_TOKEN` and valid users/chat ids to send messages.
- Provider webhook registration (Alchemy Notify) is best-effort and optional; the cron scanner is the fallback.
- Please review the added code for style/typing adjustments if you prefer Prisma or other conventions.

## Rollout / Migration
No DB migration is required for local SQLite usage. When switching to production Postgres, ensure `DATABASE_URL` points to your Postgres instance and apply any migrations as needed.

---

If you want I can also add more robust polling/dedup logic, retry/backoff, or add a small e2e test for the registration + cron flow before merging.
