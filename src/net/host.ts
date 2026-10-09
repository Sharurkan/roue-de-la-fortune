import type { DataConnection } from 'peerjs';
import { openChannel, type Channel, type Decoded } from './channel';
import type { ConnectionStatus } from './connection-status';
import { createRecoveringPeer } from './recovering-peer';
import { peerIdFor } from './room-code';

/** Retries with the same code before giving up and picking a new one. */
const ID_TAKEN_MAX_RETRIES = 3;

/** One phone per team plus a few reconnecting ones; anything beyond is refused. */
export const MAX_LINKS = 8;

/** Identifies one phone connection on the TV side, for as long as it lasts. */
export type LinkId = number;

export interface HostOptions<TIn, TOut> {
  code: string;
  createCode(): string;
  onCodeChange(code: string): void;
  /** Connected as soon as one phone is linked. */
  onStatus(status: ConnectionStatus): void;
  decode(data: unknown): Decoded<TIn>;
  heartbeat: TOut;
  onLinkOpen?(link: LinkId): void;
  onLinkLost?(link: LinkId): void;
  onMessage(message: TIn, link: LinkId): void;
  onInvalid(reason: string, link: LinkId): void;
}

export interface Host<TOut> {
  send(link: LinkId, message: TOut): void;
  /** Open links, oldest first. */
  links(): LinkId[];
  /** Closes a link on purpose, without calling onLinkLost. */
  close(link: LinkId): void;
  stop(): void;
}

/** TV side: accepts several phones, each on its own link. The application decides who stays. */
export function startHost<TIn, TOut>(options: HostOptions<TIn, TOut>): Host<TOut> {
  let code = options.code;
  let idTakenCount = 0;
  let nextLink: LinkId = 1;
  const channels = new Map<LinkId, Channel<TOut>>();
  let peerReady = false;

  function openLinks(): LinkId[] {
    return [...channels].filter(([, channel]) => channel.isOpen()).map(([link]) => link);
  }

  function reportStatus(lost: boolean): void {
    if (openLinks().length > 0) options.onStatus({ kind: 'connected' });
    else if (lost) options.onStatus({ kind: 'disconnected' });
    else if (peerReady) options.onStatus({ kind: 'waiting' });
  }

  function handleError(type: string): void {
    if (type === 'unavailable-id') {
      idTakenCount += 1;
      if (idTakenCount > ID_TAKEN_MAX_RETRIES) {
        idTakenCount = 0;
        code = options.createCode();
        options.onCodeChange(code);
      }
    }
    peerReady = false;
    options.onStatus({ kind: 'error', reason: type });
  }

  /** Connections that never opened would otherwise hold their place forever. */
  function dropPendingLinks(): void {
    for (const [link, channel] of channels) {
      if (channel.isOpen()) continue;
      channel.close();
      channels.delete(link);
    }
  }

  function accept(connection: DataConnection): void {
    if (channels.size >= MAX_LINKS) dropPendingLinks();
    if (channels.size >= MAX_LINKS) {
      connection.close();
      return;
    }
    const link = nextLink;
    nextLink += 1;
    const channel: Channel<TOut> = openChannel(
      connection,
      {
        decode: (data) => options.decode(data),
        heartbeat: options.heartbeat,
        onMessage: (message) => {
          options.onMessage(message, link);
        },
        onInvalid: (reason) => {
          options.onInvalid(reason, link);
        },
      },
      {
        onOpen: () => {
          options.onLinkOpen?.(link);
          reportStatus(false);
        },
        onLost: () => {
          channels.delete(link);
          reportStatus(true);
          options.onLinkLost?.(link);
        },
      },
    );
    channels.set(link, channel);
  }

  const peer = createRecoveringPeer({
    getId: () => peerIdFor(code),
    onOpen: () => {
      idTakenCount = 0;
      peerReady = true;
      reportStatus(false);
    },
    onError: handleError,
    onConnection: accept,
  });

  return {
    send: (link, message) => {
      channels.get(link)?.send(message);
    },
    links: openLinks,
    close: (link) => {
      channels.get(link)?.close();
      channels.delete(link);
      reportStatus(false);
    },
    stop: () => {
      for (const channel of channels.values()) channel.close();
      channels.clear();
      peer.stop();
    },
  };
}
