import './tv.css';
import type { GameEvent } from '../game/events';
import { TOSS_UP_REVEAL_INTERVAL_MS } from '../game/config';
import { FINAL_PHRASES, PHRASES, TOSS_UP_PHRASES } from '../game/phrases';
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
import { watchOnline } from '../shared/network';
import { loadGame, saveGame } from '../storage/game-store';
import { loadRoomCode, saveRoomCode } from '../storage/room-code-store';
import { createGameScreen, createRankingScreen, createSetupScreen } from './screens';
import { createSound, type Sound } from './sound';
import { keepScreenOn } from './wake-lock';
import { eventMessage, statusLabel, TV_TEXTS } from './texts';

const GAME_DEPS: GameDeps = {
  random: Math.random,
  phrases: PHRASES,
  finalPhrases: FINAL_PHRASES,
  tossUpPhrases: TOSS_UP_PHRASES,
};
/** After the final answer, the whole board and the envelope stay on screen a while. */
const FINAL_RESULT_PAUSE_MS = 6000;
/** After the toss-up, its answer stays on screen before the round board appears. */
const TOSS_UP_RESULT_PAUSE_MS = 3000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The phrase shown on the board, if the state has one. */
function boardPhrase(state: GameState): string | null {
  switch (state.phase) {
    case 'tossUp':
      return state.tossUp.phrase.text;
    case 'playing':
    case 'roundOver':
      return state.round.phrase.text;
    case 'final':
      return state.final.phrase.text;
    case 'setup':
    case 'gameOver':
      return null;
  }
}

function controllerUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}?mode=manette&code=${code}`;
}

function initialRoomCode(): string {
  const saved = loadRoomCode();
  return saved !== null && isValidRoomCode(saved) ? saved : generateRoomCode(Math.random);
}

/** A wheel that was spinning when the page was reloaded: spin it again to the same result. */
function interruptedSpin(state: GameState): GameEvent[] {
  if (state.phase === 'playing' && state.step.kind === 'spinning') {
    return [{ type: 'wheelSpun', segmentIndex: state.step.segmentIndex }];
  }
  if (state.phase === 'final' && state.step.kind === 'prizeSpinning') {
    const { prizeIndex } = state.final;
    return prizeIndex === null ? [] : [{ type: 'prizeWheelSpun', prizeIndex }];
  }
  return [];
}

/** Toss-up letters keep coming until a team buzzes or the board is full. */
function needsTossUpLetter(state: GameState): boolean {
  return (
    state.phase === 'tossUp' &&
    state.tossUp.buzzer === null &&
    state.tossUp.revealedCount < state.tossUp.revealOrder.length
  );
}

/** Events whose animation takes time: the phone waits for the TV until they are over. */
function isSlow(event: GameEvent): boolean {
  switch (event.type) {
    case 'wheelSpun':
    case 'prizeWheelSpun':
    case 'letterFound':
    case 'finalLettersGiven':
    case 'finalLettersRevealed':
    case 'finalWon':
    case 'finalLost':
    case 'tossUpWon':
    case 'tossUpFailed':
      return true;
    default:
      return false;
  }
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

  const warnings = { offline: '', room: '', game: '', controller: '' };
  const saved = loadGame();
  if (saved.kind === 'unreadable') warnings.game = TV_TEXTS.saveUnreadable;
  let state: GameState = saved.kind === 'loaded' ? saved.state : INITIAL_STATE;
  let code = initialRoomCode();
  let connection: ConnectionStatus = { kind: 'waiting' };
  let presentation: Promise<void> = Promise.resolve();
  let tossUpTimer: ReturnType<typeof setTimeout> | undefined;
  /** Slow animations queued or playing on the TV. */
  let slowAnimations = 0;

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
    game.element.hidden = boardPhrase(current) === null;
    final.element.hidden = current.phase !== 'gameOver';
    if (current.phase !== 'setup' && current.phase !== 'gameOver') game.render(current);
    if (current.phase === 'gameOver') {
      final.render(current.teams, rankTeams(current.teams), current.final);
    }
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
        game.flash();
        return;
      case 'roundStarted':
      case 'tossUpStarted':
        sound?.roundStart();
        return;
      case 'tossUpLetterRevealed':
        game.board.revealTile(event.tileIndex);
        sound?.pop();
        return;
      case 'buzzed':
        sound?.buzz();
        return;
      case 'tossUpWrong':
        sound?.absent();
        return;
      case 'tossUpWon':
      case 'tossUpFailed':
        game.board.revealAll();
        if (event.type === 'tossUpWon') sound?.win();
        await wait(TOSS_UP_RESULT_PAUSE_MS);
        return;
      case 'roundWon':
        game.board.revealAll();
        sound?.win();
        return;
      case 'finalStarted':
        sound?.roundStart();
        return;
      case 'prizeWheelSpun':
        await game.prizeWheel.spin(event.prizeIndex);
        dispatch({ type: 'spinEnded' });
        return;
      case 'finalLettersGiven':
      case 'finalLettersRevealed':
        await game.board.reveal(event.letters, () => sound?.reveal());
        return;
      case 'finalWon':
      case 'finalLost':
        game.board.revealAll();
        if (event.type === 'finalWon') sound?.win();
        else sound?.absent();
        await wait(FINAL_RESULT_PAUSE_MS);
        return;
      default:
        return;
    }
  }

  async function present(result: ReduceResult): Promise<void> {
    const { state: next, events } = result;
    const phrase = boardPhrase(next);
    // The toss-up answer is shown first: the new round board comes after the pause.
    const endsTossUp = events.some((e) => e.type === 'tossUpWon' || e.type === 'tossUpFailed');
    if (phrase !== null && game.board.phrase() !== phrase && !endsTossUp) render(next);
    const banner = bannerText(result);
    if (banner !== null) game.showMessage(banner);
    for (const event of events) await animate(event);
    render(next);
  }

  /** Waits for the animations, then shows the next toss-up letter if nobody has buzzed. */
  function scheduleTossUpLetter(): void {
    clearTimeout(tossUpTimer);
    if (!needsTossUpLetter(state)) return;
    tossUpTimer = setTimeout(() => {
      if (needsTossUpLetter(state)) dispatch({ type: 'revealTossUpLetter' });
    }, TOSS_UP_REVEAL_INTERVAL_MS);
  }

  function sendView(events: readonly GameEvent[]): void {
    host.send(stateMessage(toPublicView(state, events, slowAnimations > 0)));
  }

  /** Queues the animations of a result. The phone is told when the slow ones are over. */
  function queuePresentation(result: ReduceResult): void {
    const slow = result.events.some(isSlow);
    if (slow) slowAnimations += 1;
    // A failed animation must not block the next ones: show the final state instead.
    presentation = presentation
      .then(() => present(result))
      .catch(() => {
        render(state);
      })
      .then(() => {
        if (slow) {
          slowAnimations -= 1;
          if (slowAnimations === 0) sendView([]);
        }
        scheduleTossUpLetter();
      });
  }

  function dispatch(action: GameAction): void {
    clearTimeout(tossUpTimer);
    const result = reduce(state, action, GAME_DEPS);
    state = result.state;
    warnings.game = saveGame(state) ? '' : TV_TEXTS.saveFailed;
    updateCorner();
    // Queued first, so that this view already says whether the TV is busy.
    queuePresentation(result);
    sendView(result.events);
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
      sendView([]);
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
  keepScreenOn();
  watchOnline((online) => {
    warnings.offline = online ? '' : TV_TEXTS.offline;
    updateCorner();
  });
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
    if (boardPhrase(state) === null) return;
    game.showMessage(TV_TEXTS.gameResumed);
    const events = interruptedSpin(state);
    if (events.length > 0) queuePresentation({ state, events });
    scheduleTossUpLetter();
  }
}
