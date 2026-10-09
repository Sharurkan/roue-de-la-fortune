import { describe, expect, it } from 'vitest';
import { PHRASES } from '../game/phrases';
import { reduce, type GameDeps } from '../game/reducer';
import { INITIAL_STATE, type GameAction, type GameState } from '../game/state';
import { toPublicView } from '../protocol/view';
import type { RoomView } from '../protocol/room';
import { describeScreen, forcedSpinOptions, letterKeys, phoneRole, teamNamesFor } from './controls';

const DEPS: GameDeps = {
  random: () => 0,
  phrases: [
    PHRASES.find((p) => p.text === 'Le Roi lion') ?? { theme: 'Film', text: 'Le Roi lion' },
  ],
  finalPhrases: [{ theme: 'Objet', text: 'Une tondeuse' }],
  tossUpPhrases: [{ theme: 'Lieu', text: 'La tour Eiffel' }],
};

function screenAfter(actions: GameAction[]) {
  let state: GameState = INITIAL_STATE;
  for (const action of actions) state = reduce(state, action, DEPS).state;
  return describeScreen(toPublicView(state, []));
}

const START_GAME: GameAction = { type: 'startGame', teamNames: ['A', 'B'] };
const WIN_TOSS_UP: GameAction[] = [
  { type: 'buzz', team: 0 },
  { type: 'submitSolution', answer: 'la tour eiffel' },
];
const START: GameAction[] = [START_GAME, ...WIN_TOSS_UP];

describe('describeScreen', () => {
  it('shows the setup first', () => {
    expect(screenAfter([])).toEqual({ kind: 'setup' });
  });

  it('lets the phone holder pick the team that buzzed, except eliminated teams', () => {
    expect(screenAfter([START_GAME])).toEqual({ kind: 'buzzing', eliminatedTeams: [] });
    const wrong: GameAction[] = [
      START_GAME,
      { type: 'buzz', team: 1 },
      { type: 'submitSolution', answer: 'non' },
    ];
    expect(screenAfter(wrong)).toEqual({ kind: 'buzzing', eliminatedTeams: [1] });
  });

  it('asks the team that buzzed for its answer', () => {
    expect(screenAfter([START_GAME, { type: 'buzz', team: 1 }])).toEqual({
      kind: 'tossUpSolving',
      team: 1,
    });
  });

  it('shows the turn choices, with a vowel not yet affordable', () => {
    expect(screenAfter(START)).toEqual({
      kind: 'turn',
      canSpin: true,
      canBuyVowel: false,
      noMoreConsonants: false,
      noMoreVowels: false,
    });
  });

  it('locks everything while the wheel spins', () => {
    expect(screenAfter([...START, { type: 'spin' }])).toEqual({ kind: 'spinning' });
  });

  it('asks for a consonant with the segment value', () => {
    expect(screenAfter([...START, { type: 'spin' }, { type: 'spinEnded' }])).toEqual({
      kind: 'consonant',
      value: 150,
      effect: null,
    });
  });

  it('shows the solution input', () => {
    expect(screenAfter([...START, { type: 'startSolving' }])).toEqual({ kind: 'solving' });
  });

  it('shows the end of the round with the winner', () => {
    const actions: GameAction[] = [
      ...START,
      { type: 'startSolving' },
      { type: 'submitSolution', answer: 'le roi lion' },
    ];
    expect(screenAfter(actions)).toEqual({ kind: 'roundOver', winner: 0, isLastRound: false });
  });

  it('shows the end of the game', () => {
    expect(screenAfter([...START, { type: 'abandonGame' }])).toEqual({ kind: 'gameOver' });
  });

  describe('final round', () => {
    const winRound: GameAction[] = [
      { type: 'startSolving' },
      { type: 'submitSolution', answer: 'le roi lion' },
    ];
    const lastRoundOver: GameAction[] = [
      ...START,
      ...winRound,
      { type: 'nextRound' },
      ...WIN_TOSS_UP,
      ...winRound,
      { type: 'nextRound' },
      ...WIN_TOSS_UP,
      ...winRound,
      { type: 'nextRound' },
      ...WIN_TOSS_UP,
      ...winRound,
    ];
    const toPicking: GameAction[] = [
      ...lastRoundOver,
      { type: 'nextRound' },
      { type: 'spin' },
      { type: 'spinEnded' },
    ];

    it('offers the final after the 4th round', () => {
      expect(screenAfter(lastRoundOver)).toMatchObject({ kind: 'roundOver', isLastRound: true });
    });

    it('shows the envelope wheel, then locks it while it spins', () => {
      expect(screenAfter([...lastRoundOver, { type: 'nextRound' }])).toEqual({
        kind: 'prizeWheel',
      });
      expect(screenAfter([...lastRoundOver, { type: 'nextRound' }, { type: 'spin' }])).toEqual({
        kind: 'prizeSpinning',
      });
    });

    it('counts the letters left to pick', () => {
      expect(screenAfter([...toPicking, { type: 'guessVowel', letter: 'O' }])).toEqual({
        kind: 'finalPicking',
        consonantsLeft: 3,
        vowelsLeft: 0,
      });
    });

    it('asks for the answer once every letter is picked', () => {
      const picks: GameAction[] = [
        { type: 'guessConsonant', letter: 'D' },
        { type: 'guessConsonant', letter: 'B' },
        { type: 'guessConsonant', letter: 'C' },
        { type: 'guessVowel', letter: 'O' },
      ];
      expect(screenAfter([...toPicking, ...picks])).toEqual({ kind: 'finalSolving' });
    });
  });
});

