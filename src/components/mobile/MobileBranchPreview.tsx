"use client";

import React from "react";
import { X, ExternalLink, Navigation, Award } from "lucide-react";
import { ScoredBranch } from "@/types";

interface MobileBranchPreviewProps {
  branch: ScoredBranch | null;
  onClose: () => void;
  onViewDetails?: (branch: ScoredBranch) => void;
}

export function MobileBranchPreview({
  branch,
  onClose,
  onViewDetails,
}: MobileBranchPreviewProps) {
  if (!branch) return null;

  const spread = branch.spread ?? branch.fairnessDelta ?? 0;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-20 md:hidden">
      <div className="p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-2xl flex flex-col gap-2.5 transition-all">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                <Award className="w-3 h-3" />
                Fair Midpoint
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                ±{spread.toFixed(1)} km spread
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {branch.name}
            </h4>
            {branch.address && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {branch.address}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {branch.distances && branch.distances.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {branch.distances.map((d) => (
              <span
                key={d.personId}
                className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
              >
                {d.name}: {d.distance.toFixed(1)} km
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <a
            href={branch.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold shadow-sm transition"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3 h-3 opacity-80" />
          </a>

          {onViewDetails && (
            <button
              onClick={() => onViewDetails(branch)}
              className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 text-xs font-semibold transition cursor-pointer"
            >
              Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
