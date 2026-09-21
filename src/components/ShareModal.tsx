"use client";

import React, { useState } from "react";
import { X, Share2, Copy, Check, Clock, AlertCircle } from "lucide-react";
import { Person } from "@/types";

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  persons: Person[];
  query: string;
}

const EXPIRATION_OPTIONS = [
  { label: "24 Hours (Default)", value: 24, badge: "24h" },
  { label: "3 Days", value: 72, badge: "3d" },
  { label: "7 Days", value: 168, badge: "7d" },
];

export function ShareModal({ isOpen, onClose, persons, query }: ShareModalProps) {
  const [expiresInHours, setExpiresInHours] = useState<number>(24);
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateLink = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persons: persons.map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address || "",
            lat: p.lat,
            lng: p.lng,
            color: p.color,
          })),
          query,
          expiresInHours,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate share link");
      }

      const fullUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${data.shareUrl}`
          : data.shareUrl;

      setShareUrl(fullUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate share link";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const selectedOption = EXPIRATION_OPTIONS.find((o) => o.value === expiresInHours);
  const expiryLabel =
    expiresInHours === 24 ? "24 hours" : expiresInHours === 72 ? "3 days" : "7 days";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Share Search
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Link Expiration
            </label>
            <div className="grid grid-cols-3 gap-2">
              {EXPIRATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setExpiresInHours(opt.value);
                    setShareUrl("");
                  }}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition ${
                    expiresInHours === opt.value
                      ? "border-indigo-500 bg-indigo-50/50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 ring-1 ring-indigo-500"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <Clock className="w-4 h-4 mb-1 text-zinc-400" />
                  <span>{opt.label.split(" ")[0]} {opt.label.split(" ")[1] || ""}</span>
                  {opt.value === 24 && (
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-normal">
                      Default
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!shareUrl ? (
            <button
              type="button"
              onClick={handleGenerateLink}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Generating Link...</span>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Generate Share Link</span>
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Shareable URL (Expires in {expiryLabel})
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>This temporary link will expire in {expiryLabel}.</span>
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
