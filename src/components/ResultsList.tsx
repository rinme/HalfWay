"use client";

import React from "react";
import { ScoredBranch, LatLng } from "@/lib/geo";
import { ResultCard } from "./ResultCard";
import { AlertCircle, Route, Sparkles, MapPin } from "lucide-react";

interface ResultsListProps {
  branches: ScoredBranch[];
  midpoint: LatLng | null;
  totalDistanceAB: number | null;
  highlightedBranchId: string | null;
  error: string | null;
  onHoverBranch: (id: string | null) => void;
}

export function ResultsList({
  branches,
  midpoint: _midpoint,
  totalDistanceAB,
  highlightedBranchId,
  error,
  onHoverBranch,
}: ResultsListProps) {
  if (error) {
    return (
      <div className="p-5">
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-xs mx-auto py-8 px-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800">
          <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-indigo-500/10 dark:bg-indigo-400/10 animate-ping opacity-30" />
            <div className="relative w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <Route className="w-6 h-6 text-indigo-500" strokeWidth={1.75} />
            </div>
          </div>
          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            No branches displayed yet
          </h4>
          <p className="text-[11px] mt-1 text-slate-500 dark:text-slate-400 leading-relaxed">
            Enter Point A, Point B, and click &quot;Find Halfway Branches&quot;.
          </p>

          <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-left">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
              <span>Fairness scored</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>Real-time POIs</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {totalDistanceAB !== null && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-[11px]">
          <div className="flex items-center gap-2 font-medium">
            <Route className="w-3.5 h-3.5 text-indigo-500" />
            <span className="tabular-nums">
              Distance A to B: <strong>{totalDistanceAB} km</strong>
            </span>
          </div>
          <span className="font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-[10px] uppercase tracking-wider">
            {branches.length} branches found
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        {branches.map((branch, idx) => (
          <ResultCard
            key={branch.id}
            branch={branch}
            rank={idx + 1}
            isHighlighted={highlightedBranchId === branch.id}
            onHover={onHoverBranch}
          />
        ))}
      </div>
    </div>
  );
}

