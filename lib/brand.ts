/** One place for the brand. Change the name here and it changes across the site, portal, terminal, receipts and chat. */
export const BRAND = { name: "Edge Funded", first: "Edge", second: "Funded" } as const;

/** Shown on the legal pages. Set NEXT_PUBLIC_SUPPORT_EMAIL in Railway once the support mailbox exists. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";
export const LEGAL_UPDATED = "20 November 2026";
