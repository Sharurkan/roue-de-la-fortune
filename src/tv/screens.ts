import { FINAL_PRIZES, WHEELS } from '../game/config';
import { finalRevealedLetters } from '../game/final';
import { orderByRoundScore, type RankedTeam } from '../game/ranking';
import type {
  FinalResult,
  FinalState,
  PlayingState,
  RoundOverState,
  Team,
  PocketColor,
  TossUpState,
} from '../game/state';
import { createElement } from '../shared/dom';
import { createBoard, type Board } from './board';
import { createQrCode } from './qr';
import { prizeLabel, TV_TEXTS } from './texts';
import { createWheel, envelopeFaces, segmentFaces, type Wheel } from './wheel';

export interface SetupScreen {
  element: HTMLElement;
  soundButton: HTMLButtonElement;
  showRoom(code: string, controllerUrl: string): void;
  showConnection(label: string, kind: string): void;
}

export function createSetupScreen(): SetupScreen {
  const code = createElement('div', { className: 'setup-code' });
  const qrSlot = createElement('div', { className: 'setup-qr' });
  const url = createElement('div', { className: 'setup-url' });
  const connection = createElement('div', { className: 'connection' });
  const soundButton = createElement('button', {
    className: 'sound-button',
    text: TV_TEXTS.soundButton,
  });
  const element = createElement('section', { className: 'setup' }, [
    createElement('h1', { text: TV_TEXTS.title }),
    code,
    createElement('div', { className: 'setup-join' }, [
      qrSlot,
      createElement('div', { className: 'setup-help' }, [
        createElement('p', { text: TV_TEXTS.scanToPlay }),
        createElement('p', { className: 'muted', text: TV_TEXTS.orOpen }),
        url,
      ]),
    ]),
    connection,
    createElement('p', { className: 'muted', text: TV_TEXTS.configureOnPhone }),
    soundButton,
  ]);
  return {
    element,
    soundButton,
    showRoom: (roomCode, controllerUrl) => {
      code.textContent = roomCode;
      url.textContent = controllerUrl;
      qrSlot.replaceChildren(createQrCode(controllerUrl));
    },
    showConnection: (label, kind) => {
      connection.textContent = label;
      connection.dataset['kind'] = kind;
    },
  };
}

export interface GameScreen {
  element: HTMLElement;
  board: Board;
  /** The wheel of the round on screen. */
  wheel(): Wheel;
  prizeWheel: Wheel;
  showMessage(text: string): void;
  /** Brief red flash of the whole screen. */
  flash(): void;
  /** La Bonne Poche: shows what both envelopes held. */
  openPockets(winning: PocketColor, amount: number): void;
  /** Mystery panel turned over the wheel; null hides it. */
  showMystery(text: string | null): void;
  render(state: BoardState): void;
}

export type BoardState = TossUpState | PlayingState | RoundOverState | FinalState;

/** Plays a CSS animation again, even if the class is already there. */
function restartAnimation(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  element.getBoundingClientRect(); // Forces a layout, so that the browser sees the class as new.
  element.classList.add(className);
}

function teamClass(index: number, active: number | null, out: readonly number[]): string {
  if (index === active) return 'team active';
  return out.includes(index) ? 'team out' : 'team';
}

function renderTeams(
  container: HTMLElement,
  teams: readonly Team[],
  active: number | null,
  out: readonly number[] = [],
): void {
  // The best round score comes first, like on TV.
  const ordered = orderByRoundScore(teams).flatMap((index) => {
    const team = teams[index];
    return team === undefined ? [] : [{ team, index }];
  });
  container.replaceChildren(
    ...ordered.map(({ team, index }) =>
      createElement('div', { className: teamClass(index, active, out) }, [
        createElement('div', { className: 'team-name', text: team.name }),
        createElement('div', { className: 'team-scores' }, [
          createElement('div', { className: 'team-round', text: TV_TEXTS.euros(team.roundScore) }),
          createElement('div', { className: 'team-total', text: TV_TEXTS.total(team.totalScore) }),
        ]),
      ]),
    ),
  );
}

