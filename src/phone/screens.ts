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
import { PHONE_TEXTS } from './texts';

export type ConfirmableAction = 'endGame' | 'abandonGame';

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
          disabled: used || !context.enabled,
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

function solvingScreen(context: ScreenContext): HTMLElement {
  const input = createElement('input', { className: 'text-input' });
  input.autocomplete = 'off';
  const validate = createElement('button', { className: 'big-button', text: texts.validate });
  validate.disabled = !context.enabled;
  const form = createElement('form', { className: 'screen' }, [
    createElement('label', { className: 'label', text: texts.solutionLabel }, [input]),
    validate,
    cancelButton(context),
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
  endGame: { ask: texts.endGame, confirm: texts.confirmEndGame },
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

function roundOverScreen(context: ScreenContext, winner: number | null): HTMLElement {
  const name = winner === null ? '' : (context.view.teams[winner]?.name ?? '');
  const end = confirmButton(context, 'endGame');
  return createElement('div', { className: 'screen' }, [
    createElement('p', { className: 'headline', text: texts.roundWinner(name) }),
    button(
      texts.nextRound,
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

function gameOverScreen(context: ScreenContext): HTMLElement {
  const { view } = context;
  return createElement('div', { className: 'screen' }, [
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
      return solvingScreen(context);
    case 'roundOver':
      return roundOverScreen(context, screen.winner);
    case 'gameOver':
      return gameOverScreen(context);
  }
}
