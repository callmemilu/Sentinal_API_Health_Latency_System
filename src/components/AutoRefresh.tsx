"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  intervalMs?: number;
}

export default function AutoRefresh({ intervalMs = 30000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const startTimer = () => {
      timer = setInterval(() => {
        // Only refresh if the user is actively viewing this tab
        if (document.visibilityState === "visible") {
          router.refresh();
        }
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh(); // Immediate fresh fetch upon returning to the tab
      }
    };

    startTimer();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router, intervalMs]);

  return null;
}