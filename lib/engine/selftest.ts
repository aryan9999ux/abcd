// Run: npx tsx lib/engine/selftest.ts
import assert from "node:assert/strict";
import {
  classifyOrder, directionOf, marketOpen, drawdownFloor, evaluateRisk, pastEntryCutoff, payoutCheck, profitableDays, riskAmount, stopOnCorrectSide, hasMargin, increasingQty, isTriggered, netFill, unrealized, validateInstrument,
} from "./pure";
import { marginRequired, priceOf, type ContractSpec } from "../market/pricing";
import { greeks } from "../market/greeks";
import { buildStore, parseInstruments } from "../market/instruments";
import { toTick } from "../market/zerodha";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok  " + name); };

t("open then average up", () => {
  const a = netFill(null, "Buy", 65, 100);
  assert.deepEqual(a.next, { side: "Buy", qty: 65, avg: 100 });
  const b = netFill(a.next, "Buy", 65, 110);
  assert.deepEqual(b.next, { side: "Buy", qty: 130, avg: 105 });
  assert.equal(b.realized, 0);
});
t("partial close realizes pnl, keeps avg", () => {
  const r = netFill({ side: "Buy", qty: 100, avg: 100 }, "Sell", 40, 110);
  assert.deepEqual(r.next, { side: "Buy", qty: 60, avg: 100 });
  assert.equal(r.realized, 400);
});
t("full close of a short", () => {
  const r = netFill({ side: "Sell", qty: 30, avg: 200 }, "Buy", 30, 190);
  assert.equal(r.next, null);
  assert.equal(r.realized, 300);
});
t("flip long to short", () => {
  const r = netFill({ side: "Buy", qty: 10, avg: 100 }, "Sell", 25, 90);
  assert.equal(r.realized, -100);
  assert.deepEqual(r.next, { side: "Sell", qty: 15, avg: 90 });
});
t("unrealized sign", () => {
  assert.equal(unrealized({ side: "Sell", qty: 10, avg: 100 }, 95), 50);
  assert.equal(unrealized({ side: "Buy", qty: 10, avg: 100 }, 95), -50);
});
t("increasing qty", () => {
  assert.equal(increasingQty(null, "Buy", 5), 5);
  assert.equal(increasingQty({ side: "Buy", qty: 10, avg: 1 }, "Sell", 4), 0);
  assert.equal(increasingQty({ side: "Buy", qty: 10, avg: 1 }, "Sell", 25), 15);
});
t("order classification", () => {
  assert.equal(classifyOrder("Market", "Buy", undefined, 100), "fill");
  assert.equal(classifyOrder("Limit", "Buy", 99, 100), "pending");
  assert.equal(classifyOrder("Limit", "Buy", 101, 100), "fill");
  assert.equal(classifyOrder("Limit", "Sell", 101, 100), "pending");
  assert.equal(classifyOrder("Stop", "Buy", 101, 100), "pending");
  assert.equal(classifyOrder("Stop", "Buy", 99, 100), "invalid");
  assert.equal(classifyOrder("Stop", "Sell", 99, 100), "pending");
  assert.equal(classifyOrder("Limit", "Buy", undefined, 100), "invalid");
});
t("triggers", () => {
  assert.equal(isTriggered("Limit", "Buy", 99, 98.9), true);
  assert.equal(isTriggered("Limit", "Buy", 99, 99.5), false);
  assert.equal(isTriggered("Stop", "Sell", 99, 98.9), true);
  assert.equal(isTriggered("Stop", "Buy", 101, 100.5), false);
});
t("risk limits (static)", () => {
  const base = { accountSize: 100000, dayStartEquity: 100000, dailyLossPct: 4, drawdownPct: 8, drawdownType: "static" as const, peakEod: 100000 };
  assert.equal(evaluateRisk({ ...base, equity: 98000 }).breach, null);
  assert.equal(evaluateRisk({ ...base, equity: 96000 }).breach, "daily_loss_limit");
  assert.equal(evaluateRisk({ ...base, equity: 92000 }).breach, "overall_loss_limit");
  assert.equal(Math.round(evaluateRisk({ ...base, equity: 96000 }).overallUsedPct), 50);
  assert.equal(evaluateRisk({ ...base, dayStartEquity: 110000, equity: 105000 }).breach, "daily_loss_limit");
  assert.equal(drawdownFloor({ ...base, peakEod: 130000 }), 92000); // static ignores the peak
});
t("trailing drawdown floor", () => {
  const b = { accountSize: 1000000, drawdownPct: 10, drawdownType: "trailing" as const };
  assert.equal(drawdownFloor({ ...b, peakEod: 1000000 }), 900000);
  assert.equal(drawdownFloor({ ...b, peakEod: 1050000 }), 950000);
  assert.equal(drawdownFloor({ ...b, peakEod: 1100000 }), 1000000); // locks at the start
  assert.equal(drawdownFloor({ ...b, peakEod: 1300000 }), 1000000); // and stays there
});
t("entry cutoff, direction, stop side", () => {
  const ist = (h: number, m: number) => Date.UTC(2026, 10, 16, h, m) - 330 * 60 * 1000;
  assert.equal(pastEntryCutoff(ist(15, 14), "15:15"), false);
  assert.equal(pastEntryCutoff(ist(15, 15), "15:15"), true);
  assert.equal(directionOf("CE", "Buy"), "long");
  assert.equal(directionOf("PE", "Buy"), "short");
  assert.equal(directionOf("PE", "Sell"), "long");
  assert.equal(stopOnCorrectSide("Buy", 128, 142), true);
  assert.equal(stopOnCorrectSide("Sell", 128, 142), false);
  assert.equal(riskAmount(142, 128, 1000), 14000);
});
t("profitable days and payout gates", () => {
  assert.equal(profitableDays([2000, 1700, 2500, -400], 1000000, 0.2), 2);
  const ok = { accountSize: 1000000, balance: 1040000, flat: true, kycVerified: true, daysSinceCycleStart: 14, profitableDays: 7, needDays: 7, cycleDays: 14, minProfitPct: 3, minPayoutInr: 5000, splitPct: 80, underReview: false };
  const r = payoutCheck(ok);
  assert.equal(r.ok, true);
  assert.equal(r.payable, 32000);
  assert.equal(payoutCheck({ ...ok, balance: 1020000 }).ok, false);
  assert.equal(payoutCheck({ ...ok, flat: false }).ok, false);
  assert.equal(payoutCheck({ ...ok, daysSinceCycleStart: 13 }).ok, false);
  assert.equal(payoutCheck({ ...ok, profitableDays: 6 }).ok, false);
  assert.equal(payoutCheck({ ...ok, kycVerified: false }).ok, false);
});
t("margin headroom", () => {
  assert.equal(hasMargin(5000, 100000, 90000), true);
  assert.equal(hasMargin(10001, 100000, 90000), false);
});
const HEAD = "instrument_token,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange";
const FUTURE = "2099-01-28", WEEK = "2099-01-07", WEEK2 = "2099-01-14";
const csv = (rows: string[]) => [HEAD, ...rows].join("\n");
const nfo = csv([
  `1,1,NIFTY99JANFUT,"NIFTY",0,${FUTURE},0,0.05,65,FUT,NFO-FUT,NFO`,
  `2,2,NIFTY9910024500CE,"NIFTY",0,${WEEK},24500,0.05,65,CE,NFO-OPT,NFO`,
  `3,3,NIFTY9910024500PE,"NIFTY",0,${WEEK},24500,0.05,65,PE,NFO-OPT,NFO`,
  `4,4,NIFTY9910024550CE,"NIFTY",0,${WEEK},24550,0.05,65,CE,NFO-OPT,NFO`,
  `5,5,NIFTY9910024600CE,"NIFTY",0,${WEEK},24600,0.05,65,CE,NFO-OPT,NFO`,
  `6,6,NIFTY9910124500CE,"NIFTY",0,${WEEK2},24500,0.05,65,CE,NFO-OPT,NFO`,
  `7,7,NIFTY2001124500CE,"NIFTY",0,2020-01-01,24500,0.05,65,CE,NFO-OPT,NFO`,
  `8,8,BANKNIFTY99JANFUT,"BANKNIFTY",0,${FUTURE},0,0.05,30,FUT,NFO-FUT,NFO`,
  `9,9,RELIANCE99JANFUT,"RELIANCE",0,${FUTURE},0,0.05,500,FUT,NFO-FUT,NFO`,
]);
const nse = csv([
  `100,1,"NIFTY 50","NIFTY 50",0,,0,0,1,EQ,INDICES,NSE`,
  `101,1,TCS,"TATA CONSULTANCY",0,,0,0.05,1,EQ,NSE,NSE`,
  `102,1,OTHERCO,"OTHER",0,,0,0.05,1,EQ,NSE,NSE`,
]);
const rows = [...parseInstruments(nfo, "2026-11-14"), ...parseInstruments(nse, "2026-11-14")];
const store = buildStore(rows);
t("contract list parsing is real-data driven", () => {
  assert.equal(rows.filter((r) => r.expiry === "2020-01-01").length, 0, "expired contracts are dropped");
  assert.ok(!rows.some((r) => r.name === "RELIANCE" && r.type === "FUT"), "only offered underlyings are kept");
  const n = store.spec.NIFTY;
  assert.equal(n.lot, 65);
  assert.equal(n.strikeStep, 50);
  assert.deepEqual(n.futExpiries, [FUTURE]);
  assert.deepEqual(n.optExpiries, [WEEK, WEEK2]);
  assert.equal(store.spec.BANKNIFTY.lot, 30);
  assert.equal(store.tokenOfSpot.get("NIFTY"), 100);
  assert.equal(store.tokenOfSpot.get("TCS"), 101);
  assert.ok(!store.tokenOfSpot.has("OTHERCO"));
  assert.equal(store.byKey.get(`NIFTY|CE|24500|${WEEK}`)?.tradingsymbol, "NIFTY9910024500CE");
});
t("instrument validation uses the real contract list", () => {
  const spec: ContractSpec = store.spec.NIFTY;
  const e = WEEK;
  assert.equal(validateInstrument({ underlying: "NIFTY", segment: "FUT", expiry: FUTURE }, 65, spec), null);
  assert.match(validateInstrument({ underlying: "NIFTY", segment: "FUT", expiry: FUTURE }, 70, spec)!, /lot size/);
  assert.match(validateInstrument({ underlying: "NIFTY", segment: "FUT", expiry: e }, 65, spec)!, /expiry/);
  assert.match(validateInstrument({ underlying: "NIFTY", segment: "CE", expiry: e, strike: 24475 }, 65, spec)!, /multiple of 50/);
  assert.match(validateInstrument({ underlying: "NIFTY", segment: "CE", expiry: "2020-01-01", strike: 24500 }, 65, spec)!, /expiry/);
  assert.match(validateInstrument({ underlying: "NIFTY", segment: "CE", expiry: e, strike: 24500 }, 65, undefined)!, /not loaded/);
  assert.match(validateInstrument({ underlying: "RELIANCE", segment: "FUT", expiry: e }, 1, spec)!, /no futures/);
  assert.match(validateInstrument({ underlying: "NIFTY", segment: "EQ" }, 1, spec)!, /cash segment/);
  assert.equal(validateInstrument({ underlying: "TCS", segment: "EQ" }, 7, undefined), null);
  assert.match(validateInstrument({ underlying: "TCS", segment: "EQ" }, 0, undefined)!, /above zero/);
});
t("prices are only ever the real feed price", () => {
  const ce = { underlying: "NIFTY", segment: "CE" as const, expiry: WEEK, strike: 24500 };
  const quotes = { NIFTY: 24510, TCS: 3100, [`NIFTY|CE|24500|${WEEK}`]: 187.35 };
  assert.equal(priceOf(ce, quotes), 187.35);
  assert.equal(priceOf({ ...ce, strike: 24550 }, quotes), undefined, "no feed price -> no price, never a model");
  assert.equal(priceOf({ underlying: "TCS", segment: "EQ" }, quotes), 3100);
  assert.equal(priceOf({ underlying: "NIFTY", segment: "FUT", expiry: FUTURE }, quotes), undefined);
  const tk = toTick("X", { last_price: 0, depth: { buy: [{ price: 10, quantity: 1 }], sell: [{ price: 12, quantity: 1 }] } }, 1);
  assert.equal(tk?.ltp, 11, "untraded contract uses the live bid/ask mid");
  assert.equal(toTick("X", { last_price: 0 }, 1), null);
});
t("margin", () => {
  const spot = 24500, ce = 187.35;
  assert.equal(marginRequired({ underlying: "TCS", segment: "EQ" }, "Buy", 10, 3000, 3000), 6000);
  assert.equal(marginRequired({ underlying: "NIFTY", segment: "FUT", expiry: FUTURE }, "Buy", 65, spot, spot), spot * 65 * 0.12);
  assert.equal(marginRequired({ underlying: "NIFTY", segment: "CE", expiry: WEEK, strike: 24500 }, "Buy", 65, ce, spot), ce * 65);
  assert.equal(marginRequired({ underlying: "NIFTY", segment: "CE", expiry: WEEK, strike: 24500 }, "Sell", 65, ce, spot), spot * 65 * 0.12);
});
t("greeks come from the real premium", () => {
  const now = Date.parse("2099-01-01T10:00:00+05:30");
  const g = greeks("CE", 24500, 24500, WEEK, 190, now)!;
  assert.ok(g.iv > 0.05 && g.iv < 1, "iv " + g.iv);
  assert.ok(g.delta > 0.4 && g.delta < 0.65, "ATM call delta near 0.5, got " + g.delta);
  const p = greeks("PE", 24500, 24500, WEEK, 190, now)!;
  assert.ok(p.delta < -0.35 && p.delta > -0.6);
  assert.equal(greeks("CE", 24500, 24000, WEEK, 400, now), null, "premium below intrinsic -> no IV");
});
t("market hours", () => {
  const ist = (d: string, h: number, m: number) => Date.parse(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
  assert.equal(marketOpen(ist("2026-11-13", 9, 14)), false);
  assert.equal(marketOpen(ist("2026-11-13", 9, 15)), true);
  assert.equal(marketOpen(ist("2026-11-13", 15, 29)), true);
  assert.equal(marketOpen(ist("2026-11-13", 15, 30)), false);
  assert.equal(marketOpen(ist("2026-11-14", 11, 0)), false, "Saturday");
});
console.log(`\n${n} groups passed`);
