import type { AccountRow, PlanRow } from "@/components/trading/types";

export interface RewardRow {
  id: string;
  account_id: string;
  amount_inr: number;
  fee_refund_inr?: number | null;
  status: "requested" | "approved" | "paid" | "rejected";
  payout_ref: string | null;
  reject_reason?: string | null;
  requested_at: string;
  paid_at: string | null;
}

export interface KycSubmission {
  status: "pending" | "verified" | "rejected";
  full_name: string;
  pan: string;
  payout_method: "upi" | "bank";
  upi_id: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  reviewer_note: string | null;
  submitted_at: string;
  aadhaar_no?: string | null;
  district?: string | null;
  state?: string | null;
  pan_photo?: string | null;
  aadhaar_photo?: string | null;
  selfie_photo?: string | null;
}

export interface PaymentRow {
  id: string;
  plan_key: string;
  account_size: number;
  amount_inr: number;
  gst_inr: number;
  utr: string;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  receipt_no: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface PortalInitial {
  payments: PaymentRow[];
  user: { name: string; email: string };
  accounts: AccountRow[];
  plans: PlanRow[];
  fromPrice: number | null;
  rewards: RewardRow[];
  kycVerified: boolean;
  kyc: KycSubmission | null;
}
