"use client";

import React from "react";
import { ArrowUpDown, Search, Store, Sparkles } from "lucide-react";
import { LocationInput } from "./LocationInput";
import { LocationPoint } from "@/types";

const POPULAR_BRANDS = [
  "Starbucks",
  "Suki Tee Noi",
  "Cafe Amazon",
  "McDonald's",
  "Barbeque Plaza",
  "KFC",
  "MK Restaurants",
];

interface SearchFormProps {
  pointA: LocationPoint | null;
  pointB: LocationPoint | null;
  query: string;
  activePinMode: "A" | "B" | null;
  isLoading: boolean;
  onPointAChange: (point: LocationPoint | null) => void;
  onPointBChange: (point: LocationPoint | null) => void;
  onQueryChange: (query: string) => void;
  onTogglePinMode: (mode: "A" | "B") => void;
  onSwapPoints: () => void;
  onSubmit: () => void;
}

export function SearchForm({
  pointA,
  pointB,
  query,
  activePinMode,
  isLoading,
  onPointAChange,
  onPointBChange,
  onQueryChange,
  onTogglePinMode,
  onSwapPoints,
  onSubmit,
}: SearchFormProps) {
  return (
    <div className="p-5 space-y-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="space-y-3 relative">
        <LocationInput
          label="Person A's Location"
          badgeLabel="A"
          point={pointA}
          onChange={onPointAChange}
          colorClass="bg-emerald-600 dark:bg-emerald-500"
          isActivePinMode={activePinMode === "A"}
          onTogglePinMode={() => onTogglePinMode("A")}
        />

        <div className="flex items-center justify-center -my-1 relative z-10">
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-px bg-slate-200/60 dark:bg-slate-800/80" />
          <button
            type="button"
            onClick={onSwapPoints}
            title="Swap Point A and Point B"
            className="relative px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center gap-1 text-[11px] font-medium"
          >
            <ArrowUpDown className="w-3 h-3 hover:rotate-180 transition-transform duration-300" />
            <span className="text-[10px] text-slate-400 font-normal">Swap</span>
          </button>
        </div>

        <LocationInput
          label="Person B's Location"
          badgeLabel="B"
          point={pointB}
          onChange={onPointBChange}
          colorClass="bg-violet-600 dark:bg-violet-500"
          isActivePinMode={activePinMode === "B"}
          onTogglePinMode={() => onTogglePinMode("B")}
        />
      </div>

      <div className="pt-1">
        <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1.5">
          <Store className="w-3.5 h-3.5 text-slate-400" />
          Target Store or Brand
        </label>
        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="e.g. Starbucks, Suki Tee Noi, Coffee..."
            className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-150 shadow-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none transition-colors group-focus-within:text-indigo-500" />
        </div>

        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[10px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" /> Quick:
          </span>
          {POPULAR_BRANDS.map((brand) => {
            const isSelected = query.toLowerCase() === brand.toLowerCase();
            return (
              <button
                key={brand}
                type="button"
                onClick={() => onQueryChange(brand)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border shrink-0 transition-all cursor-pointer font-medium ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : "border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {brand}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !pointA || !pointB || !query.trim()}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm hover:shadow-md hover:shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-[0.99] active:translate-y-px transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Searching Midpoint Branches...
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            Find Halfway Branches
          </>
        )}
      </button>
    </div>
  );
}

