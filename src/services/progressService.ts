import { supabase } from "@/lib/supabaseBrowser";
import { debugFetch } from "@/lib/debugRSC";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

if (!API_URL) {
  throw new Error("API_URL no definida: revisa variables de entorno");
}

export type ProgressSummary = {
  /** 1..50 */
  level: number;
  xpTotal: number;
  /** XP conseguido dentro del nivel actual */
  xpIntoLevel: number;
  /** XP que cuesta el nivel actual entero */
  xpForNext: number;
  maxLevel: number;
  currentStreak: number;
  longestStreak: number;
  /** Protectores de racha disponibles (cubren un día perdido cada uno) */
  streakFreezes: number;
  lastActiveDay: string | null;
  /** 1,0 → 1,5 según la racha */
  streakMultiplier: number;
  /**
   * XP de hoy que CONSUME tope. Los premios semanales quedan fuera del tope
   * (caen todos el mismo día y se los comería), así que esta cifra mide la
   * barra del tope, no lo ganado en el día.
   */
  xpToday: number;
  /** Todo el XP ganado hoy, premios semanales incluidos. */
  xpTodayTotal: number;
  dailyCap: number;
};

export type Challenge = {
  code: string;
  scope: "daily" | "weekly";
  /**
   * Qué mide el desafío. `all_daily` es el bono por completar los demás, no un
   * desafío en sí: no debe contarse al decir "2 de 3 hechos".
   */
  metric: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  xpReward: number;
  completed: boolean;
  sortOrder: number;
  meta: Record<string, unknown> | null;
};

export type ProgressResponse = {
  progress: ProgressSummary;
  daily: Challenge[];
  weekly: Challenge[];
};

export type XpHistoryDay = {
  day: string;
  xp: number;
  by_source: Record<string, number>;
};

async function fetchWithAuth(path: string, signal?: AbortSignal) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return debugFetch(`progressService${path}`, () =>
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

export async function fetchProgress(
  signal?: AbortSignal,
): Promise<ProgressResponse> {
  const res = await fetchWithAuth("/api/progress", signal);
  if (!res.ok) {
    throw new Error(await readError(res, `Progreso (${res.status})`));
  }
  return res.json();
}

export async function fetchXpHistory(
  signal?: AbortSignal,
): Promise<XpHistoryDay[]> {
  const res = await fetchWithAuth("/api/progress/history", signal);
  if (!res.ok) {
    throw new Error(await readError(res, `Historial de XP (${res.status})`));
  }
  const payload = await res.json();
  return Array.isArray(payload?.days) ? payload.days : [];
}
