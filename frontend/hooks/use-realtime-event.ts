import { useEffect, useRef } from "react";
import type { DependencyList } from "react";

export interface RealtimeMessage {
  type: string;
  project_id?: number | null;
  payload?: Record<string, unknown>;
}

export interface OutgoingRealtimeMessage {
  type: string;
  project_id?: number | null;
  payload?: Record<string, unknown>;
}

export const REALTIME_EVENT_NAME = "sdlc:realtime";
export const REALTIME_OUTGOING_EVENT_NAME = "sdlc:realtime:send";

export function dispatchRealtimeMessage(message: RealtimeMessage) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<RealtimeMessage>(REALTIME_EVENT_NAME, {
      detail: message,
    })
  );
}

export function sendRealtimeMessage(message: OutgoingRealtimeMessage) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<OutgoingRealtimeMessage>(REALTIME_OUTGOING_EVENT_NAME, {
      detail: message,
    })
  );
}

export function useRealtimeEvent(
  handler: (message: RealtimeMessage) => void,
  deps: DependencyList = []
) {
  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<RealtimeMessage>;
      if (!customEvent.detail?.type) return;
      handler(customEvent.detail);
    };

    window.addEventListener(REALTIME_EVENT_NAME, listener);

    return () => {
      window.removeEventListener(REALTIME_EVENT_NAME, listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useDebouncedRealtimeEvent(
  handler: (message: RealtimeMessage) => void,
  deps: DependencyList = [],
  delay = 350,
  shouldQueue?: (message: RealtimeMessage) => boolean
) {
  const timerRef = useRef<number | null>(null);
  const lastMessageRef = useRef<RealtimeMessage | null>(null);

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<RealtimeMessage>;
      if (!customEvent.detail?.type) return;
      if (shouldQueue && !shouldQueue(customEvent.detail)) return;

      lastMessageRef.current = customEvent.detail;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;

        if (lastMessageRef.current) {
          handler(lastMessageRef.current);
        }
      }, delay);
    };

    window.addEventListener(REALTIME_EVENT_NAME, listener);

    return () => {
      window.removeEventListener(REALTIME_EVENT_NAME, listener);

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
