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

  return (
    <header className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
          <Compass className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">
            HalfWay
          </h1>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            Fair venue midpoint matching
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
            settings.activeProvider === "google"
              ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
              : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
          }`}
        >
          {settings.activeProvider === "google" ? "Google Maps" : "OpenStreetMap"}
        </span>

        <button
          onClick={handleShare}
          title="Copy shareable link"
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenSettings}
          title="Settings & API Key"
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
