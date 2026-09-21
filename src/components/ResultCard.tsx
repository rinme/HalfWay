"use client";

import React from "react";
import { ExternalLink, Award, CheckCircle2 } from "lucide-react";
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
          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-md"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              isTopMatch
                ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {rank}
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
              {branch.name}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
              {branch.address}
            </p>
          </div>
        </div>

        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
            branch.fairnessDelta <= 0.5
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
          }`}
        >
          {isTopMatch ? <Award className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
          Fairness: {branch.fairnessScore} km
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
        <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-1.5">
          <div className="text-[10px] text-zinc-400 font-medium">To Person A</div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {branch.distA} km
          </div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-1.5">
          <div className="text-[10px] text-zinc-400 font-medium">To Person B</div>
          <div className="text-xs font-bold text-violet-600 dark:text-violet-400">
            {branch.distB} km
          </div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-1.5">
          <div className="text-[10px] text-zinc-400 font-medium">Difference</div>
          <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            ±{branch.fairnessDelta} km
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-zinc-400">
          {branch.distMid} km from exact midpoint
        </span>
        <a
          href={branch.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Navigate
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
