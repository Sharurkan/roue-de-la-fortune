export type ConnectionStatus =
  | { kind: 'waiting' }
  | { kind: 'connected' }
  | { kind: 'disconnected' }
  | { kind: 'error'; reason: string };
