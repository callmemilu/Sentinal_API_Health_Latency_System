'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { createMonitor } from '@/app/actions/monitors';

export default function AddMonitorModal({ defaultEmail }: { defaultEmail?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      await createMonitor(formData);
      setIsOpen(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create monitor');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium text-xs transition-colors"
      >
        <Plus className="h-4 w-4" />
        New Monitor
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-lg font-semibold text-white">Add Synthetic Monitor</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Configure an endpoint to monitor health and latency every 60s.
            </p>

            {error && (
              <div className="mb-4 rounded-md bg-rose-500/10 border border-rose-500/20 p-2 text-xs text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Friendly Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Production Stripe Webhook"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Endpoint URL</label>
                <input
                  type="text"
                  name="url"
                  required
                  placeholder="https://api.example.com/health"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">HTTP Method</label>
                  <select
                    name="method"
                    defaultValue="GET"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Timeout (ms)</label>
                  <input
                    type="number"
                    name="timeout_ms"
                    defaultValue="5000"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Alert Email</label>
                <input
                  type="email"
                  name="notify_email"
                  defaultValue={defaultEmail}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-2 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold"
                >
                  {isSubmitting ? 'Creating...' : 'Create Monitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}