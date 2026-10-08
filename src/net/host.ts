import type { DataConnection } from 'peerjs';
import type { ConnectionStatus } from './connection-status';
import { createRecoveringPeer } from './recovering-peer';
import { peerIdFor } from './room-code';

/** Retries with the same code before giving up and picking a new one. */
const ID_TAKEN_MAX_RETRIES = 3;

export interface HostOptions {
  code: string;
  createCode(): string;
  onCodeChange(code: string): void;
  onStatus(status: ConnectionStatus): void;
  onMessage(data: unknown): void;
}

export interface Host {
  send(data: unknown): void;
  stop(): void;
}

/** TV side: waits for a single controller. A new controller replaces the previous one. */
export function startHost(options: HostOptions): Host {
  let code = options.code;
  let idTakenCount = 0;
  let controller: DataConnection | null = null;

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
    controller = connection;
    const isCurrent = (): boolean => connection === controller;
    connection.on('open', () => {
      if (isCurrent()) options.onStatus({ kind: 'connected' });
    });
    connection.on('data', (data) => {
      if (isCurrent()) options.onMessage(data);
    });
    connection.on('close', () => {
      if (!isCurrent()) return;
      controller = null;
      options.onStatus({ kind: 'disconnected' });
    });
  }

  const peer = createRecoveringPeer({
    getId: () => peerIdFor(code),
    onOpen: () => {
      idTakenCount = 0;
      options.onStatus(controller?.open ? { kind: 'connected' } : { kind: 'waiting' });
    },
    onError: handleError,
    onConnection: acceptController,
  });

  return {
    send: (data) => {
      if (controller?.open) void controller.send(data);
    },
    stop: () => {
      controller?.close();
      peer.stop();
    },
  };
}
