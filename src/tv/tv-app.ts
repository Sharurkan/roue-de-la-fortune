import './tv.css';
import type { GameEvent } from '../game/events';
import { PHRASES } from '../game/phrases';
import { rankTeams } from '../game/ranking';
import { reduce, type GameDeps, type ReduceResult } from '../game/reducer';
import { INITIAL_STATE, type GameAction, type GameState } from '../game/state';
import type { ConnectionStatus } from '../net/connection-status';
import { startHost } from '../net/host';
import { generateRoomCode, isValidRoomCode } from '../net/room-code';
import {
  HEARTBEAT,
  parsePhoneMessage,
  stateMessage,
  type PhoneMessage,
  type TvMessage,
} from '../protocol/messages';
import { toPublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { loadGame, saveGame } from '../storage/game-store';
import { loadRoomCode, saveRoomCode } from '../storage/room-code-store';
import { createGameScreen, createRankingScreen, createSetupScreen } from './screens';
import { createSound, type Sound } from './sound';
import { eventMessage, statusLabel, TV_TEXTS } from './texts';

const GAME_DEPS: GameDeps = { random: Math.random, phrases: PHRASES };

function controllerUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}?mode=manette&code=${code}`;
}

function initialRoomCode(): string {
  const saved = loadRoomCode();
  return saved !== null && isValidRoomCode(saved) ? saved : generateRoomCode(Math.random);
}

function teamNameIn(state: GameState): (team: number) => string {
  return (team) => (state.phase === 'setup' ? '' : (state.teams[team]?.name ?? ''));
}

function bannerText(result: ReduceResult): string | null {
  const { state, events } = result;
  const messages = events
    .map((event) => eventMessage(event, teamNameIn(state)))
    .filter((message): message is string => message !== null);
  if (messages.length > 0) return messages.join(' · ');
  if (state.phase === 'playing' && state.step.kind === 'guessingConsonant') {
    return TV_TEXTS.consonantFor(state.step.amount);
  }
  return null;
}

function setupSound(sound: Sound | null, onChange: () => void): void {
  const unlock = (): void => {
    if (sound === null || sound.isUnlocked()) return;
    void sound.unlock().then(onChange);
  };
  // The Fire TV remote "OK" button arrives as Enter, or as a click on the focused button.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') unlock();
  });
  document.addEventListener('click', unlock);
}

export function startTv(root: HTMLElement): void {
  const sound = createSound();
  const setup = createSetupScreen();
  const game = createGameScreen(() => sound?.tick());
  const final = createRankingScreen();
  const corner = createElement('div', { className: 'corner' });

  const warnings = { room: '', game: '', controller: '' };
  const saved = loadGame();
  if (saved.kind === 'unreadable') warnings.game = TV_TEXTS.saveUnreadable;
  let state: GameState = saved.kind === 'loaded' ? saved.state : INITIAL_STATE;
  let code = initialRoomCode();
  let connection: ConnectionStatus = { kind: 'waiting' };
  let presentation: Promise<void> = Promise.resolve();

  function updateCorner(): void {
    const soundHint = sound !== null && !sound.isUnlocked() ? TV_TEXTS.soundHint : '';
    corner.textContent = [
      TV_TEXTS.roomCode(code),
      statusLabel(connection),
      soundHint,
      ...Object.values(warnings),
    ]
      .filter((part) => part !== '')
      .join(' · ');
    setup.soundButton.textContent = soundHint === '' ? TV_TEXTS.soundOn : TV_TEXTS.soundButton;
  }

  function showRoom(): void {
    setup.showRoom(code, controllerUrl(code));
    warnings.room = saveRoomCode(code) ? '' : TV_TEXTS.storageFailed;
    updateCorner();
  }

  function render(current: GameState): void {
    setup.element.hidden = current.phase !== 'setup';
    game.element.hidden = current.phase !== 'playing' && current.phase !== 'roundOver';
    final.element.hidden = current.phase !== 'gameOver';
    if (current.phase === 'playing' || current.phase === 'roundOver') game.render(current);
    if (current.phase === 'gameOver') final.render(current.teams, rankTeams(current.teams));
  }

  async function animate(event: GameEvent): Promise<void> {
    switch (event.type) {
      case 'wheelSpun':
        await game.wheel.spin(event.segmentIndex);
        dispatch({ type: 'spinEnded' });
        return;
      case 'letterFound':
        await game.board.reveal([event.letter], () => sound?.reveal());
        return;
      case 'letterAbsent':
      case 'wrongSolution':
        sound?.absent();
        return;
      case 'bankrupt':
        sound?.bankrupt();
        return;
      case 'roundWon':
        game.board.revealAll();
        sound?.win();
        return;
      default:
        return;
    }
  }

  async function present(result: ReduceResult): Promise<void> {
    const { state: next, events } = result;
    const isRound = next.phase === 'playing' || next.phase === 'roundOver';
    if (isRound && game.board.phrase() !== next.round.phrase.text) render(next);
    const banner = bannerText(result);
    if (banner !== null) game.showMessage(banner);
    for (const event of events) await animate(event);
    render(next);
  }

  function dispatch(action: GameAction): void {
    const result = reduce(state, action, GAME_DEPS);
    state = result.state;
    warnings.game = saveGame(state) ? '' : TV_TEXTS.saveFailed;
    updateCorner();
    host.send(stateMessage(toPublicView(state, result.events)));
    // A failed animation must not block the next ones: show the final state instead.
    presentation = presentation
      .then(() => present(result))
      .catch(() => {
        render(state);
      });
  }

  const host = startHost<PhoneMessage, TvMessage>({
    code,
    createCode: () => generateRoomCode(Math.random),
    onCodeChange: (newCode) => {
      code = newCode;
      showRoom();
    },
    onStatus: (status) => {
      connection = status;
      setup.showConnection(statusLabel(status), status.kind);
      updateCorner();
      if (status.kind !== 'connected') return;
      warnings.controller = '';
      host.send(stateMessage(toPublicView(state, [])));
    },
    decode: parsePhoneMessage,
    heartbeat: HEARTBEAT,
    onMessage: (message) => {
      if (message.type === 'action') dispatch(message.action);
    },
    onInvalid: (reason) => {
      if (reason !== 'version') return;
      warnings.controller = TV_TEXTS.updateController;
      updateCorner();
    },
  });

  setupSound(sound, updateCorner);
  root.replaceChildren(
    createElement('main', { className: 'game-tv' }, [
      setup.element,
      game.element,
      final.element,
      corner,
    ]),
  );
  showRoom();
  setup.showConnection(statusLabel(connection), connection.kind);
  render(state);
  resume();
  setup.soundButton.focus();

  /** After a reload in the middle of a round: say so, and finish a wheel spin that was cut short. */
  function resume(): void {
    if (state.phase !== 'playing' && state.phase !== 'roundOver') return;
    game.showMessage(TV_TEXTS.gameResumed);
    if (state.phase === 'playing' && state.step.kind === 'spinning') {
      const events: GameEvent[] = [{ type: 'wheelSpun', segmentIndex: state.step.segmentIndex }];
      presentation = present({ state, events });
    }
  }
}
