# Apex Capital Funded

Simulated funded-trading platform for Indian markets (placeholder brand name).

- **Web:** Next.js (App Router, TypeScript)
- **Database and login:** Supabase project `prop-f`
- **Prices:** behind `lib/market/source.ts` (demo today, Zerodha Kite Connect planned)
- **Trading engine:** to be built as a separate always-on service; it is the only writer of orders, fills and rewards

## Run locally

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

## Layout

| Path | What |
| --- | --- |
| `app/` | Pages. The home page reads plans and prices from Supabase. |
| `public/prototype/` | Full site and F&O terminal designs, being ported into `app/`. |
| `lib/supabase/` | `public` (anonymous), `server` (trader session), `admin` (service role, server only). |
| `lib/market/` | Price-source interface, demo source, Zerodha adapter stub, F&O contract config. |
| `supabase/` | Migrations and seed data. Traders can read only their own rows and cannot write trading tables. |

## Before launch

- Confirm lot sizes and expiry rules in `lib/market/fno.ts` against NSE/BSE circulars.
- Kite Connect terms prohibit mock-trading apps and public display of live data. Confirm in writing with Zerodha, or move to a licensed data vendor.
- Get a securities lawyer's opinion on the simulated-account and rewards model (SEBI advisory of 4 Nov 2024 on virtual trading platforms).
- Never commit `SUPABASE_SERVICE_ROLE_KEY`, `KITE_API_SECRET` or any `.env*.local` file.
