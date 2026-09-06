"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMonitor, pingSingleMonitor } from "@/app/actions/monitors";
import { Play, Trash2, Loader2 } from "lucide-react";

export default function CardActions({ monitorId }: { monitorId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionType, setActionType] = useState<"ping" | "delete" | null>(null);

  const handlePing = async () => {
    setActionType("ping");
    try {
      // 1. Await the database write directly on the server
      await pingSingleMonitor(monitorId);
      
      // 2. Trigger client re-fetch inside transition
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("Manual ping failed:", err);
      alert("Failed to ping endpoint.");
    } finally {
      setActionType(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this monitor and its history?")) return;
    setActionType("delete");
    try {
      await deleteMonitor(monitorId);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete monitor.");
    } finally {
      setActionType(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePing}
        disabled={isPending}
        title="Check Now"
        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition-colors disabled:opacity-50"
      >
        {actionType === "ping" || isPending ? (
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>

      <button
        onClick={handleDelete}
        disabled={isPending}
        title="Delete Monitor"
        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-50"
      >
        {actionType === "delete" ? (
          <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}