"use client";

import { useEffect, useRef } from "react";

type UseLivePollingOptions = {
  enabled: boolean;
  onPoll: () => void | Promise<void>;
  intervalMs?: number;
};

export function useLivePolling({
  enabled,
  onPoll,
  intervalMs = 10_000,
}: UseLivePollingOptions) {
  const onPollRef = useRef(onPoll);
  const pollingRef = useRef(false);

  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function runPoll() {
      if (cancelled || pollingRef.current) return;

      pollingRef.current = true;

      try {
        await onPollRef.current();
      } finally {
        pollingRef.current = false;
      }
    }

    const intervalId = window.setInterval(() => {
      void runPoll();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs]);
}