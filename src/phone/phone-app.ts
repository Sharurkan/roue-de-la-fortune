import { startClient } from '../net/client';
import type { ConnectionStatus } from '../net/connection-status';
import { decodePong, type PingMessage, type PongMessage } from '../net/ping';
import { HEARTBEAT, type HeartbeatMessage } from '../protocol/messages';
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '../net/room-code';
import { createElement } from '../shared/dom';
import { PHONE_TEXTS, statusLabel } from './texts';

const CODE_PARAM = 'code';

function readCodeFromUrl(): string | null {
  const raw = new URLSearchParams(window.location.search).get(CODE_PARAM);
  if (raw === null) return null;
  const code = normalizeRoomCode(raw);
  return isValidRoomCode(code) ? code : null;
}

/** Keeps the code in the URL so that a reload reconnects to the same TV. */
function writeCodeToUrl(code: string | null): void {
  const url = new URL(window.location.href);
  if (code === null) url.searchParams.delete(CODE_PARAM);
  else url.searchParams.set(CODE_PARAM, code);
  window.history.replaceState(null, '', url.toString());
}

export function startPhone(root: HTMLElement): void {
  const code = readCodeFromUrl();
  if (code === null) showCodeForm(root);
  else showController(root, code);
}

function showCodeForm(root: HTMLElement): void {
  const texts = PHONE_TEXTS;
  const input = createElement('input', { className: 'code-input' });
  input.maxLength = ROOM_CODE_LENGTH;
  input.placeholder = texts.codePlaceholder;
  input.autocomplete = 'off';
  input.setAttribute('autocapitalize', 'characters');
  const error = createElement('div', { className: 'warning' });
  const form = createElement('form', { className: 'code-form' }, [
    createElement('label', { text: texts.codeLabel }, [input]),
    createElement('button', { className: 'big-button', text: texts.connect }),
    error,
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = normalizeRoomCode(input.value);
    if (!isValidRoomCode(code)) {
      error.textContent = texts.invalidCode;
      return;
    }
    writeCodeToUrl(code);
    showController(root, code);
  });

  root.replaceChildren(
    createElement('main', { className: 'phone' }, [
      createElement('h1', { text: texts.title }),
      form,
    ]),
  );
  input.focus();
}

function showController(root: HTMLElement, code: string): void {
  const texts = PHONE_TEXTS;
  let seq = 0;
  let pongCount = 0;

  const statusElement = createElement('div', { className: 'status' });
  const pingButton = createElement('button', { className: 'big-button', text: texts.ping });
  const pongsElement = createElement('div', { text: texts.pongs(0) });
  const latencyElement = createElement('div');
  const changeButton = createElement('button', {
    className: 'link-button',
    text: texts.changeCode,
  });

  function showStatus(status: ConnectionStatus): void {
    statusElement.textContent = statusLabel(status);
    statusElement.dataset['kind'] = status.kind;
    pingButton.disabled = status.kind !== 'connected';
  }

  const client = startClient<PongMessage, PingMessage | HeartbeatMessage>({
    code,
    onStatus: showStatus,
    decode: decodePong,
    heartbeat: HEARTBEAT,
    onInvalid: () => undefined,
    onMessage: (pong) => {
      pongCount += 1;
      pongsElement.textContent = texts.pongs(pongCount);
      latencyElement.textContent = texts.latency(performance.now() - pong.sentAt);
    },
  });

  pingButton.addEventListener('click', () => {
    seq += 1;
    const ping: PingMessage = { type: 'ping', seq, sentAt: performance.now() };
    client.send(ping);
  });
  changeButton.addEventListener('click', () => {
    client.stop();
    writeCodeToUrl(null);
    showCodeForm(root);
  });

  showStatus({ kind: 'waiting' });
  root.replaceChildren(
    createElement('main', { className: 'phone' }, [
      createElement('h1', { text: texts.title }),
      createElement('div', { className: 'room', text: texts.room(code) }),
      statusElement,
      pingButton,
      pongsElement,
      latencyElement,
      changeButton,
    ]),
  );
}
