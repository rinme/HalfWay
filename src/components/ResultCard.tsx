"use client";

import React from "react";
import { ExternalLink, Award, CheckCircle2, Navigation } from "lucide-react";
import { ScoredBranch } from "@/lib/geo";

interface ResultCardProps {
  branch: ScoredBranch;
  rank: number;
  isHighlighted: boolean;
  onHover: (id: string | null) => void;
}

export function ResultCard({ branch, rank, isHighlighted, onHover }: ResultCardProps) {
  const isTopMatch = rank === 1;

  return (
    <div
      onMouseEnter={() => onHover(branch.id)}
      onMouseLeave={() => onHover(null)}
      className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
        isHighlighted
          ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-md shadow-indigo-500/5 -translate-y-0.5"
          : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-xs"
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-transform ${
              isTopMatch
                ? "bg-amber-500 text-white shadow-xs shadow-amber-500/30 ring-2 ring-amber-400/20"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
            }`}
          >
            {rank}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug truncate">
              {branch.name}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 leading-relaxed">
              {branch.address}
            </p>
          </div>
        </div>

        <span
          className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 tabular-nums ${
            branch.fairnessDelta <= 0.5
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
          }`}
        >
          {isTopMatch ? <Award className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
          Fairness: {branch.fairnessScore} km
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
        <div className="bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 rounded-xl p-2">
          <div className="text-[10px] text-slate-400 dark:text-slate-400 font-medium">To Person A</div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
            {branch.distA} km
          </div>
        </div>
        <div className="bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 rounded-xl p-2">
          <div className="text-[10px] text-slate-400 dark:text-slate-400 font-medium">To Person B</div>
          <div className="text-xs font-bold text-violet-600 dark:text-violet-400 tabular-nums mt-0.5">
            {branch.distB} km
          </div>
        </div>
        <div className="bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 rounded-xl p-2">
          <div className="text-[10px] text-slate-400 dark:text-slate-400 font-medium">Difference</div>
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums mt-0.5">
            ±{branch.fairnessDelta} km
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between pt-1">
        <span className="text-[10px] text-slate-400 dark:text-slate-400 flex items-center gap-1 tabular-nums">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          {branch.distMid} km from exact midpoint
        </span>
        <a
          href={branch.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
        >
          <Navigation className="w-3 h-3" />
          Navigate
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>
      </div>
    </div>
  );
}

