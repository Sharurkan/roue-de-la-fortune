import { describe, expect, it } from 'vitest';
import { WHEELS } from './config';
import type { Phrase } from './phrases';
import { reduce, type GameDeps, type ReduceResult } from './reducer';
import type { GameAction, GameState, PlayingState } from './state';

// Consonants: C S R L P D (S four times). Vowels: A E I.
const PHRASE: Phrase = { theme: 'Expression', text: 'Casser les pieds' };

const TOSS_UP: Phrase = { theme: 'Lieu', text: 'La tour Eiffel' };

/** Round 1 wheel for values; traps are on the round 3 wheel, the jackpot on round 4. */
const SEGMENT = {
  value300: 1,
  value500: 22,
  value1000: 10,
  bankrupt: 4,
  pass: 23,
  jackpot: 0,
} as const;

function deps(randoms: number[] = [], phrases: readonly Phrase[] = [PHRASE]): GameDeps {
  let call = 0;
  return {
    random: () => randoms[call++] ?? 0,
    phrases,
    finalPhrases: phrases,
    tossUpPhrases: [TOSS_UP],
  };
}

function randomFor(segmentIndex: number): number {
  return (segmentIndex + 0.5) / (WHEELS[0]?.length ?? 1);
}

function apply(state: GameState, actions: GameAction[], gameDeps = deps()): ReduceResult {
  let result: ReduceResult = { state, events: [] };
  for (const action of actions) result = reduce(result.state, action, gameDeps);
  return result;
}

function playing(state: GameState): PlayingState {
  if (state.phase !== 'playing') throw new Error(`Expected playing, got ${state.phase}`);
  return state;
}

/** Plays the toss-up: the given team buzzes and finds the answer. */
function winTossUp(state: GameState, team: number, phrases: readonly Phrase[]): PlayingState {
  const actions: GameAction[] = [
    { type: 'buzz', team },
    { type: 'submitSolution', answer: TOSS_UP.text },
  ];
  return playing(apply(state, actions, deps([], phrases)).state);
}

function newGame(teamCount = 3, phrases: readonly Phrase[] = [PHRASE]): PlayingState {
  const teamNames = Array.from({ length: teamCount }, () => '');
  const tossUp = reduce({ phase: 'setup' }, { type: 'startGame', teamNames }, deps([], phrases));
  return winTossUp(tossUp.state, 0, phrases);
}

/** The second random number picks the part of the jackpot slot: 0.5 is its middle. */
function spinTo(state: GameState, segmentIndex: number, partRandom = 0.5): ReduceResult {
  return apply(
    state,
    [{ type: 'spin' }, { type: 'spinEnded' }],
    deps([randomFor(segmentIndex), partRandom]),
  );
}

function guessConsonant(
  state: GameState,
  letter: string,
  segmentIndex: number = SEGMENT.value300,
): ReduceResult {
  return reduce(spinTo(state, segmentIndex).state, { type: 'guessConsonant', letter }, deps());
}

function guessVowel(state: GameState, letter: string): ReduceResult {
  return apply(state, [{ type: 'buyVowel' }, { type: 'guessVowel', letter }]);
}

function inRound(state: PlayingState, roundNumber: number): PlayingState {
  return { ...state, roundNumber };
}

function withRoundScore(state: PlayingState, team: number, roundScore: number): PlayingState {
  return {
    ...state,
    teams: state.teams.map((t, i) => (i === team ? { ...t, roundScore } : t)),
  };
}

const rejection = (reason: string) => [{ type: 'actionRejected', reason }];

