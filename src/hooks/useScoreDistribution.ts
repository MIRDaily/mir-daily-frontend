import { useEffect, useRef, useState } from "react";
import { fetchScoreDistribution } from "@/services/resultsService";

type ScoreDistribution = {
  date?: string;
  scores?: number[];
  mean?: number;
  median?: number;
  sameScoreCount?: number;
  percentile?: number;
  totalUsers?: number;
};

export function useScoreDistribution(refreshKey = 0) {
  const [data, setData] = useState<ScoreDistribution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (inFlightRef.current) return;
    const fetchKey = `${refreshKey}`;
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;
    inFlightRef.current = true;

    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    fetchScoreDistribution(controller.signal)
      .then((payload) => {
        setData(payload);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "No se pudo cargar la distribucion";
        setError(message);
      })
      .finally(() => {
        inFlightRef.current = false;
        setLoading(false);
      });

    return () => {
      controller.abort();
      inFlightRef.current = false;
    };
  }, [refreshKey]);

  return { data, loading, error };
}
