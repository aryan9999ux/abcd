// Run: npx tsx lib/engine/selftest.ts
import assert from "node:assert/strict";
import {
  classifyOrder, directionOf, drawdownFloor, evaluateRisk, pastEntryCutoff, payoutCheck, profitableDays, riskAmount, stopOnCorrectSide, hasMargin, increasingQty, isTriggered, netFill, unrealized, validateInstrument,
} from "./pure";
import { EXPIRIES, lotSize, marginRequired, optionGreeks, priceInstrument } from "../market/pricing";

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
t("instrument validation", () => {
  const e = EXPIRIES.NIFTY[0];
  assert.equal(validateInstrument({ underlying: "NIFTY", segment: "FUT", expiry: e }, 65), null);
  assert.match(validateInstrument({ underlying: "NIFTY", segment: "FUT", expiry: e }, 70)!, /lot size/);
  assert.match(validateInstrument({ underlying: "NIFTY", segment: "CE", expiry: e, strike: 24475 }, 65)!, /multiple of 50/);
  assert.match(validateInstrument({ underlying: "NIFTY", segment: "CE", expiry: "2020-01-01", strike: 24500 }, 65)!, /expiry/);
  assert.match(validateInstrument({ underlying: "RELIANCE", segment: "FUT", expiry: e }, 1)!, /no futures/);
  assert.match(validateInstrument({ underlying: "NIFTY", segment: "EQ" }, 1)!, /cash segment/);
  assert.equal(validateInstrument({ underlying: "TCS", segment: "EQ" }, 7), null);
  assert.match(validateInstrument({ underlying: "TCS", segment: "EQ" }, 0)!, /above zero/);
});
t("pricing and margin", () => {
  const e = EXPIRIES.NIFTY[0];
  const spot = 24500;
  const ce = priceInstrument({ underlying: "NIFTY", segment: "CE", expiry: e, strike: 24500 }, spot);
  const pe = priceInstrument({ underlying: "NIFTY", segment: "PE", expiry: e, strike: 24500 }, spot);
  assert.ok(ce > 0.05 && pe > 0.05, "ATM options have value");
  const deep = priceInstrument({ underlying: "NIFTY", segment: "CE", expiry: e, strike: 26000 }, spot);
  assert.ok(deep < ce);
  const d = optionGreeks({ underlying: "NIFTY", segment: "CE", expiry: e, strike: 24500 }, spot).delta;
  assert.ok(d > 0.4 && d < 0.65, "ATM call delta near 0.5, got " + d);
  assert.equal(lotSize("NIFTY"), 65);
  assert.equal(marginRequired({ underlying: "TCS", segment: "EQ" }, "Buy", 10, 3000, 3000), 6000);
  assert.equal(marginRequired({ underlying: "NIFTY", segment: "FUT", expiry: e }, "Buy", 65, spot, spot), spot * 65 * 0.12);
  assert.equal(marginRequired({ underlying: "NIFTY", segment: "CE", expiry: e, strike: 24500 }, "Buy", 65, ce, spot), ce * 65);
  assert.equal(marginRequired({ underlying: "NIFTY", segment: "CE", expiry: e, strike: 24500 }, "Sell", 65, ce, spot), spot * 65 * 0.12);
});
t("expiries are upcoming dates", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const u of ["NIFTY", "BANKNIFTY", "SENSEX"]) {
    const list = EXPIRIES[u];
    assert.ok(list.length >= 1, u + " has expiries");
    assert.ok(list.every((d) => d >= today), u + " expiries are not in the past");
  }
});
console.log(`\n${n} groups passed`);
