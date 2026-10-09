import {
  CONSONANTS,
  DEFAULT_TEAM_NAME_PREFIX,
  MAX_TEAM_NAME_LENGTH,
  ROUND_COUNT,
  MAX_TEAMS,
  MIN_TEAMS,
  VOWEL_COST,
  VOWELS,
  type TeamEffect,
} from '../game/config';
import type { PhoneAction } from '../protocol/actions';
import type { PlayMode, RoomView } from '../protocol/room';
import type { PublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import {
  forcedSpinOptions,
  letterKeys,
  teamNamesFor,
  type PhoneRole,
  type PhoneScreen,
} from './controls';
import { PHONE_TEXTS, prizeLabel } from './texts';

export type ConfirmableAction = 'abandonGame';

export interface SetupDraft {
  teamCount: number;
  names: string[];
  /** Only offered in test mode. */
  firstRound: number;
  /** Test mode: index in the forced spin options, or -1 for a random spin. */
  forcedSpin: number;
  testMode: boolean;
  /** Name typed to join with one phone per team. */
  ownName: string;
}

/** Messages that change the room rather than the game. */
export type RoomRequest =
  | { type: 'chooseMode'; mode: PlayMode }
  | { type: 'joinTeam'; name: string }
  | { type: 'removeTeam'; team: number };

export interface ScreenContext {
  view: PublicView;
  /** False while disconnected or while waiting for the TV to answer or animate. */
  ready: boolean;
  /** Ready, and this phone may play the turn. */
  enabled: boolean;
  /** Ready, and this phone may run the game (start, next round, abandon, new game). */
  manageEnabled: boolean;
  send: (action: PhoneAction) => void;
  sendRoom: (request: RoomRequest) => void;
  room: RoomView;
  role: PhoneRole;
  standIn: () => void;
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

/** Time to fill the gauge, holding the button down. */
const GAUGE_FILL_MS = 1500;

/**
 * Hold to fill the gauge, release to spin: the longer the hold, the stronger
 * the spin. Without a hold (keyboard), the force is left to the TV.
 */
function powerButton(
  text: string,
  onRelease: (power: number | undefined) => void,
  disabled: boolean,
): HTMLButtonElement {
  const fill = createElement('span', { className: 'gauge-fill' });
  const label = createElement('span', { className: 'gauge-label', text });
  const element = createElement('button', { className: 'big-button power-button' }, [fill, label]);
  element.type = 'button';
  element.disabled = disabled;
  let startedAt: number | null = null;
  const power = (now: number): number =>
    startedAt === null ? 0 : Math.min((now - startedAt) / GAUGE_FILL_MS, 1);
  const draw = (now: number): void => {
    if (startedAt === null) return;
    fill.style.clipPath = `inset(0 ${String(100 - power(now) * 100)}% 0 0)`;
    requestAnimationFrame(draw);
  };
  const reset = (): void => {
    startedAt = null;
    fill.style.clipPath = '';
    label.textContent = text;
  };
  element.addEventListener('pointerdown', (event) => {
    element.setPointerCapture(event.pointerId);
    startedAt = performance.now();
    label.textContent = texts.releaseToSpin;
    requestAnimationFrame(draw);
  });
  element.addEventListener('pointerup', () => {
    if (startedAt === null) return;
    const value = power(performance.now());
    startedAt = null;
    onRelease(value);
  });
  element.addEventListener('pointercancel', reset);
  // A long press must not open the text selection menu.
  element.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
  element.addEventListener('click', (event) => {
    if (event.detail === 0) onRelease(undefined);
  });
  return element;
}

function note(text: string): HTMLElement {
  return createElement('p', { className: 'note', text });
}

function alert(text: string): HTMLElement {
  return createElement('p', { className: 'alert', text });
}

function firstRoundChoice(context: ScreenContext): HTMLElement[] {
  const { setup } = context;
  const rounds = Array.from({ length: ROUND_COUNT + 1 }, (_, i) => i + 1);
  return [
    createElement('p', { className: 'label', text: texts.firstRound }),
    createElement(
      'div',
      { className: 'choices' },
      rounds.map((round) =>
        button(
          texts.firstRoundChoice(round, round > ROUND_COUNT),
          () => {
            setup.firstRound = round;
            context.refresh();
          },
          { className: round === setup.firstRound ? 'choice selected' : 'choice' },
        ),
      ),
    ),
  ];
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
    const teamNames = teamNamesFor(setup.names, setup.teamCount);
    context.send(
      setup.testMode
        ? { type: 'startGame', teamNames, firstRound: setup.firstRound }
        : { type: 'startGame', teamNames },
    );
  };
  return createElement('div', { className: 'screen' }, [
    createElement('p', { className: 'label', text: texts.teamCount }),
    createElement('div', { className: 'choices' }, countButtons),
    ...inputs,
    ...(setup.testMode ? firstRoundChoice(context) : []),
    button(texts.start, start, { disabled: !context.manageEnabled }),
    ...changeModeButton(context),
  ]);
}

function testSpinOptions(context: ScreenContext): ReturnType<typeof forcedSpinOptions> {
  return forcedSpinOptions(context.view.roundNumber, texts.segmentLabel);
}

function spinAction(context: ScreenContext, power: number | undefined): PhoneAction {
  const forced = context.setup.testMode
    ? testSpinOptions(context)[context.setup.forcedSpin]
    : undefined;
  return forced === undefined
    ? { type: 'spin', power }
    : { type: 'spin', segmentIndex: forced.segmentIndex, part: forced.part };
}

/** Test mode: pick the segment the wheel will stop on. */
function forcedSpinChoice(context: ScreenContext): HTMLElement[] {
  const { setup } = context;
  if (!setup.testMode) return [];
  const select = createElement('select', { className: 'text-input' }, [
    createElement('option', { text: texts.randomSpin }),
    ...testSpinOptions(context).map((option) => createElement('option', { text: option.label })),
  ]);
  select.selectedIndex = setup.forcedSpin + 1;
  select.addEventListener('change', () => {
    setup.forcedSpin = select.selectedIndex - 1;
  });
  return [createElement('label', { className: 'label', text: texts.forcedSpin }, [select])];
}

function turnButtons(
  context: ScreenContext,
  canSpin: boolean,
  canBuyVowel: boolean,
): HTMLElement[] {
  const { enabled, send } = context;
  return [
    powerButton(
      texts.spin,
      (power) => {
        send(spinAction(context, power));
      },
      !enabled || !canSpin,
    ),
    ...(canSpin ? [note(texts.holdToSpin)] : []),
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

/** Only the final blocks letters already proposed: in a round, the players must remember. */
function usedLetters(view: PublicView): readonly string[] {
  return view.phase === 'final' ? view.guessedLetters : [];
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
    letterKeys(letters, usedLetters(context.view)).map(({ letter, used }) =>
      button(
        letter,
        () => {
          context.send(toAction(letter));
        },
        {
          className: used ? 'key used' : 'key',
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
  input.disabled = !context.enabled;
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
      { className: 'danger-button', disabled: !context.manageEnabled },
    );
  }
  return button(
    labels.ask,
    () => {
      context.askConfirmation(action);
    },
    { className: 'secondary-button', disabled: !context.manageEnabled },
  );
}

/** One phone per team: a single big button, for this phone's team. */
function ownBuzzScreen(
  context: ScreenContext,
  team: number,
  eliminatedTeams: readonly number[],
): HTMLElement {
  const eliminated = eliminatedTeams.includes(team);
  return createElement('div', { className: 'screen' }, [
    ...(eliminated ? [note(texts.eliminated)] : []),
    button(
      texts.buzz,
      () => {
        context.send({ type: 'buzz', team });
      },
      { className: 'big-button buzz-button own-buzz', disabled: !context.enabled || eliminated },
    ),
    confirmButton(context, 'abandonGame'),
  ]);
}

/** One phone for everyone: players shout, and the phone holder taps the fastest team. */
function buzzScreen(context: ScreenContext, eliminatedTeams: readonly number[]): HTMLElement {
  if (context.room.mode === 'multi') {
    return context.room.team === null
      ? createElement('div', { className: 'screen' }, [note(texts.noTeamWatching)])
      : ownBuzzScreen(context, context.room.team, eliminatedTeams);
  }
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

/** Other phones see why the next step is greyed: only the master moves the game on. */
function masterNote(context: ScreenContext): HTMLElement[] {
  return context.role.canManage ? [] : [note(texts.masterMovesOn)];
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
        disabled: !context.manageEnabled,
      },
    ),
    ...masterNote(context),
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
    powerButton(
      texts.spinPrizeWheel,
      (power) => {
        context.send({ type: 'spin', power });
      },
      spinning || !context.enabled,
    ),
    ...(spinning ? [] : [note(texts.holdToSpin)]),
    confirmButton(context, 'abandonGame'),
  ]);
}

/** Swap or divide: one button per other team, with its round score. */
function chooseTeamScreen(context: ScreenContext, effect: TeamEffect): HTMLElement {
  const { view } = context;
  return createElement('div', { className: 'screen' }, [
    createElement('p', { className: 'headline', text: texts.chooseTeam(effect) }),
    ...view.teams.flatMap((team, index) =>
      index === view.activeTeam
        ? []
        : [
            button(
              `${team.name} : ${texts.euros(team.roundScore)}`,
              () => {
                context.send({ type: 'chooseTeam', team: index });
              },
              { disabled: !context.enabled },
            ),
          ],
    ),
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
      { disabled: !context.manageEnabled },
    ),
    ...masterNote(context),
  ]);
}

