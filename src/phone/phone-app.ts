import './phone.css';
import { isTestMode } from '../shared/mode';
import { startClient } from '../net/client';
import type { ConnectionStatus } from '../net/connection-status';
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '../net/room-code';
import type { PhoneAction } from '../protocol/actions';
import {
  actionMessage,
  chooseModeMessage,
  HEARTBEAT,
  helloMessage,
  joinTeamMessage,
  parseTvMessage,
  removeTeamMessage,
  type PhoneMessage,
  type TvMessage,
} from '../protocol/messages';
import type { RoomView } from '../protocol/room';
import type { PublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { watchOnline } from '../shared/network';
import { loadClientId } from '../storage/client-id-store';
import { clearRoomCode, loadRoomCode, saveRoomCode } from '../storage/room-code-store';
import { describeScreen, phoneRole } from './controls';
import { readCodeFromUrl, writeCodeToUrl } from './room-url';
import { renderScreen, type ConfirmableAction, type RoomRequest, type SetupDraft } from './screens';
import { messageFor, PHONE_TEXTS, statusLabel, type BannerMessage } from './texts';

/** If the TV never answers an action, buttons come back after this delay. */
const PENDING_TIMEOUT_MS = 5000;

const texts = PHONE_TEXTS;

const PHONE_ROOM_CODE_KEY = 'rdlf.phoneRoomCode';

/** Until the TV tells otherwise: no mode chosen, no team. */
const UNKNOWN_ROOM: RoomView = { mode: null, isMaster: false, team: null, seats: [] };

function roomMessage(request: RoomRequest): PhoneMessage {
  switch (request.type) {
    case 'chooseMode':
      return chooseModeMessage(request.mode);
    case 'joinTeam':
      return joinTeamMessage(request.name);
    case 'removeTeam':
      return removeTeamMessage(request.team);
  }
}

/**
 * Another phone joining or leaving rebuilds the screen: what is being typed and
 * the keyboard focus must survive it.
 */
function replaceKeepingInputs(
  container: HTMLElement,
  next: HTMLElement,
  sameScreen: boolean,
): void {
  const before = Array.from(container.querySelectorAll('input'));
  const focused = before.findIndex((input) => input === document.activeElement);
  container.replaceChildren(next);
  if (!sameScreen) return;
  const after = Array.from(container.querySelectorAll('input'));
  before.forEach((input, index) => {
    const target = after[index];
    if (target !== undefined && target.value === '') target.value = input.value;
  });
  if (focused >= 0) after[focused]?.focus();
}

/** With one phone per team, the team this phone plays for. */
function ownTeamName(view: PublicView, room: RoomView): string | null {
  if (room.mode !== 'multi' || room.team === null) return null;
  const inGame = view.phase === 'setup' ? undefined : view.teams[room.team]?.name;
  const joined = room.seats[room.team]?.name ?? '';
  return inGame ?? (joined === '' ? texts.teamPlaceholder(room.team) : joined);
}

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

/** With one phone, another phone took over: this one waits until asked to take over again. */
function showReplaced(root: HTMLElement, code: string): void {
  const takeOver = createElement('button', { className: 'big-button', text: texts.takeOver });
  takeOver.addEventListener('click', () => {
    showController(root, code);
  });
  root.replaceChildren(
    createElement('main', { className: 'controller' }, [
      createElement('div', { className: 'room', text: texts.room(code) }),
      createElement('p', { className: 'headline', text: texts.replaced }),
      takeOver,
    ]),
  );
}

function showController(root: HTMLElement, code: string): void {
  const remembered = saveRoomCode(code, PHONE_ROOM_CODE_KEY);
  let view: PublicView | null = null;
  const clientId = loadClientId(Math.random).id;
  let room: RoomView = UNKNOWN_ROOM;
  /** Team the master plays for, while its phone is disconnected. */
  let standingIn: number | null = null;
  let status: ConnectionStatus = { kind: 'waiting' };
  let message: BannerMessage | null = null;
  let versionError = false;
  let online = true;
  let pending = false;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let confirming: ConfirmableAction | null = null;
  let renderedKey = '';
  let renderedScreen = '';
  const setup: SetupDraft = {
    teamCount: 2,
    names: [],
    firstRound: 1,
    forcedSpin: -1,
    testMode: isTestMode(window.location.search),
    ownName: '',
  };

  const statusElement = createElement('div', { className: 'connection' });
  const header = createElement('div', { className: 'header' });
  const teamElement = createElement('div', { className: 'own-team' });
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

  function sendMessage(outgoing: PhoneMessage): void {
    if (pending || status.kind !== 'connected') return;
    setPending(true);
    client.send(outgoing);
    render();
  }

  function send(action: PhoneAction): void {
    sendMessage(actionMessage(action));
  }

  function renderBody(current: PublicView): void {
    const screen = describeScreen(current);
    const role = phoneRole(current, room, standingIn);
    const ready = status.kind === 'connected' && !pending && !current.busy;
    const enabled = ready && role.canPlay;
    const manageEnabled = ready && role.canManage;
    // Rebuilding the screen would wipe what is being typed: only do it when something changed.
    const key = JSON.stringify({
      screen,
      ready,
      enabled,
      manageEnabled,
      role,
      room,
      confirming,
      setup: [setup.teamCount, setup.firstRound],
      current,
    });
    if (key === renderedKey) return;
    renderedKey = key;
    const screenKey = JSON.stringify(screen);
    const sameScreen = screenKey === renderedScreen;
    renderedScreen = screenKey;
    replaceKeepingInputs(
      body,
      renderScreen(screen, {
        view: current,
        ready,
        enabled,
        manageEnabled,
        send,
        sendRoom: (request) => {
          sendMessage(roomMessage(request));
        },
        room,
        role,
        standIn: () => {
          standingIn = current.activeTeam;
          render();
        },
        setup,
        confirming,
        askConfirmation: (action) => {
          confirming = action;
          render();
        },
        refresh: render,
      }),
      sameScreen,
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
    const ownTeam = ownTeamName(view, room);
    teamElement.textContent = ownTeam === null ? '' : texts.yourTeam(ownTeam);
    renderBody(view);
  }

  function receiveState(next: PublicView, nextRoom: RoomView): void {
    // Standing in lasts for one turn: it stops when the turn moves on.
    if (next.activeTeam !== standingIn) standingIn = null;
    // Toss-up letters appear every second or so: they must not wipe the last message,
    // nor an abandon waiting for its confirmation.
    const onlyLetters = next.lastEvents.every((event) => event.type === 'tossUpLetterRevealed');
    const moved = view === null || next.phase !== view.phase || next.step !== view.step;
    if (moved || !onlyLetters) confirming = null;
    view = next;
    room = nextRoom;
    versionError = false;
    setPending(false);
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
      if (incoming.type === 'state') receiveState(incoming.view, incoming.room);
      if (incoming.type === 'replaced') {
        client.stop();
        setPending(false);
        showReplaced(root, code);
      }
    },
    onInvalid: (reason) => {
      if (reason !== 'version') return;
      versionError = true;
      render();
    },
    onStatus: (next) => {
      status = next;
      setPending(false);
      if (next.kind === 'connected') client.send(helloMessage(clientId));
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
      teamElement,
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
