import type { DataConnection } from 'peerjs';
import { startHeartbeat, type Heartbeat } from './heartbeat';

export type Decoded<T> = { ok: true; message: T } | { ok: false; reason: string };

/** What the application gives to net/: how to read and what to send as a heartbeat. */
export interface ChannelOptions<TIn, TOut> {
  decode(data: unknown): Decoded<TIn>;
  heartbeat: TOut;
  onMessage(message: TIn): void;
  onInvalid(reason: string): void;
}

interface ChannelHandlers {
  onOpen(): void;
  /** Called once, when the link is lost (closed by the other side, error or heartbeat timeout). */
  onLost(): void;
}

export interface Channel<TOut> {
  send(message: TOut): void;
  isOpen(): boolean;
  /** Closes on purpose, without calling onLost. */
  close(): void;
}

export function openChannel<TIn, TOut>(
  connection: DataConnection,
  options: ChannelOptions<TIn, TOut>,
  handlers: ChannelHandlers,
): Channel<TOut> {
  let heartbeat: Heartbeat | null = null;
  let finished = false;

  function send(message: TOut): void {
    if (connection.open) void connection.send(message);
  }

  function shutDown(): boolean {
    if (finished) return false;
    finished = true;
    heartbeat?.stop();
    connection.close();
    return true;
  }

  function lose(): void {
    if (shutDown()) handlers.onLost();
  }

  connection.on('open', () => {
    if (finished) return;
    heartbeat = startHeartbeat({
      send: () => {
        send(options.heartbeat);
      },
      onTimeout: lose,
    });
    handlers.onOpen();
  });
  connection.on('data', (data) => {
    if (finished) return;
    heartbeat?.received();
    const decoded = options.decode(data);
    if (decoded.ok) options.onMessage(decoded.message);
    else options.onInvalid(decoded.reason);
  });
  connection.on('close', lose);
  connection.on('error', lose);

  return {
    send,
    isOpen: () => !finished && connection.open,
    close: () => {
      shutDown();
    },
  };
}
