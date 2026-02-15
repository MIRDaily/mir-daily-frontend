import { useEffect, useRef, useState } from "react";
import { fetchTodayRanking, fetchTodayResults } from "@/services/resultsService";

type ResultsBreakdown = {
  mean?: number;
  stdDev?: number;
  std_dev?: number;
  knowledgeScore?: number;
  timeBonus?: number;
  total?: number;
  totalScore?: number;
};

type ResultsMeToday = {
  breakdown?: ResultsBreakdown;
  totalQuestions?: number;
  correctCount?: number;
  percentage?: number;
  zScore?: number;
  z_score?: number;
  rank?: number;
  position?: number;
  displayName?: string;
  name?: string;
  username?: string;
  score?: number;
};

export type ResultsData = {
  meToday?: ResultsMeToday;
  breakdown?: ResultsBreakdown;
  byQuestion?: unknown[];
  reviewQuestions?: unknown[];
  mean?: number;
  stdDev?: number;
  std_dev?: number;
  zScore?: number;
  z_score?: number;
};

export type RankingEntry = {
  rank?: number;
  position?: number;
  score?: number;
  displayName?: string;
  avatarId?: number;
  isBot?: boolean;
  userId?: string;
  user_id?: string;
  name?: string;
  username?: string;
  points?: number;
  avatar_id?: number;
};

export function useDailyResults(open: boolean, refreshKey = 0) {
  const [data, setData] = useState<ResultsData | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const fetchKey = `${open}-${refreshKey}`;
    if (lastFetchKeyRef.current === fetchKey || inFlightRef.current) return;
    lastFetchKeyRef.current = fetchKey;
    inFlightRef.current = true;

    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });

    Promise.all([
      fetchTodayResults(controller.signal),
      fetchTodayRanking(controller.signal),
    ])
      .then(([results, rankingRes]) => {
        setData(results);
        setRanking(Array.isArray(rankingRes?.ranking) ? (rankingRes.ranking as RankingEntry[]) : []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No hay resultados todavía");
      })
      .finally(() => {
        inFlightRef.current = false;
        setLoading(false);
      });

    return () => {
      controller.abort();
      inFlightRef.current = false;
    };
  }, [open, refreshKey]);

  return { data, ranking, loading, error };
}
