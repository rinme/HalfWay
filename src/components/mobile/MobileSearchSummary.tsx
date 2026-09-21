"use client";

import React from "react";
import { Users, Search, Edit3 } from "lucide-react";
import { Person } from "@/types";

interface MobileSearchSummaryProps {
  persons: Person[];
  query: string;
  onExpand: () => void;
}

export function MobileSearchSummary({
  persons,
  query,
  onExpand,
}: MobileSearchSummaryProps) {
  const validPersons = persons.filter((p) => p.address.trim() !== "");

  return (
    <div className="p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between z-20 md:hidden transition-colors">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0">
          <Users className="w-3.5 h-3.5 text-indigo-500" />
          <span>{validPersons.length} People</span>
          <div className="flex -space-x-1 ml-0.5">
            {validPersons.slice(0, 4).map((p) => (
              <span
                key={p.id}
                className="w-2 h-2 rounded-full ring-1 ring-white dark:ring-slate-900 shrink-0"
                style={{ backgroundColor: p.color || "#6366f1" }}
              />
            ))}
          </div>
        </div>

        {query && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-xs font-medium text-indigo-700 dark:text-indigo-300 truncate">
            <Search className="w-3 h-3 shrink-0" />
            <span className="truncate">{query}</span>
          </div>
        )}
      </div>

      <button
        onClick={onExpand}
        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 px-2.5 py-1.5 rounded-lg active:scale-95 transition cursor-pointer shrink-0"
      >
        <Edit3 className="w-3.5 h-3.5" />
        <span>Edit</span>
      </button>
    </div>
  );
}