/** Name shown for a team joined without a name, as the game will name it. */
function seatName(name: string, index: number): string {
  return name === '' ? `${DEFAULT_TEAM_NAME_PREFIX} ${String(index + 1)}` : name;
}

function changeModeButton(context: ScreenContext): HTMLElement[] {
  const { room } = context;
  if (!room.isMaster || room.mode === null) return [];
  const other: PlayMode = room.mode === 'single' ? 'multi' : 'single';
  return [
    button(
      other === 'multi' ? texts.toMultiMode : texts.toSingleMode,
      () => {
        context.sendRoom({ type: 'chooseMode', mode: other });
      },
      { className: 'secondary-button', disabled: !context.ready },
    ),
  ];
}

function modeScreen(context: ScreenContext): HTMLElement {
  if (!context.room.isMaster) {
    return createElement('div', { className: 'screen' }, [note(texts.masterChoosesMode)]);
  }
  const choose = (mode: PlayMode) => () => {
    context.sendRoom({ type: 'chooseMode', mode });
  };
  return createElement('div', { className: 'screen' }, [
    createElement('p', { className: 'headline', text: texts.chooseMode }),
    button(texts.singleMode, choose('single'), { disabled: !context.ready }),
    note(texts.singleModeHint),
    button(texts.multiMode, choose('multi'), { disabled: !context.ready }),
    note(texts.multiModeHint),
  ]);
}

