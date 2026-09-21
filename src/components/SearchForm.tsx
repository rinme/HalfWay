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
    <div className="p-5 space-y-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div className="space-y-3 relative">
        <LocationInput
          label="Person A's Location"
          badgeLabel="A"
          point={pointA}
          onChange={onPointAChange}
          colorClass="bg-emerald-500"
          isActivePinMode={activePinMode === "A"}
          onTogglePinMode={() => onTogglePinMode("A")}
        />

        <div className="flex justify-center -my-1 relative z-10">
          <button
            type="button"
            onClick={onSwapPoints}
            title="Swap Point A and Point B"
            className="p-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm text-zinc-400 hover:text-indigo-600 hover:rotate-180 transition-all duration-300 cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <LocationInput
          label="Person B's Location"
          badgeLabel="B"
          point={pointB}
          onChange={onPointBChange}
          colorClass="bg-violet-500"
          isActivePinMode={activePinMode === "B"}
          onTogglePinMode={() => onTogglePinMode("B")}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 mb-1.5">
          <Store className="w-3.5 h-3.5 text-zinc-400" />
          Target Store or Brand
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="e.g. Starbucks, Suki Tee Noi, Coffee..."
            className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
        </div>

        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[10px] text-zinc-400 shrink-0 flex items-center gap-0.5">
            <Sparkles className="w-3 h-3" /> Quick:
          </span>
          {POPULAR_BRANDS.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => onQueryChange(brand)}
              className={`text-[11px] px-2.5 py-0.5 rounded-full border shrink-0 transition cursor-pointer ${
                query.toLowerCase() === brand.toLowerCase()
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-700 dark:text-indigo-300 font-medium"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {brand}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !pointA || !pointB || !query.trim()}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
