import { useEffect, useState } from 'react';

export interface ExchangeRate {
  rate: number;
  /** Date de publication du taux (AAAA-MM-JJ). */
  date: string;
}

// Taux de référence de la BCE via Frankfurter (gratuit, sans clé, CORS ouvert).
const RATE_URL = 'https://api.frankfurter.dev/v1/latest?base=ILS&symbols=EUR';
const CACHE_KEY = 'entrenous_ils_eur_rate';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let inflight: Promise<ExchangeRate | null> | null = null;

function readCache(): (ExchangeRate & { fetchedAt: number }) | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function fetchRate(): Promise<ExchangeRate | null> {
  try {
    const res = await fetch(RATE_URL);
    if (!res.ok) return null;
    const json = (await res.json()) as { date: string; rates: { EUR?: number } };
    if (!json.rates.EUR) return null;
    const value = { rate: json.rates.EUR, date: json.date };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ...value, fetchedAt: Date.now() }));
    } catch {
      // stockage indisponible : on garde juste le taux en mémoire
    }
    return value;
  } catch {
    return null;
  }
}

/** Taux ILS → EUR du jour ; null tant qu'il n'est pas chargé ou si l'API est injoignable. */
export function useIlsToEurRate(): ExchangeRate | null {
  const [rate, setRate] = useState<ExchangeRate | null>(() => readCache());

  useEffect(() => {
    const cached = readCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;
    inflight ??= fetchRate().finally(() => {
      inflight = null;
    });
    let cancelled = false;
    inflight.then((value) => {
      if (!cancelled && value) setRate(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return rate;
}