/** Joins a team, or renames the one already joined. */
function teamNameForm(context: ScreenContext): HTMLElement {
  const { room, setup } = context;
  const full = room.team === null && room.seats.length >= MAX_TEAMS;
  const input = createElement('input', { className: 'text-input' });
  input.maxLength = MAX_TEAM_NAME_LENGTH;
  input.placeholder = texts.teamPlaceholder(room.team ?? room.seats.length);
  input.value = setup.ownName;
  input.addEventListener('input', () => {
    setup.ownName = input.value;
  });
  const submit = createElement('button', {
    className: room.team === null ? 'big-button' : 'secondary-button',
    text: room.team === null ? texts.joinTeam : texts.renameTeam,
  });
  submit.disabled = !context.ready || full;
  const form = createElement('form', { className: 'screen' }, [
    createElement('label', { className: 'label', text: texts.ownTeamName }, [input]),
    submit,
    ...(full ? [note(texts.teamsFull)] : []),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    context.sendRoom({ type: 'joinTeam', name: input.value });
  });
  return form;
}

function seatList(context: ScreenContext): HTMLElement {
  const { room } = context;
  return createElement(
    'ul',
    { className: 'seat-list' },
    room.seats.map((seat, index) => {
      const own = index === room.team ? ` ${texts.you}` : '';
      const state = seat.connected ? '' : ` (${texts.disconnected})`;
      const remove = room.isMaster
        ? [
            button(
              texts.removeTeam,
              () => {
                context.sendRoom({ type: 'removeTeam', team: index });
              },
              { className: 'link-button', disabled: !context.ready },
            ),
          ]
        : [];
      return createElement('li', { text: `${seatName(seat.name, index)}${own}${state}` }, remove);
    }),
  );
}

