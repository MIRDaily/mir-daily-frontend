import { supabase } from "@/lib/supabaseBrowser";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

if (!API_URL) {
  throw new Error("API_URL no definida: revisa variables de entorno");
}

async function fetchWithAuth(path: string, signal?: AbortSignal) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${API_URL}${path}`, { signal, headers });
}

async function readError(res: Response, fallback: string) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await res.json().catch(() => null);
    if (payload && typeof payload === "object") {
      if ("error" in payload && typeof payload.error === "string") {
        return payload.error;
      }
      if ("message" in payload && typeof payload.message === "string") {
        return payload.message;
      }
    }
  }
  const text = await res.text().catch(() => "");
  return text || fallback;
}

export async function fetchTodayResults(signal?: AbortSignal) {
  const res = await fetchWithAuth("/api/results/today", signal);

  if (!res.ok) {
    const message = await readError(res, `No results for today (${res.status})`);
    throw new Error(message);
  }

  return res.json();
}

export async function fetchTodayRanking(signal?: AbortSignal) {
  const res = await fetchWithAuth("/api/ranking", signal);

  if (!res.ok) {
    const message = await readError(res, `Ranking error (${res.status})`);
    throw new Error(message);
  }

  return res.json();
}

export async function getUserSummary(signal?: AbortSignal) {
  const res = await fetchWithAuth("/api/stats/summary", signal);

  if (!res.ok) {
    const message = await readError(res, `Summary error (${res.status})`);
    throw new Error(message);
  }

  return res.json();
}

export async function fetchScoreDistribution(signal?: AbortSignal) {
  const res = await fetchWithAuth("/api/stats/score-distribution", signal);

  if (!res.ok) {
    const message = await readError(res, `Score distribution error (${res.status})`);
    throw new Error(message);
  }

  return res.json();
}

export type TimeSeriesPoint = {
  date: string;
  score: number;
  avgTime: number;
  correct?: number;
};

export type TimeSeriesResponse = {
  status?: "ok" | "insufficient_data";
  points?: TimeSeriesPoint[];
  totalPoints?: number;
  avgScore30?: number;
  avgTime30?: number;
};

export async function fetchTimeSeries(signal?: AbortSignal) {
  const res = await fetchWithAuth("/api/stats/timeseries", signal);

  if (!res.ok) {
    const message = await readError(res, `Timeseries error (${res.status})`);
    throw new Error(message);
  }

  return (await res.json()) as TimeSeriesResponse;
}
