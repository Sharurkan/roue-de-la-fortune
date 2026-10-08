import type { DataConnection } from 'peerjs';
import { openChannel, type Channel, type ChannelOptions } from './channel';
import type { ConnectionStatus } from './connection-status';
import { createRecoveringPeer } from './recovering-peer';
import { peerIdFor } from './room-code';

/** Retries with the same code before giving up and picking a new one. */
const ID_TAKEN_MAX_RETRIES = 3;

export interface HostOptions<TIn, TOut> extends ChannelOptions<TIn, TOut> {
  code: string;
  createCode(): string;
  onCodeChange(code: string): void;
  onStatus(status: ConnectionStatus): void;
}

export interface Host<TOut> {
  send(message: TOut): void;
  stop(): void;
}

/** TV side: waits for a single controller. A new controller replaces the previous one. */
export function startHost<TIn, TOut>(options: HostOptions<TIn, TOut>): Host<TOut> {
  let code = options.code;
  let idTakenCount = 0;
  let controller: Channel<TOut> | null = null;

  function handleError(type: string): void {
    if (type === 'unavailable-id') {
      idTakenCount += 1;
      if (idTakenCount > ID_TAKEN_MAX_RETRIES) {
        idTakenCount = 0;
        code = options.createCode();
        options.onCodeChange(code);
      }
    }
    options.onStatus({ kind: 'error', reason: type });
  }

  function acceptController(connection: DataConnection): void {
    controller?.close();
    const channel: Channel<TOut> = openChannel(connection, options, {
      onOpen: () => {
        if (channel === controller) options.onStatus({ kind: 'connected' });
      },
      onLost: () => {
        if (channel !== controller) return;
        controller = null;
        options.onStatus({ kind: 'disconnected' });
      },
    });
    controller = channel;
  }

  const peer = createRecoveringPeer({
    getId: () => peerIdFor(code),
    onOpen: () => {
      idTakenCount = 0;
      options.onStatus(controller?.isOpen() ? { kind: 'connected' } : { kind: 'waiting' });
    },
    onError: handleError,
    onConnection: acceptController,
  });

  return {
    send: (message) => {
      controller?.send(message);
    },
    stop: () => {
      controller?.close();
      peer.stop();
    },
  };
}