/** One phone per team: each phone joins, then the master starts the game. */
function lobbyScreen(context: ScreenContext): HTMLElement {
  const { room, setup } = context;
  const enoughTeams = room.seats.length >= MIN_TEAMS;
  const start = (): void => {
    const teamNames = room.seats.map((seat) => seat.name);
    context.send(
      setup.testMode
        ? { type: 'startGame', teamNames, firstRound: setup.firstRound }
        : { type: 'startGame', teamNames },
    );
  };
  const masterPart = room.isMaster
    ? [
        ...(setup.testMode ? firstRoundChoice(context) : []),
        button(texts.start, start, {
          disabled: !context.manageEnabled || !enoughTeams || room.team === null,
        }),
        ...(enoughTeams ? [] : [note(texts.needTeams(MIN_TEAMS))]),
        ...(room.team === null ? [note(texts.masterMustJoin)] : []),
        ...changeModeButton(context),
      ]
    : [note(texts.masterStarts)];
  return createElement('div', { className: 'screen' }, [
    teamNameForm(context),
    createElement('p', { className: 'label', text: texts.joinedTeams }),
    room.seats.length === 0 ? note(texts.noTeamYet) : seatList(context),
    ...masterPart,
  ]);
}

function lobbyOrSetup(context: ScreenContext): HTMLElement {
  switch (context.room.mode) {
    case null:
      return modeScreen(context);
    case 'single':
      return setupScreen(context);
    case 'multi':
      return lobbyScreen(context);
  }
}

/** With one phone per team: whose turn it is, when it is not this phone's. */
function turnNotice(context: ScreenContext): HTMLElement[] {
  const { role, view } = context;
  if (role.waitingFor === null) return [];
  const name = view.teams[role.waitingFor]?.name ?? '';
  return [
    createElement('p', { className: 'headline turn-notice', text: texts.notYourTurn(name) }),
    ...(role.canStandIn
      ? [
          note(texts.teamDisconnected(name)),
          button(texts.standIn(name), context.standIn, {
            className: 'secondary-button',
            disabled: !context.ready,
          }),
        ]
      : []),
  ];
}

export function renderScreen(screen: PhoneScreen, context: ScreenContext): HTMLElement {
  if (screen.kind === 'setup') return lobbyOrSetup(context);
  const notice = turnNotice(context);
  const content = gameScreen(screen, context);
  if (notice.length === 0) return content;
  return createElement('div', { className: 'screen' }, [...notice, content]);
}

function gameScreen(screen: PhoneScreen, context: ScreenContext): HTMLElement {
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
        ...(screen.noMoreConsonants ? [alert(texts.noMoreConsonants)] : []),
        ...(screen.noMoreVowels ? [alert(texts.noMoreVowels)] : []),
        ...forcedSpinChoice(context),
        ...turnButtons(context, screen.canSpin, screen.canBuyVowel),
        confirmButton(context, 'abandonGame'),
      ]);
    case 'spinning':
      return createElement('div', { className: 'screen' }, [
        createElement('p', { className: 'headline', text: texts.spinning }),
        ...turnButtons({ ...context, enabled: false }, false, false),
      ]);
    case 'consonant':
      return createElement('div', { className: 'screen' }, [
        createElement('p', {
          className: 'headline',
          text:
            screen.effect === null
              ? texts.chooseConsonant(screen.value)
              : texts.effectConsonant(screen.effect),
        }),
        keyboard(context, CONSONANTS, (letter) => ({ type: 'guessConsonant', letter })),
      ]);
    case 'pocket':
      return createElement('div', { className: 'screen' }, [
        createElement('p', { className: 'headline', text: texts.choosePocket }),
        button(
          texts.redPocket,
          () => {
            context.send({ type: 'choosePocket', color: 'red' });
          },
          { className: 'big-button pocket-red', disabled: !context.enabled },
        ),
        button(
          texts.bluePocket,
          () => {
            context.send({ type: 'choosePocket', color: 'blue' });
          },
          { className: 'big-button pocket-blue', disabled: !context.enabled },
        ),
      ]);
    case 'chooseTeam':
      return chooseTeamScreen(context, screen.effect);
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
