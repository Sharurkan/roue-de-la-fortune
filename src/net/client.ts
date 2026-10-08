import type { Peer } from 'peerjs';
import { openChannel, type Channel, type ChannelOptions } from './channel';
import type { ConnectionStatus } from './connection-status';
import { createRecoveringPeer, RETRY_DELAY_MS } from './recovering-peer';
import { peerIdFor } from './room-code';

// Without a TURN server, a blocked direct link (e.g. guest Wi-Fi) never opens
// and never fails explicitly: a timeout is the only way to notice it.
const CONNECT_TIMEOUT_MS = 10000;

export interface ClientOptions<TIn, TOut> extends ChannelOptions<TIn, TOut> {
  code: string;
  onStatus(status: ConnectionStatus): void;
}

export interface Client<TOut> {
  send(message: TOut): void;
  stop(): void;
}

/** Phone side: connects to the TV and keeps trying until it succeeds. */
export function startClient<TIn, TOut>(options: ClientOptions<TIn, TOut>): Client<TOut> {
  const hostId = peerIdFor(options.code);
  let channel: Channel<TOut> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function connect(peer: Peer): void {
    channel?.close();
    const connection = peer.connect(hostId, { reliable: true, serialization: 'json' });
    const current: Channel<TOut> = openChannel(connection, options, {
      onOpen: () => {
        clearTimeout(timeout);
        if (current === channel) options.onStatus({ kind: 'connected' });
      },
      onLost: () => {
        clearTimeout(timeout);
        if (current !== channel) return;
        channel = null;
        options.onStatus({ kind: 'disconnected' });
        scheduleRetry();
      },
    });
    channel = current;
    const timeout = setTimeout(() => {
      if (current !== channel || current.isOpen()) return;
      current.close();
      channel = null;
      options.onStatus({ kind: 'error', reason: 'timeout' });
      scheduleRetry();
    }, CONNECT_TIMEOUT_MS);
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
      if (!channel?.isOpen()) connect(peer);
    },
    onError: (type) => {
      options.onStatus({ kind: 'error', reason: type });
      // The TV is not there (yet): the peer itself is fine, only the connection is retried.
      if (type === 'peer-unavailable') scheduleRetry();
    },
  });

  return {
    send: (message) => {
      channel?.send(message);
    },
    stop: () => {
      stopped = true;
      clearTimeout(retryTimer);
      channel?.close();
      recoveringPeer.stop();
    },
  };
}
