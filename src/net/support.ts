import { util } from 'peerjs';

export interface WebRtcSupport {
  browser: string;
  dataChannel: boolean;
}

export function getWebRtcSupport(): WebRtcSupport {
  return {
    browser: `${util.browser} ${String(util.browserVersion)}`,
    dataChannel: util.supports.data,
  };
}