describe('game setup', () => {
  it.each([2, 3, 4])('starts a game with %i teams', (count) => {
    expect(newGame(count).teams).toHaveLength(count);
  });

  it.each([1, 5])('rejects %i teams', (count) => {
    const teamNames = Array.from({ length: count }, () => 'A');
    const result = reduce({ phase: 'setup' }, { type: 'startGame', teamNames }, deps());
    expect(result.state).toEqual({ phase: 'setup' });
    expect(result.events).toEqual(rejection('invalidTeamCount'));
  });

  it('uses default names for empty names, trims and limits length', () => {
    const teamNames = ['', '  Les Bleus  ', 'A'.repeat(30)];
    const { state } = reduce({ phase: 'setup' }, { type: 'startGame', teamNames }, deps());
    expect(state.phase === 'tossUp' && state.teams.map((team) => team.name)).toEqual([
      'Équipe 1',
      'Les Bleus',
      'A'.repeat(20),
    ]);
  });

  it('starts round 1 with team 1 and all scores at 0', () => {
    const state = newGame();
    expect(state.roundNumber).toBe(1);
    expect(state.round.activeTeam).toBe(0);
    expect(state.step).toEqual({ kind: 'choosing' });
    expect(state.teams.every((t) => t.roundScore === 0 && t.totalScore === 0)).toBe(true);
  });

  it('can start at a later round, for testing', () => {
    const teamNames = ['A', 'B'];
    const { state } = reduce(
      { phase: 'setup' },
      { type: 'startGame', teamNames, firstRound: 3 },
      deps(),
    );
    expect(state.phase === 'tossUp' && state.roundNumber).toBe(3);
  });

  it('can start directly at the final, for testing', () => {
    const teamNames = ['A', 'B'];
    const { state } = reduce(
      { phase: 'setup' },
      { type: 'startGame', teamNames, firstRound: 5 },
      deps(),
    );
    expect(state.phase).toBe('final');
  });

  it.each([0, 6, 1.5])('rejects the first round %d', (firstRound) => {
    const action: GameAction = { type: 'startGame', teamNames: ['A', 'B'], firstRound };
    expect(reduce({ phase: 'setup' }, action, deps()).events).toEqual(rejection('invalidRound'));
  });

  it('rejects game actions before the game starts', () => {
    const result = reduce({ phase: 'setup' }, { type: 'spin' }, deps());
    expect(result.events).toEqual(rejection('wrongPhase'));
  });
});

describe('wheel', () => {
  it('picks the segment with the injected randomness', () => {
    const result = reduce(newGame(), { type: 'spin' }, deps([randomFor(5)]));
    expect(playing(result.state).step).toEqual({
      kind: 'spinning',
      segmentIndex: 5,
      part: 'middle',
    });
    expect(result.events).toEqual([{ type: 'wheelSpun', segmentIndex: 5, part: 'middle' }]);
  });

  it('rejects every turn action while the wheel is spinning', () => {
    const spinning = reduce(newGame(), { type: 'spin' }, deps()).state;
    for (const action of [
      { type: 'spin' },
      { type: 'buyVowel' },
      { type: 'startSolving' },
      { type: 'guessConsonant', letter: 'S' },
    ] satisfies GameAction[]) {
      expect(reduce(spinning, action, deps()).events).toEqual(rejection('wrongPhase'));
    }
  });

  it('asks for a consonant after landing on a value', () => {
    const { state } = spinTo(newGame(), SEGMENT.value500);
    expect(playing(state).step).toEqual({
      kind: 'guessingConsonant',
      amount: 500,
      perLetter: true,
    });
  });

  it('after spinning, the team can neither buy a vowel nor solve', () => {
    const { state } = spinTo(newGame(), SEGMENT.value500);
    expect(reduce(state, { type: 'buyVowel' }, deps()).events).toEqual(rejection('wrongPhase'));
    expect(reduce(state, { type: 'startSolving' }, deps()).events).toEqual(rejection('wrongPhase'));
  });

  it('bankrupt resets the round score to 0 and passes the turn', () => {
    const game = withRoundScore(inRound(newGame(), 3), 0, 800);
    const result = spinTo(game, SEGMENT.bankrupt);
    const state = playing(result.state);
    expect(state.teams[0]?.roundScore).toBe(0);
    expect(state.round.activeTeam).toBe(1);
    expect(result.events).toEqual([
      { type: 'bankrupt', team: 0 },
      { type: 'turnPassed', team: 1 },
    ]);
  });

  it('bankrupt keeps the total score', () => {
    const game = inRound(newGame(), 3);
    const withTotal = { ...game, teams: game.teams.map((t) => ({ ...t, totalScore: 900 })) };
    expect(playing(spinTo(withTotal, SEGMENT.bankrupt).state).teams[0]?.totalScore).toBe(900);
  });

  it('pass passes the turn and keeps the score', () => {
    const result = spinTo(withRoundScore(inRound(newGame(), 3), 0, 800), SEGMENT.pass);
    const state = playing(result.state);
    expect(state.teams[0]?.roundScore).toBe(800);
    expect(state.round.activeTeam).toBe(1);
    expect(result.events).toContainEqual({ type: 'landedOnPass', team: 0 });
  });

  it('the turn goes back to the first team after the last one', () => {
    const game = inRound({ ...newGame(2), round: { ...newGame(2).round, activeTeam: 1 } }, 3);
    expect(playing(spinTo(game, SEGMENT.pass).state).round.activeTeam).toBe(0);
  });
});

