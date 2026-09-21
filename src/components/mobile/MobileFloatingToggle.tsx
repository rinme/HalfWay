"use client";

import React from "react";
import { Map, ListFilter } from "lucide-react";

interface MobileFloatingToggleProps {
  activeView: "list" | "map";
  onToggle: (view: "list" | "map") => void;
  resultCount: number;
}

export function MobileFloatingToggle({
  activeView,
  onToggle,
  resultCount,
}: MobileFloatingToggleProps) {
  const isList = activeView === "list";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 md:hidden">
      <button
        onClick={() => onToggle(isList ? "map" : "list")}
        className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-slate-900/95 dark:bg-slate-800/95 text-white shadow-2xl backdrop-blur-md border border-white/10 active:scale-95 transition-all duration-200 cursor-pointer text-sm font-semibold tracking-tight hover:bg-slate-800 dark:hover:bg-slate-700"
      >
        {isList ? (
          <>
            <Map className="w-4 h-4 text-indigo-400" />
            <span>View Map</span>
          </>
        ) : (
          <>
            <ListFilter className="w-4 h-4 text-indigo-400" />
            <span>View Results ({resultCount})</span>
          </>
        )}
      </button>
    </div>
  );
}
