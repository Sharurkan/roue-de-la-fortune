import { Peer, type DataConnection } from 'peerjs';

export const RETRY_DELAY_MS = 2000;

export interface RecoveringPeerOptions {
  /** Wanted peer ID, or undefined to let the server pick one. Read again on each recovery. */
  getId(): string | undefined;
  onOpen(peer: Peer): void;
  onError(type: string): void;
  onConnection?(connection: DataConnection): void;
}

export interface RecoveringPeer {
  current(): Peer | null;
  stop(): void;
}

/**
 * Keeps a PeerJS peer alive: after a fatal error or a lost link to the
 * signalling server, it reconnects or recreates the peer after a short delay.
 */
export function createRecoveringPeer(options: RecoveringPeerOptions): RecoveringPeer {
  let peer: Peer | null = null;
  let peerId: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function create(): void {
    peerId = options.getId();
    const created = peerId === undefined ? new Peer() : new Peer(peerId);
    peer = created;
    const isCurrent = (): boolean => created === peer;
    created.on('open', () => {
      if (isCurrent()) options.onOpen(created);
    });
    created.on('connection', (connection) => {
      if (isCurrent()) options.onConnection?.(connection);
    });
    created.on('disconnected', () => {
      if (isCurrent()) scheduleRecovery();
    });
    created.on('error', (error) => {
      if (!isCurrent()) return;
      options.onError(error.type);
      scheduleRecovery();
    });
  }

  function scheduleRecovery(): void {
    if (stopped || timer !== undefined) return;
    timer = setTimeout(recover, RETRY_DELAY_MS);
  }

  function recover(): void {
    timer = undefined;
    if (stopped || peer === null) return;
    if (peer.destroyed || options.getId() !== peerId) {
      replace();
    } else if (peer.disconnected) {
      peer.reconnect();
    }
  }

  function replace(): void {
    const old = peer;
    peer = null;
    old?.destroy();
    create();
  }

  create();

  return {
    current: () => peer,
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      const old = peer;
      peer = null;
      old?.destroy();
    },
  };
}
