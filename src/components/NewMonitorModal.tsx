"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Bell, Shield, Clock, Loader2, BookmarkCheck, Code } from "lucide-react";

interface NewMonitorModalProps {
  userId?: string;
  defaultEmail?: string;
}

export default function NewMonitorModal({ userId, defaultEmail }: NewMonitorModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [headersJson, setHeadersJson] = useState("");

  const [formData, setFormData] = useState(() => ({
    name: "",
    url: "",
    method: "GET",
    timeout_ms: 5000,
    discord_webhook_url:
      typeof window !== "undefined"
        ? localStorage.getItem("sentinel_default_discord") || ""
        : "",
    notify_email:
      typeof window !== "undefined"
        ? localStorage.getItem("sentinel_default_email") || defaultEmail || ""
        : defaultEmail || "",
    consecutive_failures_threshold: 2,
  }));

  const handleOpenModal = () => {
    const savedDiscord = localStorage.getItem("sentinel_default_discord") || "";
    const savedEmail = localStorage.getItem("sentinel_default_email") || defaultEmail || "";

    setFormData((prev) => ({
      ...prev,
      discord_webhook_url: prev.discord_webhook_url || savedDiscord,
      notify_email: prev.notify_email || savedEmail,
    }));
    setIsOpen(true);
  };

  const handleSaveDefault = () => {
    localStorage.setItem("sentinel_default_discord", formData.discord_webhook_url.trim());
    localStorage.setItem("sentinel_default_email", formData.notify_email.trim());
    setDefaultSaved(true);
    setTimeout(() => setDefaultSaved(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let parsedHeaders: Record<string, string> = {};
    if (headersJson.trim()) {
      try {
        const parsed = JSON.parse(headersJson);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error();
        }
        parsedHeaders = parsed;
      } catch {
        setError('Headers must be valid JSON (e.g. {"Authorization": "Bearer token"})');
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          headers: parsedHeaders,
          user_id: userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create monitor");

      setIsOpen(false);
      setFormData((prev) => ({
        ...prev,
        name: "",
        url: "",
      }));
      setHeadersJson("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create monitor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" />
        New Monitor
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-mono">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                  New Synthetic Monitor
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-md border border-rose-900/50 bg-rose-950/30 p-2.5 text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400">Endpoint Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Auth Gateway Health"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400">Target URL</label>
                <div className="flex gap-2">
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                    className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                  <input
                    type="url"
                    required
                    placeholder="https://api.example.com/health"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="flex-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-500" />
                    Timeout Ceiling
                  </label>
                  <select
                    value={formData.timeout_ms}
                    onChange={(e) =>
                      setFormData({ ...formData, timeout_ms: Number(e.target.value) })
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value={2000}>2000 ms</option>
                    <option value={5000}>5000 ms (Standard)</option>
                    <option value={10000}>10000 ms</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400">Flap Threshold</label>
                  <select
                    value={formData.consecutive_failures_threshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        consecutive_failures_threshold: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value={1}>1 failure (Instant)</option>
                    <option value={2}>2 failures (Recommended)</option>
                    <option value={3}>3 failures (High Tolerance)</option>
                  </select>
                </div>
              </div>

              {/* Request Headers */}
              <div className="space-y-1.5">
                <label className="text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Code className="h-3 w-3 text-slate-500" />
                    Request Headers (Optional JSON)
                  </span>
                  <span className="text-[10px] text-slate-500">Bearer auth, API keys</span>
                </label>
                <textarea
                  rows={2}
                  placeholder='{"Authorization": "Bearer token", "X-Custom-Header": "value"}'
                  value={headersJson}
                  onChange={(e) => setHeadersJson(e.target.value)}
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200 placeholder-slate-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Alert Notification Channels */}
              <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                    <Bell className="h-3.5 w-3.5 text-slate-400" />
                    Alert Notification Channels
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveDefault}
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                  >
                    <BookmarkCheck className="h-3 w-3" />
                    {defaultSaved ? "Saved as Default!" : "Set as Default"}
                  </button>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-slate-500 text-[10px]">Discord Webhook URL</label>
                  <input
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={formData.discord_webhook_url}
                    onChange={(e) =>
                      setFormData({ ...formData, discord_webhook_url: e.target.value })
                    }
                    className="w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-200 placeholder-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-500 text-[10px]">Alert Email (Resend)</label>
                  <input
                    type="email"
                    placeholder="alerts@company.com"
                    value={formData.notify_email}
                    onChange={(e) =>
                      setFormData({ ...formData, notify_email: e.target.value })
                    }
                    className="w-full rounded border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-slate-200 placeholder-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md px-3.5 py-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {loading ? "Deploying..." : "Deploy Monitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}