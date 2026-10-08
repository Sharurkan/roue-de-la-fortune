import type { DataConnection, Peer } from 'peerjs';
import type { ConnectionStatus } from './connection-status';
import { createRecoveringPeer, RETRY_DELAY_MS } from './recovering-peer';
import { peerIdFor } from './room-code';

// Without a TURN server, a blocked direct link (e.g. guest Wi-Fi) never opens
// and never fails explicitly: a timeout is the only way to notice it.
const CONNECT_TIMEOUT_MS = 10000;

export interface ClientOptions {
  code: string;
  onStatus(status: ConnectionStatus): void;
  onMessage(data: unknown): void;
}

export interface Client {
  send(data: unknown): void;
  stop(): void;
}

/** Phone side: connects to the TV and keeps trying until it succeeds. */
export function startClient(options: ClientOptions): Client {
  const hostId = peerIdFor(options.code);
  let connection: DataConnection | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function connect(peer: Peer): void {
    connection?.close();
    const created = peer.connect(hostId, { reliable: true });
    connection = created;
    const isCurrent = (): boolean => created === connection;
    const timeout = setTimeout(() => {
      if (!isCurrent() || created.open) return;
      options.onStatus({ kind: 'error', reason: 'timeout' });
      scheduleRetry();
    }, CONNECT_TIMEOUT_MS);

    created.on('open', () => {
      clearTimeout(timeout);
      if (isCurrent()) options.onStatus({ kind: 'connected' });
    });
    created.on('data', (data) => {
      if (isCurrent()) options.onMessage(data);
    });
    created.on('close', () => {
      clearTimeout(timeout);
      if (!isCurrent()) return;
      options.onStatus({ kind: 'disconnected' });
      scheduleRetry();
    });
  }

  function scheduleRetry(): void {
    if (stopped || retryTimer !== undefined) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      const peer = recoveringPeer.current();
      if (!stopped && peer?.open) connect(peer);
    }, RETRY_DELAY_MS);
  }

  const recoveringPeer = createRecoveringPeer({
    getId: () => undefined,
    onOpen: (peer) => {
      if (!connection?.open) connect(peer);
    },
    onError: (type) => {
      options.onStatus({ kind: 'error', reason: type });
      // The TV is not there (yet): the peer itself is fine, only the connection is retried.
      if (type === 'peer-unavailable') scheduleRetry();
    },
  });

  return {
    send: (data) => {
      if (connection?.open) void connection.send(data);
    },
    stop: () => {
      stopped = true;
      clearTimeout(retryTimer);
      connection?.close();
      recoveringPeer.stop();
    },
  };
}
