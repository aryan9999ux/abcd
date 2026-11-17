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
  stopLoss: z.number().positive().max(10_000_000).nullish(),
});
export const cancelOrderSchema = z.object({ accountId: uuid, orderId: uuid });
export const closePositionSchema = z.object({ accountId: uuid, instrument: z.string().min(3).max(120) });
export const closeAllSchema = z.object({ accountId: uuid });
export const checkoutSchema = z.object({ planKey: z.string().min(1).max(40), accountSize: z.number().int().positive() });

export const demoSchema = z.object({ planKey: z.string().min(1).max(40) });

export const payoutRequestSchema = z.object({ accountId: uuid });

export const kycSchema = z
  .object({
    fullName: z.string().trim().min(3, "Enter your full name as on your PAN card.").max(80),
    pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN, for example ABCDE1234F."),
    method: z.enum(["upi", "bank"]),
    upiId: z.string().trim().max(60).optional(),
    bankAccount: z.string().trim().optional(),
    bankIfsc: z.string().trim().toUpperCase().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.method === "upi" && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v.upiId ?? "")) ctx.addIssue({ code: "custom", path: ["upiId"], message: "Enter a valid UPI ID, for example name@bank." });
    if (v.method === "bank") {
      if (!/^[0-9]{9,18}$/.test(v.bankAccount ?? "")) ctx.addIssue({ code: "custom", path: ["bankAccount"], message: "Enter your bank account number (9 to 18 digits)." });
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.bankIfsc ?? "")) ctx.addIssue({ code: "custom", path: ["bankIfsc"], message: "Enter a valid IFSC, for example HDFC0001234." });
    }
  });
