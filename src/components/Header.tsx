"use client";

import React, { useState } from "react";
import { Compass, Settings, Share2, Check } from "lucide-react";
import { AppSettings } from "@/types";

interface HeaderProps {
  settings: AppSettings;
  onOpenSettings: () => void;
  onOpenShare?: () => void;
}

export function Header({ settings, onOpenSettings, onOpenShare }: HeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (onOpenShare) {
      onOpenShare();
      return;
    }
    if (typeof window !== "undefined") {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.href).catch(() => {});
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isGoogle = settings.activeProvider === "google";

  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-800 text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10 transition-transform hover:scale-105">
          <Compass className="w-4.5 h-4.5 text-indigo-400" strokeWidth={2.2} />
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-slate-900" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              HalfWay
            </h1>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Fair Engine
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-normal tracking-normal">
            Fair venue midpoint matching
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
            isGoogle
              ? "bg-indigo-50/80 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
              : "bg-emerald-50/80 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isGoogle ? "bg-indigo-500 animate-pulse" : "bg-emerald-500"
            }`}
          />
          <span>{isGoogle ? "Google Maps" : "OpenStreetMap"}</span>
        </div>

        <button
          onClick={handleShare}
          title="Copy shareable link"
          className="p-2 rounded-xl border border-slate-200/70 dark:border-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenSettings}
          title="Settings & API Key"
          className="p-2 rounded-xl border border-slate-200/70 dark:border-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

