import useSWR from "swr";
import type { StatusData } from "../api";
import { api } from "../api";

export function useStatusData() {
  return useSWR<StatusData>("/status/data", () => api.fetchStatus(), { refreshInterval: 5000 });
}
