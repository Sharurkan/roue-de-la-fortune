import './phone.css';
import { isTestMode } from '../shared/mode';
import { startClient } from '../net/client';
import type { ConnectionStatus } from '../net/connection-status';
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '../net/room-code';
import type { PhoneAction } from '../protocol/actions';
import {
  actionMessage,
  HEARTBEAT,
  parseTvMessage,
  type PhoneMessage,
  type TvMessage,
} from '../protocol/messages';
import type { PublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { watchOnline } from '../shared/network';
import { clearRoomCode, loadRoomCode, saveRoomCode } from '../storage/room-code-store';
import { describeScreen } from './controls';
import { readCodeFromUrl, writeCodeToUrl } from './room-url';
import { renderScreen, type ConfirmableAction, type SetupDraft } from './screens';
import { messageFor, PHONE_TEXTS, statusLabel, type BannerMessage } from './texts';

/** If the TV never answers an action, buttons come back after this delay. */
const PENDING_TIMEOUT_MS = 5000;

const texts = PHONE_TEXTS;

const PHONE_ROOM_CODE_KEY = 'rdlf.phoneRoomCode';

/** The code from the QR code wins; otherwise the phone reconnects to the last TV. */
function initialCode(): string | null {
  const fromUrl = readCodeFromUrl();
  if (fromUrl !== null) return fromUrl;
  const saved = loadRoomCode(PHONE_ROOM_CODE_KEY);
  if (saved === null || !isValidRoomCode(saved)) return null;
  writeCodeToUrl(saved);
  return saved;
}

export function startPhone(root: HTMLElement): void {
  const code = initialCode();
  if (code === null) showCodeForm(root);
  else showController(root, code);
}

function showCodeForm(root: HTMLElement): void {
  const input = createElement('input', { className: 'code-input' });
  input.maxLength = ROOM_CODE_LENGTH;
  input.placeholder = texts.codePlaceholder;
  input.autocomplete = 'off';
  input.setAttribute('autocapitalize', 'characters');
  const error = createElement('p', { className: 'note error' });
  const form = createElement('form', { className: 'screen' }, [
    createElement('label', { className: 'label', text: texts.codeLabel }, [input]),
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
    createElement('main', { className: 'controller' }, [
      createElement('h1', { text: texts.title }),
      form,
    ]),
  );
  input.focus();
}

function headerText(view: PublicView): string {
  switch (view.phase) {
    case 'setup':
      return texts.setupTitle;
    case 'gameOver':
      return texts.finalRanking;
    case 'tossUp':
      return `${texts.round(view.roundNumber)} · ${texts.tossUp}`;
    case 'final': {
      const finalist = view.activeTeam === null ? undefined : view.teams[view.activeTeam];
      return texts.final(finalist?.name ?? '');
    }
    case 'playing':
    case 'roundOver': {
      const team = view.activeTeam === null ? undefined : view.teams[view.activeTeam];
      const active = team === undefined ? '' : ` · ${texts.activeTeam(team.name, team.roundScore)}`;
      return `${texts.round(view.roundNumber)}${active}`;
    }
  }
}

function showController(root: HTMLElement, code: string): void {
  const remembered = saveRoomCode(code, PHONE_ROOM_CODE_KEY);
  let view: PublicView | null = null;
  let status: ConnectionStatus = { kind: 'waiting' };
  let message: BannerMessage | null = null;
  let versionError = false;
  let online = true;
  let pending = false;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let confirming: ConfirmableAction | null = null;
  let renderedKey = '';
  const setup: SetupDraft = {
    teamCount: 2,
    names: [],
    firstRound: 1,
    testMode: isTestMode(window.location.search),
  };

  const statusElement = createElement('div', { className: 'connection' });
  const header = createElement('div', { className: 'header' });
  const messageElement = createElement('div', { className: 'message' });
  const body = createElement('div', { className: 'body' });
  const changeButton = createElement('button', {
    className: 'link-button',
    text: texts.changeCode,
  });

  function setPending(value: boolean): void {
    pending = value;
    clearTimeout(pendingTimer);
    if (value) {
      pendingTimer = setTimeout(() => {
        setPending(false);
        render();
      }, PENDING_TIMEOUT_MS);
    }
  }

  function send(action: PhoneAction): void {
    if (pending || status.kind !== 'connected') return;
    setPending(true);
    client.send(actionMessage(action));
    render();
  }

  function renderBody(current: PublicView): void {
    const screen = describeScreen(current);
    const enabled = status.kind === 'connected' && !pending && !current.busy;
    // Rebuilding the screen would wipe what is being typed: only do it when something changed.
    const key = JSON.stringify({
      screen,
      enabled,
      confirming,
      setup: [setup.teamCount, setup.firstRound],
      current,
    });
    if (key === renderedKey) return;
    renderedKey = key;
    body.replaceChildren(
      renderScreen(screen, {
        view: current,
        enabled,
        send,
        setup,
        confirming,
        askConfirmation: (action) => {
          confirming = action;
          render();
        },
        refresh: render,
      }),
    );
  }

  function render(): void {
    const problem = !online ? texts.offline : versionError ? texts.updatePage : null;
    statusElement.textContent = problem ?? statusLabel(status);
    statusElement.dataset['kind'] = problem === null ? status.kind : 'error';
    messageElement.textContent = message?.text ?? '';
    messageElement.classList.toggle('error', message?.isError ?? false);
    if (view === null) return;
    header.textContent = headerText(view);
    renderBody(view);
  }

  function receiveView(next: PublicView): void {
    view = next;
    versionError = false;
    confirming = null;
    setPending(false);
    // Toss-up letters appear every second or so: they must not wipe the last message.
    const onlyLetters = next.lastEvents.every((event) => event.type === 'tossUpLetterRevealed');
    if (next.lastEvents.length > 0 && !onlyLetters) {
      message = messageFor(next.lastEvents, (team) => next.teams[team]?.name ?? '');
    }
    render();
  }

  const client = startClient<TvMessage, PhoneMessage>({
    code,
    decode: parseTvMessage,
    heartbeat: HEARTBEAT,
    onMessage: (incoming) => {
      if (incoming.type === 'state') receiveView(incoming.view);
    },
    onInvalid: (reason) => {
      if (reason !== 'version') return;
      versionError = true;
      render();
    },
    onStatus: (next) => {
      status = next;
      setPending(false);
      render();
    },
  });

  changeButton.addEventListener('click', () => {
    client.stop();
    setPending(false);
    writeCodeToUrl(null);
    clearRoomCode(PHONE_ROOM_CODE_KEY);
    showCodeForm(root);
  });

  watchOnline((isOnline) => {
    online = isOnline;
    render();
  });
  root.replaceChildren(
    createElement('main', { className: 'controller' }, [
      createElement('div', { className: 'room', text: texts.room(code) }),
      statusElement,
      header,
      messageElement,
      body,
      ...(remembered
        ? []
        : [createElement('p', { className: 'note', text: texts.codeNotRemembered })]),
      changeButton,
    ]),
  );
  render();
}