describe('wheels', () => {
  it('has one wheel of 24 segments per regular round', () => {
    expect(WHEELS).toHaveLength(4);
    for (const wheel of WHEELS) expect(wheel).toHaveLength(24);
  });

  it('round 1 has no traps', () => {
    expect(WHEELS[0]?.every((segment) => segment.kind === 'value')).toBe(true);
  });

  it('round 4 has the 5 000 € jackpot at noon, and no other bankrupt', () => {
    const wheel = WHEELS[3] ?? [];
    expect(wheel[0]).toEqual({ kind: 'jackpot', amount: 5000 });
    expect(wheel.some((segment) => segment.kind === 'bankrupt')).toBe(false);
  });

  it('spins the wheel of the current round', () => {
    const { state } = spinTo(inRound(newGame(), 4), SEGMENT.jackpot);
    expect(playing(state).step).toEqual({
      kind: 'guessingConsonant',
      amount: 5000,
      perLetter: false,
    });
  });

  it('the jackpot is won once, whatever the number of letters', () => {
    const result = guessConsonant(inRound(newGame(), 4), 'S', SEGMENT.jackpot);
    expect(playing(result.state).teams[0]?.roundScore).toBe(5000);
    expect(result.events).toEqual([{ type: 'letterFound', letter: 'S', count: 4, gain: 5000 }]);
  });

  it.each([
    [0.1, 'left'],
    [0.9, 'right'],
  ])('the edges of the jackpot slot are bankrupts (random %d: %s)', (partRandom, part) => {
    const game = withRoundScore(inRound(newGame(), 4), 0, 800);
    const spinning = reduce(game, { type: 'spin' }, deps([randomFor(SEGMENT.jackpot), partRandom]));
    expect(spinning.events).toEqual([{ type: 'wheelSpun', segmentIndex: SEGMENT.jackpot, part }]);
    const result = reduce(spinning.state, { type: 'spinEnded' }, deps());
    expect(playing(result.state).teams[0]?.roundScore).toBe(0);
    expect(result.events).toContainEqual({ type: 'bankrupt', team: 0 });
  });

  it('the jackpot gives nothing for an absent letter', () => {
    const result = guessConsonant(inRound(newGame(), 4), 'T', SEGMENT.jackpot);
    expect(playing(result.state).teams[0]?.roundScore).toBe(0);
  });
});

describe('consonants', () => {
  it('gain = segment value × occurrences, and the team plays again', () => {
    const result = guessConsonant(newGame(), 'S', SEGMENT.value500);
    const state = playing(result.state);
    expect(state.teams[0]?.roundScore).toBe(2000);
    expect(state.round.activeTeam).toBe(0);
    expect(state.step).toEqual({ kind: 'choosing' });
    expect(result.events).toEqual([{ type: 'letterFound', letter: 'S', count: 4, gain: 2000 }]);
  });

  it('an absent consonant passes the turn', () => {
    const result = guessConsonant(newGame(), 'T');
    const state = playing(result.state);
    expect(state.teams[0]?.roundScore).toBe(0);
    expect(state.round.activeTeam).toBe(1);
    expect(state.round.guessedLetters).toEqual(['T']);
    expect(result.events).toEqual([
      { type: 'letterAbsent', letter: 'T' },
      { type: 'turnPassed', team: 1 },
    ]);
  });

  it('accepts a lowercase letter', () => {
    expect(playing(guessConsonant(newGame(), 's').state).round.guessedLetters).toEqual(['S']);
  });

  it.each(['A', 'Y', '1', 'SS', ''])('rejects %j as a consonant', (letter) => {
    expect(guessConsonant(newGame(), letter).events).toEqual(rejection('invalidLetter'));
  });

  it('rejects a letter already proposed', () => {
    const afterS = guessConsonant(newGame(), 'S').state;
    expect(guessConsonant(afterS, 'S').events).toEqual(rejection('letterAlreadyGuessed'));
  });

  it('announces when no consonant is left, then refuses to spin', () => {
    let state: GameState = newGame();
    for (const letter of ['C', 'S', 'R', 'L', 'P']) state = guessConsonant(state, letter).state;
    const last = guessConsonant(state, 'D');
    expect(last.events).toContainEqual({ type: 'noMoreConsonants' });
    expect(reduce(last.state, { type: 'spin' }, deps()).events).toEqual(
      rejection('noConsonantsLeft'),
    );
  });
});

