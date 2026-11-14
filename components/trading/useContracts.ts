"use client";
import { useEffect, useState } from "react";
import type { ContractSpec } from "@/lib/market/pricing";

export interface ContractsState { specs: Record<string, ContractSpec>; ready: boolean; error: string | null }

/** Real lot sizes, expiries and strike steps from the exchange contract list. Retries until the server has them. */
export function useContracts(): ContractsState {
  const [state, setState] = useState<ContractsState>({ specs: {}, ready: false, error: null });
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      let next = 5000;
      try {
        const res = await fetch("/api/contracts", { cache: "no-store" });
        const json = (await res.json()) as { ok: boolean; ready?: boolean; specs?: Record<string, ContractSpec>; error?: string | null };
        if (!stop && json.ok) {
          setState({ specs: json.specs ?? {}, ready: !!json.ready, error: json.error ?? null });
          if (json.ready) next = 10 * 60_000;
        }
      } catch { /* try again */ }
      if (!stop) timer = setTimeout(load, next);
    }
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, []);
  return state;
}
