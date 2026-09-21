"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, Crosshair, Loader2, X } from "lucide-react";
import { LocationPoint } from "@/types";
import { GeocodeResult } from "@/lib/geocoding";

interface LocationInputProps {
  label: string;
  point: LocationPoint | null;
  onChange: (point: LocationPoint | null) => void;
  colorClass: string;
  badgeLabel: "A" | "B";
  isActivePinMode: boolean;
  onTogglePinMode: () => void;
}

export function LocationInput({
  label,
  point,
  onChange,
  colorClass,
  badgeLabel,
  isActivePinMode,
  onTogglePinMode,
}: LocationInputProps) {
  const [query, setQuery] = useState(point?.address || "");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (point?.address) {
      setQuery(point.address);
    } else if (!point) {
      setQuery("");
    }
  }, [point]);

  // Debounced autocomplete
  useEffect(() => {
    if (!query.trim() || query === point?.address) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.results || []);
        setIsOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, point?.address]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGetCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();
          const address = data.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          onChange({ lat: latitude, lng: longitude, address });
          setQuery(address);
        } catch {
          onChange({
            lat: latitude,
            lng: longitude,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          });
        } finally {
          setIsLoading(false);
        }
      },
      () => {
        setIsLoading(false);
        alert("Location permission denied. Please search or pick on map.");
      }
    );
  };

  const handleClear = () => {
    setQuery("");
    onChange(null);
    setSuggestions([]);
  };

  return (
    <div className="relative group" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <span
            className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold text-white shadow-xs ${colorClass}`}
          >
            {badgeLabel}
          </span>
          <span>{label}</span>
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            title="Use current GPS location"
            className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePinMode}
            title={isActivePinMode ? "Cancel pin drop" : "Drop pin on map"}
            className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 active:scale-95 transition cursor-pointer ${
              isActivePinMode
                ? "bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/30 animate-pulse"
                : "border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{isActivePinMode ? "Click Map..." : "Pin"}</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={`Enter address or landmark for Point ${badgeLabel}...`}
          className="w-full pl-9 pr-9 py-2.5 text-xs rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-150 shadow-xs"
        />
        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none transition-colors group-focus-within:text-indigo-500" />
        
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
          )}
          {query && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition"
              title="Clear input"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/90 dark:border-slate-800 max-h-56 overflow-y-auto py-1.5 custom-scrollbar">
          {suggestions.map((item, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => {
                  onChange({ lat: item.lat, lng: item.lng, address: item.label });
                  setQuery(item.label);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-start gap-2.5 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="truncate leading-relaxed">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

