import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS, startHeartbeat } from './heartbeat';

describe('startHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const send = vi.fn();
    const onTimeout = vi.fn();
    return { send, onTimeout, heartbeat: startHeartbeat({ send, onTimeout }) };
  }

  it('sends a heartbeat at each interval', () => {
    const { send, heartbeat } = setup();
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);
    expect(send).toHaveBeenCalledTimes(2);
    heartbeat.stop();
  });

  it('times out once when nothing is received', () => {
    const { onTimeout, send } = setup();
    vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS * 3);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(HEARTBEAT_TIMEOUT_MS / HEARTBEAT_INTERVAL_MS - 1);
  });

  it('does not time out while messages keep coming', () => {
    const { onTimeout, heartbeat } = setup();
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
      heartbeat.received();
    }
    expect(onTimeout).not.toHaveBeenCalled();
    heartbeat.stop();
  });

  it('stops sending once stopped', () => {
    const { send, onTimeout, heartbeat } = setup();
    heartbeat.stop();
    vi.advanceTimersByTime(HEARTBEAT_TIMEOUT_MS * 2);
    expect(send).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
