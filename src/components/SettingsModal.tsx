"use client";

import React, { useState, useEffect } from "react";
import { X, Key, CheckCircle2, AlertCircle, Layers, ShieldCheck, ExternalLink } from "lucide-react";
import { AppSettings, MapProvider } from "@/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: SettingsModalProps) {
  const [key, setKey] = useState(settings.googleMapsApiKey);
  const [provider, setProvider] = useState<MapProvider>(settings.activeProvider);
  const [status, setStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKey(settings.googleMapsApiKey);
    setProvider(settings.activeProvider);
  }, [settings]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    if (!key.trim()) {
      setStatus("invalid");
      setStatusMessage("Please enter an API key first.");
      return;
    }
    setStatus("testing");
    try {
      const res = await fetch(`/api/geocode?q=Bangkok&provider=google&key=${encodeURIComponent(key.trim())}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setStatus("valid");
        setStatusMessage("Google Maps API Key is verified!");
      } else {
        setStatus("invalid");
        setStatusMessage("Key returned no geocoding results or lacks Places API access.");
      }
    } catch {
      setStatus("invalid");
      setStatusMessage("Error connecting to verification service.");
    }
  };

  const handleSave = () => {
    onSaveSettings({
      googleMapsApiKey: key.trim(),
      activeProvider: provider,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden transition-all">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Map & API Settings
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Configure map sources and keys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Active Map Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider("osm")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  provider === "osm"
                    ? "border-emerald-500 bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-xs"
                    : "border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                OpenStreetMap (Free)
              </button>
              <button
                type="button"
                onClick={() => setProvider("google")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  provider === "google"
                    ? "border-indigo-500 bg-indigo-50/70 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 shadow-xs"
                    : "border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Google Maps
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                Google Maps API Key (Optional)
              </label>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Stored locally
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5 leading-relaxed">
              Stored securely in your local browser storage. Used for Google Maps JS, Geocoding & Places.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setStatus("idle");
                }}
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              <button
                type="button"
                onClick={handleTestKey}
                disabled={status === "testing" || !key.trim()}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                {status === "testing" ? "Testing..." : "Test Key"}
              </button>
            </div>

            {status === "valid" && (
              <div className="mt-2.5 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/60">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
            {status === "invalid" && (
              <div className="mt-2.5 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-200/60 dark:border-rose-900/60">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