describe('vowels', () => {
  it('refuses to sell a vowel without 250 € in the round score', () => {
    const game = withRoundScore(newGame(), 0, 249);
    expect(reduce(game, { type: 'buyVowel' }, deps()).events).toEqual(rejection('notEnoughMoney'));
  });

  it('a present vowel costs 250 € and the team plays again', () => {
    const result = guessVowel(withRoundScore(newGame(), 0, 1000), 'E');
    const state = playing(result.state);
    expect(state.teams[0]?.roundScore).toBe(750);
    expect(state.round.activeTeam).toBe(0);
    expect(result.events).toEqual([
      { type: 'vowelBought', team: 0, cost: 250 },
      { type: 'letterFound', letter: 'E', count: 3, gain: 0 },
    ]);
  });

  it('an absent vowel is still paid and passes the turn', () => {
    const state = playing(guessVowel(withRoundScore(newGame(), 0, 1000), 'O').state);
    expect(state.teams[0]?.roundScore).toBe(750);
    expect(state.round.activeTeam).toBe(1);
  });

  it('Y is a vowel, and accented input is normalized', () => {
    const game = withRoundScore(newGame(), 0, 1000);
    expect(playing(guessVowel(game, 'y').state).round.guessedLetters).toEqual(['Y']);
    expect(playing(guessVowel(game, 'é').state).round.guessedLetters).toEqual(['E']);
  });

  it('rejects a consonant as a vowel', () => {
    expect(guessVowel(withRoundScore(newGame(), 0, 1000), 'S').events).toEqual(
      rejection('invalidLetter'),
    );
  });

  it('cancel goes back to the choice without paying', () => {
    const result = apply(withRoundScore(newGame(), 0, 1000), [
      { type: 'buyVowel' },
      { type: 'cancel' },
    ]);
    const state = playing(result.state);
    expect(state.step).toEqual({ kind: 'choosing' });
    expect(state.teams[0]?.roundScore).toBe(1000);
  });

  it('announces when no vowel is left, then refuses to sell one', () => {
    let state: GameState = withRoundScore(newGame(), 0, 1000);
    state = guessVowel(state, 'A').state;
    state = guessVowel(state, 'E').state;
    const last = guessVowel(state, 'I');
    expect(last.events).toContainEqual({ type: 'noMoreVowels' });
    expect(reduce(last.state, { type: 'buyVowel' }, deps()).events).toEqual(
      rejection('noVowelsLeft'),
    );
  });
});

describe('solution', () => {
  const solve = (state: GameState, answer: string) =>
    apply(state, [{ type: 'startSolving' }, { type: 'submitSolution', answer }]);

  it('a right answer wins the round: only the winner adds the round score to the total', () => {
    let game = withRoundScore(newGame(), 0, 1500);
    game = withRoundScore(game, 1, 700);
    const result = solve(game, '  casser LES PIEDS ');
    expect(result.state).toMatchObject({ phase: 'roundOver', winner: 0 });
    if (result.state.phase !== 'roundOver') throw new Error('Expected roundOver');
    expect(result.state.teams.map((t) => t.totalScore)).toEqual([1500, 0, 0]);
    expect(result.events).toEqual([{ type: 'roundWon', team: 0, amount: 1500 }]);
  });

  it('round scores go back to 0 at the end of the round', () => {
    const game = withRoundScore(withRoundScore(newGame(), 0, 1500), 1, 700);
    const { state } = solve(game, 'Casser les pieds');
    if (state.phase !== 'roundOver') throw new Error('Expected roundOver');
    expect(state.teams.map((t) => t.roundScore)).toEqual([0, 0, 0]);
  });

  it('ignores accents, case, spaces and punctuation', () => {
    const game = newGame(2, [{ theme: 'Lieu', text: 'Le mont Saint-Michel' }]);
    expect(solve(game, 'le mont saint michel').state.phase).toBe('roundOver');
  });

  it('a team with 0 € that solves adds 0 €', () => {
    const { state } = solve(newGame(), 'Casser les pieds');
    if (state.phase !== 'roundOver') throw new Error('Expected roundOver');
    expect(state.teams[0]?.totalScore).toBe(0);
  });

  it('a wrong answer is shown and the turn passes', () => {
    const result = solve(newGame(), ' Casser les oreilles ');
    expect(playing(result.state).round.activeTeam).toBe(1);
    expect(result.events).toEqual([
      { type: 'wrongSolution', answer: 'Casser les oreilles' },
      { type: 'turnPassed', team: 1 },
    ]);
  });

  it.each(['', '  ', '!!!', 'A'.repeat(101)])('rejects the answer %j', (answer) => {
    expect(solve(newGame(), answer).events).toEqual(rejection('invalidAnswer'));
  });

  it('cancel goes back to the choice', () => {
    const { state } = apply(newGame(), [{ type: 'startSolving' }, { type: 'cancel' }]);
    expect(playing(state).step).toEqual({ kind: 'choosing' });
  });

  it('cancel is refused while choosing', () => {
    expect(reduce(newGame(), { type: 'cancel' }, deps()).events).toEqual(rejection('wrongPhase'));
  });
});

