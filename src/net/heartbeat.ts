export const HEARTBEAT_INTERVAL_MS = 5000;
/** Three missed heartbeats: the other side is considered gone. */
export const HEARTBEAT_TIMEOUT_MS = 15000;

export interface HeartbeatOptions {
  send(): void;
  onTimeout(): void;
}

export interface Heartbeat {
  /** To call on every message received: any message proves the other side is alive. */
  received(): void;
  stop(): void;
}

export function startHeartbeat(options: HeartbeatOptions): Heartbeat {
  let lastReceivedAt = Date.now();
  const timer = setInterval(() => {
    if (Date.now() - lastReceivedAt >= HEARTBEAT_TIMEOUT_MS) {
      clearInterval(timer);
      options.onTimeout();
      return;
    }
    options.send();
  }, HEARTBEAT_INTERVAL_MS);

  return {
    received: () => {
      lastReceivedAt = Date.now();
    },
    stop: () => {
      clearInterval(timer);
    },
  };
}
