"use client";

import React from "react";
import { MapPin, Check } from "lucide-react";
import { Person } from "@/types";

interface MobilePinningBannerProps {
  activePerson: Person | null;
  onDone: () => void;
}

export function MobilePinningBanner({
  activePerson,
  onDone,
}: MobilePinningBannerProps) {
  if (!activePerson) return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-30 md:hidden px-4 py-2.5 bg-indigo-600 dark:bg-indigo-700 text-white flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <MapPin className="w-4 h-4 shrink-0 text-indigo-200 animate-bounce" />
        <span className="text-xs font-semibold truncate">
          Tap map to place location for {activePerson.name}
        </span>
      </div>

      <button
        onClick={onDone}
        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 active:scale-95 px-3 py-1 rounded-lg text-xs font-bold tracking-wide transition cursor-pointer shrink-0"
      >
        <Check className="w-3.5 h-3.5" />
        <span>Done</span>
      </button>
    </div>
  );
}