interface Pockets {
  element: HTMLElement;
  show: (visible: boolean) => void;
  open: (winning: PocketColor, amount: number) => void;
}

/** Two big envelopes over the wheel, closed until the team picks one. */
function createPockets(): Pockets {
  const content = { red: createElement('div'), blue: createElement('div') };
  const envelope = (color: PocketColor, label: string): HTMLElement =>
    createElement('div', { className: `pocket pocket-${color}` }, [
      createElement('div', { className: 'pocket-label', text: label }),
      createElement('div', { className: 'pocket-content' }, [content[color]]),
    ]);
  const element = createElement('div', { className: 'pockets' }, [
    envelope('red', TV_TEXTS.pocketRed),
    envelope('blue', TV_TEXTS.pocketBlue),
  ]);
  element.hidden = true;
  return {
    element,
    show: (visible) => {
      element.hidden = !visible;
      if (!visible) return;
      content.red.textContent = '?';
      content.blue.textContent = '?';
    },
    open: (winning, amount) => {
      element.hidden = false;
      const prize = TV_TEXTS.euros(amount);
      content.red.textContent = winning === 'red' ? prize : TV_TEXTS.pocketEmpty;
      content.blue.textContent = winning === 'blue' ? prize : TV_TEXTS.pocketEmpty;
    },
  };
}

export function createGameScreen(onTick: () => void): GameScreen {
  const board = createBoard();
  const wheels = WHEELS.map((segments) => createWheel(segmentFaces(segments), onTick));
  const pockets = createPockets();
  const mystery = createElement('div', { className: 'mystery-panel' });
  mystery.hidden = true;
  const prizeWheel = createWheel(envelopeFaces(FINAL_PRIZES.length), onTick);
  prizeWheel.element.classList.add('prize-wheel');
  const header = createElement('header', { className: 'game-header' });
  const theme = createElement('div', { className: 'theme-tab' });
  const banner = createElement('div', { className: 'banner' });
  const teams = createElement('div', { className: 'teams' });
  const letters = createElement('div', { className: 'letters' });
  const hint = createElement('div', { className: 'game-hint muted' });
  const element = createElement('section', { className: 'game' }, [
    header,
    createElement('div', { className: 'board-frame' }, [board.element, theme]),
    createElement('div', { className: 'wheel-slot' }, [
      pockets.element,
      mystery,
      ...wheels.map((w) => w.element),
      prizeWheel.element,
    ]),
    banner,
    teams,
    letters,
    hint,
  ]);

  let currentWheel: Wheel = prizeWheel;

  /** Only one wheel is visible: the one of the round, or the envelope wheel in the final. */
  function showWheel(shown: Wheel): void {
    currentWheel = shown;
    for (const w of [...wheels, prizeWheel]) w.element.classList.toggle('is-hidden', w !== shown);
  }

  function roundWheel(roundNumber: number): Wheel {
    return wheels[Math.min(roundNumber, wheels.length) - 1] ?? prizeWheel;
  }

  function showPhrase(text: string, revealed: readonly string[]): void {
    if (board.phrase() !== text) board.setPhrase(text, revealed);
  }

  function renderFinal(state: FinalState): void {
    showWheel(prizeWheel);
    header.textContent = TV_TEXTS.finalTitle;
    theme.textContent = state.final.phrase.theme;
    showPhrase(state.final.phrase.text, finalRevealedLetters(state));
    board.element.classList.remove('won');
    renderTeams(teams, state.teams, state.finalist);
    const picked = state.final.pickedLetters.join(' ');
    letters.textContent = `${TV_TEXTS.pickedLetters} : ${picked === '' ? TV_TEXTS.noUsedLetters : picked}`;
    hint.textContent = state.step.kind === 'pickingLetters' ? TV_TEXTS.finalHint : '';
  }

  function renderTossUp(state: TossUpState): void {
    showWheel(roundWheel(state.roundNumber));
    const { tossUp } = state;
    header.textContent = TV_TEXTS.tossUp(state.roundNumber);
    theme.textContent = tossUp.phrase.theme;
    if (board.phrase() !== tossUp.phrase.text) {
      board.setPhrase(tossUp.phrase.text, [], tossUp.revealOrder.slice(0, tossUp.revealedCount));
    }
    board.element.classList.remove('won');
    renderTeams(teams, state.teams, tossUp.buzzer, tossUp.eliminated);
    letters.textContent = '';
    hint.textContent = tossUp.buzzer === null ? TV_TEXTS.tossUpHint : '';
  }

  function render(state: BoardState): void {
    if (state.phase === 'final') {
      renderFinal(state);
      return;
    }
    if (state.phase === 'tossUp') {
      renderTossUp(state);
      return;
    }
    showWheel(roundWheel(state.roundNumber));
    const { round } = state;
    header.textContent = TV_TEXTS.round(state.roundNumber);
    theme.textContent = round.phrase.theme;
    showPhrase(round.phrase.text, round.guessedLetters);
    if (state.phase === 'roundOver') board.revealAll();
    board.element.classList.toggle('won', state.phase === 'roundOver');
    renderTeams(teams, state.teams, state.phase === 'playing' ? round.activeTeam : state.winner);
    const used = round.guessedLetters.join(' ');
    letters.textContent = `${TV_TEXTS.usedLetters} : ${used === '' ? TV_TEXTS.noUsedLetters : used}`;
    const choosingPocket = state.phase === 'playing' && state.step.kind === 'choosingPocket';
    pockets.show(choosingPocket);
    hint.textContent = choosingPocket
      ? TV_TEXTS.pocketHint
      : state.phase === 'roundOver'
        ? TV_TEXTS.waitingForNextRound
        : '';
  }

  return {
    element,
    board,
    wheel: () => currentWheel,
    prizeWheel,
    showMessage: (text) => {
      banner.textContent = text;
      restartAnimation(banner, 'appear');
    },
    openPockets: pockets.open,
    showMystery: (text) => {
      mystery.hidden = text === null;
      mystery.textContent = text ?? '';
    },
    flash: () => {
      restartAnimation(element, 'flash');
    },
    render,
  };
}

