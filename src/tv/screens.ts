import { FINAL_PRIZES, WHEEL_SEGMENTS } from '../game/config';
import { finalRevealedLetters } from '../game/final';
import type { RankedTeam } from '../game/ranking';
import type { FinalResult, FinalState, PlayingState, RoundOverState, Team } from '../game/state';
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
  wheel: Wheel;
  prizeWheel: Wheel;
  showMessage(text: string): void;
  /** Brief red flash of the whole screen. */
  flash(): void;
  render(state: PlayingState | RoundOverState | FinalState): void;
}

/** Plays a CSS animation again, even if the class is already there. */
function restartAnimation(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  element.getBoundingClientRect(); // Forces a layout, so that the browser sees the class as new.
  element.classList.add(className);
}

function renderTeams(container: HTMLElement, teams: readonly Team[], active: number | null): void {
  container.replaceChildren(
    ...teams.map((team, index) =>
      createElement('div', { className: index === active ? 'team active' : 'team' }, [
        createElement('div', { className: 'team-name', text: team.name }),
        createElement('div', { className: 'team-scores' }, [
          createElement('div', { className: 'team-round', text: TV_TEXTS.euros(team.roundScore) }),
          createElement('div', { className: 'team-total', text: TV_TEXTS.total(team.totalScore) }),
        ]),
      ]),
    ),
  );
}

export function createGameScreen(onTick: () => void): GameScreen {
  const board = createBoard();
  const wheel = createWheel(segmentFaces(WHEEL_SEGMENTS), onTick);
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
    createElement('div', { className: 'wheel-slot' }, [wheel.element, prizeWheel.element]),
    banner,
    teams,
    letters,
    hint,
  ]);

  function showPhrase(text: string, revealed: readonly string[]): void {
    if (board.phrase() !== text) board.setPhrase(text, revealed);
  }

  function renderFinal(state: FinalState): void {
    wheel.element.classList.add('is-hidden');
    prizeWheel.element.classList.remove('is-hidden');
    header.textContent = TV_TEXTS.finalTitle;
    theme.textContent = state.final.phrase.theme;
    showPhrase(state.final.phrase.text, finalRevealedLetters(state));
    board.element.classList.remove('won');
    renderTeams(teams, state.teams, state.finalist);
    const picked = state.final.pickedLetters.join(' ');
    letters.textContent = `${TV_TEXTS.pickedLetters} : ${picked === '' ? TV_TEXTS.noUsedLetters : picked}`;
    hint.textContent = state.step.kind === 'pickingLetters' ? TV_TEXTS.finalHint : '';
  }

  function render(state: PlayingState | RoundOverState | FinalState): void {
    if (state.phase === 'final') {
      renderFinal(state);
      return;
    }
    wheel.element.classList.remove('is-hidden');
    prizeWheel.element.classList.add('is-hidden');
    const { round } = state;
    header.textContent = TV_TEXTS.round(state.roundNumber);
    theme.textContent = round.phrase.theme;
    showPhrase(round.phrase.text, round.guessedLetters);
    if (state.phase === 'roundOver') board.revealAll();
    board.element.classList.toggle('won', state.phase === 'roundOver');
    renderTeams(teams, state.teams, state.phase === 'playing' ? round.activeTeam : state.winner);
    const used = round.guessedLetters.join(' ');
    letters.textContent = `${TV_TEXTS.usedLetters} : ${used === '' ? TV_TEXTS.noUsedLetters : used}`;
    hint.textContent = state.phase === 'roundOver' ? TV_TEXTS.waitingForNextRound : '';
  }

  return {
    element,
    board,
    wheel,
    prizeWheel,
    showMessage: (text) => {
      banner.textContent = text;
      restartAnimation(banner, 'appear');
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
            createElement('span', { text: teams[team]?.name ?? '' }),
            createElement('span', { text: TV_TEXTS.euros(teams[team]?.totalScore ?? 0) }),
          ]),
        ),
      );
    },
  };
}
