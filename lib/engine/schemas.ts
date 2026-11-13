import { z } from "zod";

const uuid = z.string().uuid("Invalid id");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const placeOrderSchema = z.object({
  accountId: uuid,
  underlying: z.string().min(1).max(20),
  segment: z.enum(["EQ", "FUT", "CE", "PE"]),
  strike: z.number().positive().max(1_000_000).nullish(),
  expiry: date.nullish(),
  side: z.enum(["Buy", "Sell"]),
  orderType: z.enum(["Market", "Limit", "Stop"]),
  qty: z.number().int("Quantity must be a whole number").positive().max(1_000_000),
  price: z.number().positive().max(10_000_000).nullish(),
});
export const cancelOrderSchema = z.object({ accountId: uuid, orderId: uuid });
export const closePositionSchema = z.object({ accountId: uuid, instrument: z.string().min(3).max(120) });
export const closeAllSchema = z.object({ accountId: uuid });
export const checkoutSchema = z.object({ planKey: z.string().min(1).max(40), accountSize: z.number().int().positive() });
