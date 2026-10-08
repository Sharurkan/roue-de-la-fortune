// Temporary messages for the Fire TV Stick test. Replaced by the zod protocol in phase 3.
export interface PingMessage {
  type: 'ping';
  seq: number;
  sentAt: number;
}

export interface PongMessage {
  type: 'pong';
  seq: number;
  sentAt: number;
}

function parseTimed<T extends 'ping' | 'pong'>(
  data: unknown,
  type: T,
): { type: T; seq: number; sentAt: number } | null {
  if (typeof data !== 'object' || data === null) return null;
  if (!('type' in data && 'seq' in data && 'sentAt' in data)) return null;
  const { seq, sentAt } = data;
  if (data.type !== type || typeof seq !== 'number' || typeof sentAt !== 'number') return null;
  if (!Number.isFinite(seq) || !Number.isFinite(sentAt)) return null;
  return { type, seq, sentAt };
}

export function parsePing(data: unknown): PingMessage | null {
  return parseTimed(data, 'ping');
}

export function parsePong(data: unknown): PongMessage | null {
  return parseTimed(data, 'pong');
}
