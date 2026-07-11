import { supabase } from "@/lib/supabaseBrowser";
import { debugFetch } from "@/lib/debugRSC";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

if (!API_URL) {
  throw new Error("API_URL no definida: revisa variables de entorno");
}

// Ventanas móviles: 7d = últimos 7 días, 30d = últimos 30, all = global.
export type AnalyticsWindow = "7d" | "30d" | "all";
// Modo de estudio; 'all' agrega los tres.
export type AnalyticsMode = "all" | "daily" | "simulacro" | "studio";

export type WindowInfo = {
  type: string;
  from: string;
  to: string;
};

export type SubjectHeatmapCell = {
  subjectId: number;
  name: string;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  /** % de acierto sobre respondidas (los blancos no penalizan); null si todo fueron blancos. */
  accuracy: number | null;
};

export type SubjectHeatmapResponse = {
  window: WindowInfo;
  mode: AnalyticsMode;
  subjects: SubjectHeatmapCell[];
};

export type TopicHeatmapCell = {
  topicId: number;
  name: string;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  accuracy: number | null;
};

export type TopicHeatmapResponse = {
  window: WindowInfo;
  mode: AnalyticsMode;
  subjectId: number;
  topics: TopicHeatmapCell[];
};

export type WeakTopic = {
  topicId: number;
  name: string;
  subjectId: number;
  subjectName: string;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  accuracy: number | null;
  /** % de fallos + blancos sobre el total: "lo que no sabes". */
  failRate: number | null;
};

export type WeakPointsWindow = {
  from: string;
  to: string;
  topics: WeakTopic[];
};

export type WeakPointsResponse = {
  week: WeakPointsWindow;
  month: WeakPointsWindow;
  global: WeakPointsWindow;
};

export type EffortByMode = {
  mode: string;
  questions: number;
  correct: number;
  wrong: number;
  blank: number;
  timeSpentSeconds: number;
};

export type EffortBySubject = {
  subjectId: number;
  name: string;
  questions: number;
  correct: number;
  wrong: number;
  blank: number;
};

export type EffortResponse = {
  window: WindowInfo;
  totals: {
    questions: number;
    correct: number;
    wrong: number;
    blank: number;
    timeSpentSeconds: number;
  };
  byMode: EffortByMode[];
  bySubject: EffortBySubject[];
};

async function fetchWithAuth(path: string, signal?: AbortSignal) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return debugFetch(`analyticsService${path}`, () =>
    fetch(`${API_URL}${path}`, { signal, headers }),
  );
}

async function readError(res: Response, fallback: string) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await res.json().catch(() => null);
    if (payload && typeof payload === "object") {
      if ("error" in payload && typeof payload.error === "string") {
        return payload.error;
      }
    }
  }
  const text = await res.text().catch(() => "");
  return text || fallback;
}

export async function fetchSubjectHeatmap(
  window: AnalyticsWindow,
  mode: AnalyticsMode = "all",
  signal?: AbortSignal,
): Promise<SubjectHeatmapResponse> {
  const params = new URLSearchParams({ window });
  if (mode !== "all") params.set("mode", mode);
  const res = await fetchWithAuth(
    `/api/analytics/heatmap/subjects?${params}`,
    signal,
  );
  if (!res.ok) {
    throw new Error(
      await readError(res, `Heatmap de asignaturas (${res.status})`),
    );
  }
  return res.json();
}

export async function fetchTopicHeatmap(
  subjectId: number,
  window: AnalyticsWindow,
  mode: AnalyticsMode = "all",
  signal?: AbortSignal,
): Promise<TopicHeatmapResponse> {
  const params = new URLSearchParams({ subjectId: String(subjectId), window });
  if (mode !== "all") params.set("mode", mode);
  const res = await fetchWithAuth(
    `/api/analytics/heatmap/topics?${params}`,
    signal,
  );
  if (!res.ok) {
    throw new Error(await readError(res, `Heatmap de temas (${res.status})`));
  }
  return res.json();
}

export async function fetchWeakPoints(
  signal?: AbortSignal,
): Promise<WeakPointsResponse> {
  const res = await fetchWithAuth("/api/analytics/weak-points", signal);
  if (!res.ok) {
    throw new Error(await readError(res, `Puntos débiles (${res.status})`));
  }
  return res.json();
}

export async function fetchEffort(
  window: AnalyticsWindow,
  signal?: AbortSignal,
): Promise<EffortResponse> {
  const params = new URLSearchParams({ window });
  const res = await fetchWithAuth(`/api/analytics/effort?${params}`, signal);
  if (!res.ok) {
    throw new Error(await readError(res, `Esfuerzo (${res.status})`));
  }
  return res.json();
}
