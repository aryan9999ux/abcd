// Run: npx tsx lib/engine/selftest.ts
import assert from "node:assert/strict";
import {
  classifyOrder, evaluateRisk, hasMargin, increasingQty, isTriggered, netFill, unrealized, validateInstrument,
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
t("risk limits", () => {
  const base = { accountSize: 100000, dayStartEquity: 100000, maxDailyPct: 4, maxOverallPct: 8 };
  assert.equal(evaluateRisk({ ...base, equity: 98000 }).breach, null);
  assert.equal(evaluateRisk({ ...base, equity: 96000 }).breach, "daily_loss_limit");
  assert.equal(evaluateRisk({ ...base, equity: 92000 }).breach, "overall_loss_limit");
  assert.equal(Math.round(evaluateRisk({ ...base, equity: 96000 }).overallUsedPct), 50);
  // after a profitable day the daily floor trails the day-start equity
  assert.equal(evaluateRisk({ ...base, dayStartEquity: 110000, equity: 105000 }).breach, "daily_loss_limit");
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
