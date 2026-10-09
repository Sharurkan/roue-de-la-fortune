import {
  CONSONANTS,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  VOWEL_COST,
  VOWELS,
} from '../game/config';
import type { PhoneAction } from '../protocol/actions';
import type { PublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { letterKeys, teamNamesFor, type PhoneScreen } from './controls';
import { PHONE_TEXTS, prizeLabel } from './texts';

export type ConfirmableAction = 'abandonGame';

export interface SetupDraft {
  teamCount: number;
  names: string[];
}

export interface ScreenContext {
  view: PublicView;
  /** False while disconnected or while waiting for the TV to answer the last action. */
  enabled: boolean;
  send: (action: PhoneAction) => void;
  setup: SetupDraft;
  /** Irreversible action waiting for a second tap, if any. */
  confirming: ConfirmableAction | null;
  askConfirmation: (action: ConfirmableAction) => void;
  refresh: () => void;
}

const texts = PHONE_TEXTS;

function button(
  text: string,
  onClick: () => void,
  options: { disabled?: boolean; className?: string } = {},
): HTMLButtonElement {
  const element = createElement('button', { className: options.className ?? 'big-button', text });
  element.type = 'button';
  element.disabled = options.disabled ?? false;
  element.addEventListener('click', onClick);
  return element;
}

function note(text: string): HTMLElement {
  return createElement('p', { className: 'note', text });
}

function setupScreen(context: ScreenContext): HTMLElement {
  const { setup } = context;
  const counts = Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i);
  const countButtons = counts.map((count) =>
    button(
      String(count),
      () => {
        setup.teamCount = count;
        context.refresh();
      },
      { className: count === setup.teamCount ? 'choice selected' : 'choice' },
    ),
  );
  const inputs = Array.from({ length: setup.teamCount }, (_, index) => {
    const input = createElement('input', { className: 'text-input' });
    input.maxLength = MAX_TEAM_NAME_LENGTH;
    input.placeholder = texts.teamPlaceholder(index);
    input.value = setup.names[index] ?? '';
    input.addEventListener('input', () => {
      setup.names[index] = input.value;
    });
    return input;
  });
  const start = (): void => {
    context.send({ type: 'startGame', teamNames: teamNamesFor(setup.names, setup.teamCount) });
  };
  return createElement('div', { className: 'screen' }, [
    createElement('p', { className: 'label', text: texts.teamCount }),
    createElement('div', { className: 'choices' }, countButtons),
    ...inputs,
    button(texts.start, start, { disabled: !context.enabled }),
  ]);
}

function turnButtons(
  context: ScreenContext,
  canSpin: boolean,
  canBuyVowel: boolean,
): HTMLElement[] {
  const { enabled, send } = context;
  return [
    button(
      texts.spin,
      () => {
        send({ type: 'spin' });
      },
      { disabled: !enabled || !canSpin },
    ),
    button(
      texts.buyVowel(VOWEL_COST),
      () => {
        send({ type: 'buyVowel' });
      },
      {
        disabled: !enabled || !canBuyVowel,
      },
    ),
    button(
      texts.solve,
      () => {
        send({ type: 'startSolving' });
      },
      { disabled: !enabled },
    ),
  ];
}

function keyboard(
  context: ScreenContext,
  letters: string,
  toAction: (letter: string) => PhoneAction,
  locked = false,
): HTMLElement {
  return createElement(
    'div',
    { className: 'keyboard' },
    letterKeys(letters, context.view.guessedLetters).map(({ letter, used }) =>
      button(
        letter,
        () => {
          context.send(toAction(letter));
        },
        {
          className: 'key',
          disabled: used || locked || !context.enabled,
        },
      ),
    ),
  );
}

function cancelButton(context: ScreenContext): HTMLButtonElement {
  return button(
    texts.cancel,
    () => {
      context.send({ type: 'cancel' });
    },
    {
      className: 'secondary-button',
      disabled: !context.enabled,
    },
  );
}

/** The final and the toss-up allow a single try: no way back, so no cancel button. */
function solvingScreen(context: ScreenContext, label: string, canCancel: boolean): HTMLElement {
  const input = createElement('input', { className: 'text-input' });
  input.autocomplete = 'off';
  const validate = createElement('button', { className: 'big-button', text: texts.validate });
  validate.disabled = !context.enabled;
  const form = createElement('form', { className: 'screen' }, [
    createElement('label', { className: 'label', text: label }, [input]),
    validate,
    ...(canCancel ? [cancelButton(context)] : []),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    context.send({ type: 'submitSolution', answer: input.value });
  });
  setTimeout(() => {
    input.focus();
  }, 0);
  return form;
}

const CONFIRMATION_LABELS: Record<ConfirmableAction, { ask: string; confirm: string }> = {
  abandonGame: { ask: texts.abandonGame, confirm: texts.confirmAbandonGame },
};

/** First tap asks, second tap sends: for actions that cannot be undone. */
function confirmButton(context: ScreenContext, action: ConfirmableAction): HTMLButtonElement {
  const labels = CONFIRMATION_LABELS[action];
  if (context.confirming === action) {
    return button(
      labels.confirm,
      () => {
        context.send({ type: action });
      },
      { className: 'danger-button', disabled: !context.enabled },
    );
  }
  return button(
    labels.ask,
    () => {
      context.askConfirmation(action);
    },
    { className: 'secondary-button', disabled: !context.enabled },
  );
}

