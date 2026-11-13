# Build contract (three parallel workstreams)

Repo: Next.js 16 App Router, React 19, TypeScript strict, Supabase (project `prop-f`, id `iqlrbjaflgmynjpkelcj`).
Verify framework APIs against the INSTALLED versions (Next 16 changed several things, e.g. async `cookies()`, and `middleware` was renamed `proxy`). Read `node_modules/next/dist/docs` or the installed types if unsure.

Shared files already written (do not redefine): `lib/types.ts`, `lib/supabase/{public,server,admin,browser}.ts`, `lib/market/{source,demo,zerodha,fno}.ts`, `supabase/migrations/*`.
Read `public/prototype/site.html` and `public/prototype/terminal.html`: they are the approved designs (premium dark glassmorphism, gold accent, light/dark tokens, Space Grotesk / Inter / JetBrains Mono). Port them faithfully; keep the look.

## Ownership (edit ONLY your own files)

| Stream | Owns |
| --- | --- |
| A Site + auth | `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/checkout/**`, `app/login/**`, `app/signup/**`, `app/auth/**`, `proxy.ts` (session refresh), `components/site/**` |
| B Dashboard + terminal | `app/dashboard/**`, `app/terminal/**`, `components/trading/**` |
| C Engine | `lib/market/pricing.ts`, `lib/market/server-feed.ts`, `lib/engine/**`, `app/api/**`, `supabase/migrations/*` (NEW files only), `package.json` (only to add devDependencies for tests) |

Do not run git. Do not run `npm run build` (the lead builds at the end, concurrent builds clash). Check types with `npx tsc --noEmit`. Do not edit `.env*`. Never put the service role key in client code.

## Database (already live, read `supabase/migrations/20261110000000_core_schema.sql`)
Traders can only SELECT their own rows (RLS). Only the service role writes orders, positions, trades, equity_snapshots, rewards, trading_accounts, purchases. `orders/positions/trades.instrument` stores `instrumentKey(ref)` from `lib/types.ts`.
Money in rupees, `qty` in units.

## `lib/market/pricing.ts` (stream C writes it; B imports it for display, exact signatures)
```ts
export const EXPIRIES: Record<string, string[]>;           // underlying -> YYYY-MM-DD list (index F&O only)
export function lotSize(underlying: string): number;        // NIFTY 65, BANKNIFTY 30, SENSEX 20, stocks 1
export function strikeStep(underlying: string): number;     // 50 / 100 / 100
export function priceInstrument(ref: InstrumentRef, spot: number, now?: number): number; // EQ=spot, FUT=spot+small basis, CE/PE=Black-Scholes
export function optionGreeks(ref: InstrumentRef, spot: number, now?: number): { iv: number; delta: number };
export function marginRequired(ref: InstrumentRef, side: Side, qty: number, price: number, spot: number): number;
```
Use the same math as `public/prototype/terminal.html` (Black-Scholes r=6.5%, skewed IV, EQ margin = notional/5, FUT and short options 12% of spot*qty, long options full premium).

## HTTP API (stream C implements, B and A call it; all JSON, user session via cookies)
- `GET /api/quotes?symbols=A,B` -> `QuotesResponse` (public, no auth). Server-authoritative prices from `PriceSource`.
- `POST /api/orders` body `PlaceOrderRequest` -> `ApiResult<{ orderId: string; status: "filled" | "pending"; fillPrice?: number }>`. Market fills immediately at the server's price. Limit/Stop rest as pending and are filled by the tick job when price crosses.
- `POST /api/orders/cancel` body `CancelOrderRequest` -> `ApiResult`.
- `POST /api/positions/close` body `ClosePositionRequest` -> `ApiResult`.
- `POST /api/positions/close-all` body `CloseAllRequest` -> `ApiResult`.
- `POST /api/checkout` body `CheckoutRequest` -> `ApiResult<CheckoutResponse>`. Dev mode only: creates a purchase with status `paid` and gateway_ref `dev` plus the trading account (balance = account_size). Price is looked up from `plan_prices`, never taken from the client. A payment gateway replaces this later.
- `POST /api/engine/tick` (header `x-engine-secret` must equal env `ENGINE_SECRET`) fills crossed pending orders and runs risk checks for all active accounts. Also invoked opportunistically after every order/quote call.

Client never sends a price it expects to fill at. All checks happen server-side: account belongs to the user and is `active`, qty > 0 and a lot multiple for F&O, margin available, instrument/expiry valid, daily loss and overall loss limits from the account's plan. Breach => squares off all positions at server prices, sets `status='breached'` and `breach_reason`.

## Page behaviour
- A: public pages work logged out. `/checkout` needs login (redirect to `/login?next=/checkout`). After a successful `/api/checkout`, go to `/dashboard`. Email + password sign up and login with Supabase Auth; `/auth/callback` handles email confirmation; sign-out route.
- B: `/dashboard` and `/terminal` are server components that redirect to `/login` when there is no user. Read accounts, positions, orders, trades, equity snapshots with the user's session client. Trading actions go through the HTTP API only. Candles are built in the browser from `/api/quotes` ticks for the session; never store or cache price history in the database (data vendor terms).
- Copy rules: say "simulated" where a buyer decides (plan cards, checkout, terminal header, footer). Never claim SEBI approval, registration or that this is a broker. No fake payouts, testimonials or counts; keep "To add" placeholder slots for trust items. "Rewards" is the word for payouts, 80/20 split. Most participants do not earn rewards.
