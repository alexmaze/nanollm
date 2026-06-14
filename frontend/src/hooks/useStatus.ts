import useSWR from "swr";
import type { StatusData } from "../api";
import { api } from "../api";

/**
 * Polls /status/data every 5s. Consumers should read `error` to render an
 * ErrorState and `isLoading` (first load only) for skeletons.
 */
export function useStatusData() {
  return useSWR<StatusData>("/status/data", () => api.fetchStatus(), {
    refreshInterval: 5000,
    // Don't auto-retry with backoff on error: we surface errors via UI and
    // keep polling on the regular 5s cadence instead.
    shouldRetryOnError: false,
  });
}
