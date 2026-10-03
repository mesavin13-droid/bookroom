"use client";

import * as React from "react";
import type { DayAvailability } from "@/lib/booking/slots";
import { GENERIC_ERROR, NETWORK_ERROR } from "@/lib/booking/errors";

export interface AvailabilityPayload {
  timezone: string;
  durationMinutes: number;
  from: string;
  days: DayAvailability[];
  staffIds: string[];
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: AvailabilityPayload }
  | { status: "error"; error: string; code?: string };

export function useAvailability(params: {
  slug: string;
  serviceId: string | null;
  staffId: string | null;
  reschedule?: string | null;
  admin?: boolean;
  enabled?: boolean;
}) {
  const { slug, serviceId, staffId, reschedule, admin, enabled = true } = params;
  const [state, setState] = React.useState<State>({ status: "idle" });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!enabled || !serviceId) {
      setState({ status: "idle" });
      return;
    }
    const ctrl = new AbortController();
    setState({ status: "loading" });
    const qs = new URLSearchParams({ service: serviceId });
    if (staffId) qs.set("staff", staffId);
    if (reschedule) qs.set("reschedule", reschedule);
    if (admin) qs.set("admin", "1");
    fetch(`/api/studios/${slug}/availability?${qs.toString()}`, { signal: ctrl.signal, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setState({ status: "error", error: body?.error?.message ?? GENERIC_ERROR, code: body?.error?.code });
          return;
        }
        setState({ status: "success", data: body as AvailabilityPayload });
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setState({ status: "error", error: navigator.onLine ? GENERIC_ERROR : NETWORK_ERROR });
      });
    return () => ctrl.abort();
  }, [slug, serviceId, staffId, reschedule, admin, enabled, nonce]);

  const refetch = React.useCallback(() => setNonce((n) => n + 1), []);
  return { state, refetch };
}
