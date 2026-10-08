import { startHost } from '../net/host';
import { decodePing, type PingMessage, type PongMessage } from './ping';
import { HEARTBEAT, type HeartbeatMessage } from '../protocol/messages';
import { generateRoomCode, isValidRoomCode } from '../net/room-code';
import { getWebRtcSupport } from '../net/support';
import { createElement } from '../shared/dom';
import { loadRoomCode, saveRoomCode } from '../storage/room-code-store';
import { createSound } from '../tv/sound';
import { statusLabel, TV_TEXTS } from './test-tv-texts';

// Separate from the game TV, so that both pages can be open without fighting over one code.
const TEST_ROOM_CODE_KEY = 'rdlf.testRoomCode';

function controllerUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}?mode=test-manette&code=${code}`;
}

function initialRoomCode(): string {
  const saved = loadRoomCode(TEST_ROOM_CODE_KEY);
  return saved !== null && isValidRoomCode(saved) ? saved : generateRoomCode(Math.random);
}

function diagnosticRow(label: string, value: string): HTMLElement {
  return createElement('li', {}, [
    createElement('span', { className: 'diag-label', text: `${label} : ` }),
    createElement('span', { text: value }),
  ]);
}

export function startTestTv(root: HTMLElement): void {
  const texts = TV_TEXTS;
  const sound = createSound();
  let pingCount = 0;

  const codeElement = createElement('div', { className: 'tv-code' });
  const urlElement = createElement('div', { className: 'tv-url' });
  const statusElement = createElement('div', { className: 'status' });
  const storageWarning = createElement('div', { className: 'warning' });
  const pingsElement = createElement('div', {
    className: 'tv-pings',
    text: texts.pingsReceived(0),
  });
  const soundButton = createElement('button', { className: 'tv-sound', text: texts.soundButton });
  const errorsList = createElement('ul', { className: 'errors' });
  const support = getWebRtcSupport();
  const yesNo = (value: boolean): string => (value ? texts.yes : texts.no);

  function showCode(code: string): void {
    codeElement.textContent = code;
    urlElement.textContent = controllerUrl(code);
    storageWarning.textContent = saveRoomCode(code, TEST_ROOM_CODE_KEY) ? '' : texts.storageFailed;
  }

  function addError(message: string): void {
    errorsList.append(createElement('li', { text: message }));
  }

  if (sound === null) {
    soundButton.disabled = true;
    soundButton.textContent = texts.soundUnavailable;
  }
  soundButton.addEventListener('click', () => {
    if (sound === null) return;
    void sound.unlock().then((unlocked) => {
      soundButton.textContent = unlocked ? texts.soundOn : texts.soundFailed;
    });
  });

  window.addEventListener('error', (event) => {
    addError(event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    addError(String(event.reason));
  });

  const code = initialRoomCode();
  showCode(code);

  const host = startHost<PingMessage, PongMessage | HeartbeatMessage>({
    code,
    createCode: () => generateRoomCode(Math.random),
    onCodeChange: showCode,
    onStatus: (status) => {
      statusElement.textContent = statusLabel(status);
      statusElement.dataset['kind'] = status.kind;
    },
    decode: decodePing,
    heartbeat: HEARTBEAT,
    onInvalid: () => undefined,
    onMessage: (ping) => {
      const pong: PongMessage = { type: 'pong', seq: ping.seq, sentAt: ping.sentAt };
      host.send(pong);
      pingCount += 1;
      pingsElement.textContent = texts.pingsReceived(pingCount);
      sound?.beep();
    },
  });

  root.replaceChildren(
    createElement('main', { className: 'tv' }, [
      createElement('h1', { text: texts.title }),
      createElement('p', { className: 'subtitle', text: texts.subtitle }),
      createElement('div', { className: 'label', text: texts.roomCodeLabel }),
      codeElement,
      createElement('div', { className: 'label', text: texts.controllerUrlLabel }),
      urlElement,
      statusElement,
      storageWarning,
      soundButton,
      pingsElement,
      createElement('h2', { text: texts.diagnosticsTitle }),
      createElement('ul', { className: 'diagnostics' }, [
        diagnosticRow(texts.diagnostics.browser, support.browser),
        diagnosticRow(texts.diagnostics.webRtc, yesNo(support.dataChannel)),
        diagnosticRow(texts.diagnostics.webAudio, yesNo(sound !== null)),
        diagnosticRow(texts.diagnostics.storage, yesNo(saveRoomCode(code, TEST_ROOM_CODE_KEY))),
        diagnosticRow(
          texts.diagnostics.screen,
          `${String(window.innerWidth)} × ${String(window.innerHeight)}`,
        ),
        diagnosticRow(texts.diagnostics.userAgent, navigator.userAgent),
      ]),
      createElement('h2', { text: texts.errorsTitle }),
      errorsList,
    ]),
  );
  soundButton.focus();
}
