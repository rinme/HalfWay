"use client";

import React, { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, Crosshair, Loader2, Trash2, Edit2 } from "lucide-react";
import { LocationPoint, Person } from "@/types";
import { GeocodeResult } from "@/lib/geocoding";

export interface LocationInputProps {
  label?: string;
  point?: LocationPoint | null;
  onChange?: (point: LocationPoint | null) => void;
  colorClass?: string;
  badgeLabel?: string;
  isActivePinMode?: boolean;
  onTogglePinMode?: () => void;
  person?: Person;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
}

export function LocationInput({
  label,
  point,
  onChange,
  colorClass = "bg-indigo-500",
  badgeLabel,
  isActivePinMode = false,
  onTogglePinMode,
  person,
  onRename,
  onDelete,
}: LocationInputProps) {
  const displayName = person?.name || label || "Participant";
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);

  useEffect(() => {
    setNameInput(displayName);
  }, [displayName]);

  const currentPoint: LocationPoint | null =
    point !== undefined
      ? point
      : person && person.address
      ? { address: person.address, lat: person.lat, lng: person.lng }
      : null;

  const [query, setQuery] = useState(currentPoint?.address || "");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentPoint?.address) {
      setQuery(currentPoint.address);
    } else if (!currentPoint) {
      setQuery("");
    }
  }, [currentPoint?.address, !currentPoint]);

  // Debounced autocomplete
  useEffect(() => {
    if (!query.trim() || query === currentPoint?.address) {
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
  }, [query, currentPoint?.address]);

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

  const handleFinishRename = (val?: string) => {
    setIsEditingName(false);
    const candidate = val !== undefined ? val : nameInput;
    const trimmed = candidate.trim();
    if (trimmed && onRename && trimmed !== displayName) {
      onRename(trimmed);
    } else {
      setNameInput(displayName);
    }
  };

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
          onChange?.({ lat: latitude, lng: longitude, address });
          setQuery(address);
        } catch {
          onChange?.({
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

  const badgeText = badgeLabel ?? (person ? person.name.charAt(0) : "•");
  const colorStyle = person?.color ? { backgroundColor: person.color } : undefined;
  const placeholderText =
    person?.name
      ? `Enter address or landmark for ${person.name}...`
      : badgeLabel
      ? `Enter address or landmark for Point ${badgeLabel}...`
      : `Enter address or landmark for ${displayName}...`;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${
              person?.color ? "" : colorClass
            }`}
            style={colorStyle}
          >
            {badgeText}
          </span>
          {isEditingName ? (
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={(e) => handleFinishRename(e?.target?.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleFinishRename((e.target as HTMLInputElement).value);
                } else if (e.key === "Escape") {
                  setNameInput(displayName);
                  setIsEditingName(false);
                }
              }}
              autoFocus
              data-testid="rename-input"
              className="text-xs font-semibold px-1.5 py-0.5 rounded border border-indigo-400 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          ) : (
            <div className="flex items-center gap-1">
              <span
                onClick={() => onRename && setIsEditingName(true)}
                title={onRename ? "Click to rename" : undefined}
                className={`text-xs font-semibold text-zinc-700 dark:text-zinc-300 ${
                  onRename ? "cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline" : ""
                }`}
              >
                {displayName}
              </span>
              {onRename && (
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  title="Rename person"
                  aria-label={`Rename ${displayName}`}
                  className="p-0.5 rounded text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            title="Use current GPS location"
            aria-label="Use current GPS location"
            className="p-1 rounded-md text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>
          {onTogglePinMode && (
            <button
              type="button"
              onClick={onTogglePinMode}
              title={isActivePinMode ? "Cancel pin drop" : "Drop pin on map"}
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition cursor-pointer ${
                isActivePinMode
                  ? "bg-amber-500 text-white animate-pulse"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              {isActivePinMode ? "Click Map..." : "Pin"}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Delete person"
              aria-label="Delete person"
              className="p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholderText}
          className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
        />
        <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
        {isLoading && (
          <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin absolute right-3 top-3.5" />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-h-56 overflow-y-auto py-1">
          {suggestions.map((item, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => {
                  onChange?.({ lat: item.lat, lng: item.lng, address: item.label });
                  setQuery(item.label);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition flex items-start gap-2 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <span className="truncate">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