/** One phone for everyone: players shout, and the phone holder taps the fastest team. */
function buzzScreen(context: ScreenContext, eliminatedTeams: readonly number[]): HTMLElement {
  const teams = context.view.teams.map((team, index) =>
    button(
      team.name,
      () => {
        context.send({ type: 'buzz', team: index });
      },
      {
        className: 'big-button buzz-button',
        disabled: !context.enabled || eliminatedTeams.includes(index),
      },
    ),
  );
  return createElement('div', { className: 'screen' }, [
    createElement('p', { className: 'headline', text: texts.whoBuzzed }),
    note(texts.buzzHint),
    ...teams,
    confirmButton(context, 'abandonGame'),
  ]);
}

function roundOverScreen(
  context: ScreenContext,
  winner: number | null,
  isLastRound: boolean,
): HTMLElement {
  const name = winner === null ? '' : (context.view.teams[winner]?.name ?? '');
  const end = confirmButton(context, 'abandonGame');
  return createElement('div', { className: 'screen' }, [
    createElement('p', { className: 'headline', text: texts.roundWinner(name) }),
    button(
      isLastRound ? texts.toFinal : texts.nextRound,
      () => {
        context.send({ type: 'nextRound' });
      },
      {
        disabled: !context.enabled,
      },
    ),
    end,
  ]);
}

function finalResultLine(view: PublicView): HTMLElement[] {
  const result = view.finalResult;
  if (result === null) return [];
  const name = view.teams[result.finalist]?.name ?? '';
  const prize = prizeLabel(result.prize);
  const text = result.won ? texts.finalWon(name, prize) : texts.finalLost(name, prize);
  return [createElement('p', { className: 'headline', text })];
}

function prizeWheelScreen(context: ScreenContext, spinning: boolean): HTMLElement {
  return createElement('div', { className: 'screen' }, [
    ...(spinning ? [createElement('p', { className: 'headline', text: texts.prizeSpinning })] : []),
    button(
      texts.spinPrizeWheel,
      () => {
        context.send({ type: 'spin' });
      },
      { disabled: spinning || !context.enabled },
    ),
    confirmButton(context, 'abandonGame'),
  ]);
}

function finalPickingScreen(
  context: ScreenContext,
  consonantsLeft: number,
  vowelsLeft: number,
): HTMLElement {
  return createElement('div', { className: 'screen' }, [
    createElement('p', {
      className: 'headline',
      text: texts.finalPicks(consonantsLeft, vowelsLeft),
    }),
    keyboard(
      context,
      CONSONANTS,
      (letter) => ({ type: 'guessConsonant', letter }),
      consonantsLeft === 0,
    ),
    keyboard(context, VOWELS, (letter) => ({ type: 'guessVowel', letter }), vowelsLeft === 0),
  ]);
}

function gameOverScreen(context: ScreenContext): HTMLElement {
  const { view } = context;
  return createElement('div', { className: 'screen' }, [
    ...finalResultLine(view),
    createElement(
      'ol',
      { className: 'phone-ranking' },
      view.ranking.map(({ team, rank }) =>
        createElement('li', {
          text: `${texts.rank(rank)} ${view.teams[team]?.name ?? ''} : ${texts.euros(view.teams[team]?.totalScore ?? 0)}`,
        }),
      ),
    ),
    button(
      texts.newGame,
      () => {
        context.send({ type: 'newGame' });
      },
      { disabled: !context.enabled },
    ),
  ]);
}

export function renderScreen(screen: PhoneScreen, context: ScreenContext): HTMLElement {
  switch (screen.kind) {
    case 'setup':
      return setupScreen(context);
    case 'buzzing':
      return buzzScreen(context, screen.eliminatedTeams);
    case 'tossUpSolving':
      return solvingScreen(
        context,
        texts.tossUpAnswer(context.view.teams[screen.team]?.name ?? ''),
        false,
      );
    case 'turn':
      return createElement('div', { className: 'screen' }, [
        ...turnButtons(context, screen.canSpin, screen.canBuyVowel),
        ...(screen.noMoreConsonants ? [note(texts.noMoreConsonants)] : []),
        ...(screen.noMoreVowels ? [note(texts.noMoreVowels)] : []),
        confirmButton(context, 'abandonGame'),
      ]);
    case 'spinning':
      return createElement('div', { className: 'screen' }, [
        createElement('p', { className: 'headline', text: texts.spinning }),
        ...turnButtons({ ...context, enabled: false }, false, false),
      ]);
    case 'consonant':
      return createElement('div', { className: 'screen' }, [
        createElement('p', { className: 'headline', text: texts.chooseConsonant(screen.value) }),
        keyboard(context, CONSONANTS, (letter) => ({ type: 'guessConsonant', letter })),
      ]);
    case 'vowel':
      return createElement('div', { className: 'screen' }, [
        createElement('p', { className: 'headline', text: texts.chooseVowel }),
        keyboard(context, VOWELS, (letter) => ({ type: 'guessVowel', letter })),
        cancelButton(context),
      ]);
    case 'solving':
      return solvingScreen(context, texts.solutionLabel, true);
    case 'roundOver':
      return roundOverScreen(context, screen.winner, screen.isLastRound);
    case 'prizeWheel':
      return prizeWheelScreen(context, false);
    case 'prizeSpinning':
      return prizeWheelScreen(context, true);
    case 'finalPicking':
      return finalPickingScreen(context, screen.consonantsLeft, screen.vowelsLeft);
    case 'finalSolving':
      return solvingScreen(context, texts.finalAnswer, false);
    case 'gameOver':
      return gameOverScreen(context);
  }
}
