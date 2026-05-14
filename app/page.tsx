"use client";

import { useState, useCallback, useEffect, useRef } from "react";

type Result = { text: string; confidence: number };
type CaptchaEntry = { image: string; result: Result | null; error: string };
type HistoryEntry = { image: string; result: string; confidence: number };

async function fetchAndSolve(): Promise<CaptchaEntry> {
  const cap = await fetch("/api/captcha").then((r) => r.json());
  if (cap.error) return { image: "", result: null, error: cap.error };

  const solRes = await fetch("/api/recognize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ocrImage: cap.ocrImage }),
  });
  const sol = solRes.ok || solRes.headers.get("content-type")?.includes("application/json")
    ? await solRes.json()
    : { error: `Server error ${solRes.status}` };

  return { image: cap.displayImage, result: sol.error ? null : sol, error: sol.error ?? "" };
}

export default function Home() {
  const [current, setCurrent] = useState<CaptchaEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const queue = useRef<Promise<CaptchaEntry> | null>(null);

  // Pre-fetch next captcha+solution in background
  const prefetch = useCallback(() => {
    queue.current = fetchAndSolve();
  }, []);

  // Load from queue (instant if ready) then immediately prefetch next
  const next = useCallback(async () => {
    setLoading(true);
    setCurrent(null);
    try {
      const entry = await (queue.current ?? fetchAndSolve());
      setCurrent(entry);
      if (entry.result) {
        setHistory((prev) => [
          { image: entry.image, result: entry.result!.text, confidence: entry.result!.confidence },
          ...prev.slice(0, 19),
        ]);
      }
    } finally {
      setLoading(false);
      prefetch(); // start fetching next one immediately
    }
  }, [prefetch]);

  // On mount: start prefetching right away
  useEffect(() => {
    prefetch();
  }, [prefetch]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-950 flex items-start justify-center gap-6 p-8">

      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-center text-indigo-700 mb-1">GGSIPU Captcha Solver</h1>
        <p className="text-center text-gray-400 text-xs mb-6">examweb.ggsipu.ac.in</p>

        <div className="rounded-xl border-2 border-indigo-100 bg-gray-50 h-[60px] flex items-center justify-center mb-3 overflow-hidden">
          {loading ? (
            <Spinner />
          ) : current?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.image} alt="captcha" className="h-full object-contain" />
          ) : (
            <p className="text-xs text-gray-400">Click &quot;Load&quot; to start</p>
          )}
        </div>

        <button onClick={next} disabled={loading}
          className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold transition-colors mb-5">
          {loading ? "Loading…" : current ? "↻ Next Captcha" : "▶ Load Captcha"}
        </button>

        {current?.result && (
          <div className="p-4 rounded-xl bg-indigo-50 border-2 border-indigo-300 text-center mb-3">
            <p className="text-xs text-gray-500 mb-1">Solved</p>
            <p className="font-mono text-3xl font-bold tracking-widest text-indigo-800">{current.result.text || "—"}</p>
            <p className="text-xs text-gray-400 mt-1">{current.result.confidence}% confidence</p>
          </div>
        )}

        {current?.error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">{current.error}</div>
        )}
      </div>

      {history.length > 0 && (
        <div className="w-64 bg-white rounded-2xl shadow-2xl p-5 sticky top-8">
          <h2 className="text-sm font-bold text-indigo-700 mb-3">History <span className="text-gray-400 font-normal">({history.length})</span></h2>
          <ul className="flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
            {history.map((h, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.image} alt="captcha" className="h-8 rounded object-contain border border-gray-200 bg-white" />
                <div className="min-w-0">
                  <p className="font-mono font-bold text-indigo-700 text-sm truncate">{h.result || "—"}</p>
                  <p className="text-xs text-gray-400">{h.confidence}%</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-indigo-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}