describe('rounds and game end', () => {
  const phrases: Phrase[] = [
    { theme: 'Film', text: 'Le Roi lion' },
    { theme: 'Film', text: 'Les Visiteurs' },
  ];
  const winRound = (state: GameState) => {
    const text = playing(state).round.phrase.text;
    return apply(state, [{ type: 'startSolving' }, { type: 'submitSolution', answer: text }]);
  };

  const nextRound = (state: GameState, tossUpWinner = 0) =>
    winTossUp(
      reduce(winRound(state).state, { type: 'nextRound' }, deps([], phrases)).state,
      tossUpWinner,
      phrases,
    );

  it('the next round opens with a toss-up and keeps totals', () => {
    const game = withRoundScore(newGame(3, phrases), 0, 500);
    const roundOver = winRound(game).state;
    const result = reduce(roundOver, { type: 'nextRound' }, deps([], phrases));
    expect(result.state.phase).toBe('tossUp');
    expect(result.events).toEqual([{ type: 'tossUpStarted', roundNumber: 2 }]);
    const state = winTossUp(result.state, 2, phrases);
    expect(state.roundNumber).toBe(2);
    expect(state.round.activeTeam).toBe(2);
    expect(state.round.guessedLetters).toEqual([]);
    expect(state.teams.map((t) => t.totalScore)).toEqual([500, 0, 0]);
  });

  it('never repeats a phrase until the list is exhausted, then starts over', () => {
    let state: GameState = newGame(2, phrases);
    const seen = [playing(state).round.phrase.text];
    for (let round = 0; round < 2; round++) {
      state = nextRound(state);
      seen.push(playing(state).round.phrase.text);
    }
    expect(seen.slice(0, 2).sort()).toEqual(['Le Roi lion', 'Les Visiteurs']);
    expect(phrases.map((p) => p.text)).toContain(seen[2]);
  });

  it('plays 4 regular rounds, then the next step is the final', () => {
    let state: GameState = newGame(2, phrases);
    for (let round = 1; round < 4; round++) state = nextRound(state);
    expect(playing(state).roundNumber).toBe(4);
    const final = reduce(winRound(state).state, { type: 'nextRound' }, deps([], phrases));
    expect(final.state.phase).toBe('final');
  });

  it('starts a new game after the end of the game', () => {
    const over = reduce(newGame(), { type: 'abandonGame' }, deps()).state;
    expect(reduce(over, { type: 'newGame' }, deps()).state).toEqual({ phase: 'setup' });
  });

  it('refuses a new game before the end of the game', () => {
    expect(reduce(newGame(), { type: 'newGame' }, deps()).events).toEqual(rejection('wrongPhase'));
  });
});

describe('abandon', () => {
  it('stops the game in the middle of a round, losing the round scores', () => {
    const game = withRoundScore(newGame(), 0, 900);
    const withTotal = { ...game, teams: game.teams.map((t, i) => ({ ...t, totalScore: i * 100 })) };
    const result = reduce(withTotal, { type: 'abandonGame' }, deps());
    expect(result.state).toEqual({
      phase: 'gameOver',
      final: null,
      teams: withTotal.teams.map((t) => ({ ...t, roundScore: 0 })),
    });
    expect(result.events).toEqual([{ type: 'gameOver' }]);
  });

  it('works while the wheel is spinning, and the end of the spin is then refused', () => {
    const spinning = reduce(newGame(), { type: 'spin' }, deps()).state;
    const over = reduce(spinning, { type: 'abandonGame' }, deps()).state;
    expect(over.phase).toBe('gameOver');
    expect(reduce(over, { type: 'spinEnded' }, deps()).events).toEqual(rejection('wrongPhase'));
  });

  it('works at the end of a round', () => {
    const roundOver = apply(newGame(), [
      { type: 'startSolving' },
      { type: 'submitSolution', answer: PHRASE.text },
    ]).state;
    expect(reduce(roundOver, { type: 'abandonGame' }, deps()).state.phase).toBe('gameOver');
  });

  it('is refused when no game is running', () => {
    expect(reduce({ phase: 'setup' }, { type: 'abandonGame' }, deps()).events).toEqual(
      rejection('wrongPhase'),
    );
  });
});