export interface RankingScreen {
  element: HTMLElement;
  render(teams: readonly Team[], ranking: readonly RankedTeam[], final: FinalResult | null): void;
}

function finalResultText(teams: readonly Team[], final: FinalResult): string {
  const name = teams[final.finalist]?.name ?? '';
  const prize = FINAL_PRIZES[final.prizeIndex];
  const label = prize === undefined ? '' : prizeLabel(prize);
  return final.won ? TV_TEXTS.finalWon(name, label) : TV_TEXTS.finalLost(name, label);
}

export function createRankingScreen(): RankingScreen {
  const list = createElement('ol', { className: 'ranking' });
  const result = createElement('p', { className: 'final-result' });
  const element = createElement('section', { className: 'final' }, [
    createElement('h1', { text: TV_TEXTS.finalRanking }),
    result,
    list,
    createElement('p', { className: 'muted', text: TV_TEXTS.newGameOnPhone }),
  ]);
  return {
    element,
    render: (teams, ranking, final) => {
      result.textContent = final === null ? '' : finalResultText(teams, final);
      list.replaceChildren(
        ...ranking.map(({ team, rank }) =>
          createElement('li', { className: rank === 1 ? 'winner' : '' }, [
            createElement('span', { className: 'rank', text: TV_TEXTS.rank(rank) }),
            createElement('span', { className: 'ranking-name', text: teams[team]?.name ?? '' }),
            createElement('span', {
              className: 'ranking-total',
              text: TV_TEXTS.euros(teams[team]?.totalScore ?? 0),
            }),
          ]),
        ),
      );
    },
  };
}
