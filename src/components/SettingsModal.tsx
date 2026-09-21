"use client";

import React, { useState, useEffect } from "react";
import { X, Key, CheckCircle2, AlertCircle, Layers } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Map & API Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Active Map Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider("osm")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition ${
                  provider === "osm"
                    ? "border-emerald-500 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Layers className="w-4 h-4" />
                OpenStreetMap (Free)
              </button>
              <button
                type="button"
                onClick={() => setProvider("google")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition ${
                  provider === "google"
                    ? "border-indigo-500 bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Layers className="w-4 h-4" />
                Google Maps
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Google Maps API Key (Optional)
            </label>
            <p className="text-xs text-zinc-500 mb-2">
              Stored securely in your local browser storage. Used for Google Maps JS, Geocoding & Places.
            </p>
            {Boolean(typeof process !== "undefined" && process.env?.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) && (
              <div className="mb-3 flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300">
                <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>Server Default Key Active (Google Maps)</span>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setStatus("idle");
                }}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleTestKey}
                disabled={status === "testing" || !key.trim()}
                className="px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition disabled:opacity-50"
              >
                {status === "testing" ? "Testing..." : "Test Key"}
              </button>
            </div>

            {status === "valid" && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{statusMessage}</span>
              </div>
            )}
            {status === "invalid" && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4" />
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