describe('letterKeys', () => {
  it('greys out the letters already proposed', () => {
    expect(letterKeys('AEI', ['E'])).toEqual([
      { letter: 'A', used: false },
      { letter: 'E', used: true },
      { letter: 'I', used: false },
    ]);
  });
});

describe('teamNamesFor', () => {
  it('sends one name per team, even when some were never typed', () => {
    const typed: string[] = [];
    typed[0] = 'Les Rouges';
    expect(teamNamesFor(typed, 3)).toEqual(['Les Rouges', '', '']);
  });

  it('ignores names typed for teams that were removed', () => {
    expect(teamNamesFor(['A', 'B', 'C'], 2)).toEqual(['A', 'B']);
  });
});

describe('forcedSpinOptions', () => {
  const label = (segment: { kind: string }, part: string) => `${segment.kind}/${part}`;

  it('lists every segment of the round wheel', () => {
    expect(forcedSpinOptions(1, label)).toHaveLength(24);
    expect(forcedSpinOptions(3, label)[0]).toEqual({
      segmentIndex: 0,
      part: 'middle',
      label: '1 · pocket/middle',
    });
  });

  it('offers both the middle and the edge of the jackpot', () => {
    const jackpot = forcedSpinOptions(4, label).filter((option) => option.segmentIndex === 0);
    expect(jackpot.map((option) => option.part)).toEqual(['middle', 'left']);
  });
});

describe('phoneRole', () => {
  const viewAfter = (actions: GameAction[]) => {
    let state: GameState = INITIAL_STATE;
    for (const action of actions) state = reduce(state, action, DEPS).state;
    return toPublicView(state, []);
  };
  const seats = [
    { name: 'A', connected: true },
    { name: 'B', connected: true },
  ];
  const room = (team: number, isMaster = false, seatList = seats): RoomView => ({
    mode: 'multi',
    isMaster,
    team,
    seats: seatList,
  });
  const playing = viewAfter(START);

  it('lets a single phone do everything', () => {
    const single: RoomView = { mode: 'single', isMaster: true, team: null, seats: [] };
    expect(phoneRole(playing, single, null)).toEqual({
      canPlay: true,
      canManage: true,
      waitingFor: null,
      canStandIn: false,
    });
  });

  it('lets only the team whose turn it is play', () => {
    expect(phoneRole(playing, room(0), null).canPlay).toBe(true);
    expect(phoneRole(playing, room(1), null)).toEqual({
      canPlay: false,
      canManage: false,
      waitingFor: 0,
      canStandIn: false,
    });
  });

  it('lets every team buzz on its own phone', () => {
    const buzzing = viewAfter([START_GAME]);
    expect(phoneRole(buzzing, room(1), null).canPlay).toBe(true);
  });

  it('keeps game management to the master', () => {
    expect(phoneRole(playing, room(1, true), null).canManage).toBe(true);
    expect(phoneRole(playing, room(0), null).canManage).toBe(false);
  });

  it('lets the master stand in for a disconnected team, once asked', () => {
    const offline = [
      { name: 'A', connected: false },
      { name: 'B', connected: true },
    ];
    const master = room(1, true, offline);
    expect(phoneRole(playing, master, null)).toMatchObject({ canPlay: false, canStandIn: true });
    expect(phoneRole(playing, master, 0)).toMatchObject({ canPlay: true, waitingFor: null });
    expect(phoneRole(playing, room(1, true), 0).canPlay).toBe(false);
  });
});
