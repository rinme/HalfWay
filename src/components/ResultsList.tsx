"use client";

import React from "react";
import { ScoredBranch, LatLng } from "@/lib/geo";
import { ResultCard } from "./ResultCard";
import { MapPinOff, Info } from "lucide-react";

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
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
          {error}
        </div>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="p-8 text-center text-zinc-400 dark:text-zinc-500">
        <MapPinOff className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          No branches displayed yet
        </p>
        <p className="text-[11px] mt-1 text-zinc-400">
          Enter Point A, Point B, and click &quot;Find Halfway Branches&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      {totalDistanceAB !== null && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px]">
          <div className="flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>Distance A to B: <strong>{totalDistanceAB} km</strong></span>
          </div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
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
