import { describe, expect, it } from 'vitest';
import type { GameDeps, ReduceResult } from './common';
import { shuffle } from './common';
import type { Phrase } from './phrases';
import { reduce } from './reducer';
import type { GameAction, GameState, TossUpState } from './state';
import { hiddenLetters } from './toss-up';

const TOSS_UP: Phrase = { theme: 'Lieu', text: "L'île d'Oléron" };
const ROUND_PHRASE: Phrase = { theme: 'Film', text: 'Le Roi lion' };

function deps(randoms: number[] = []): GameDeps {
  let call = 0;
  return {
    random: () => randoms[call++] ?? 0,
    phrases: [ROUND_PHRASE],
    finalPhrases: [],
    tossUpPhrases: [TOSS_UP, { theme: 'Objet', text: 'Un parapluie' }],
  };
}

function apply(state: GameState, actions: GameAction[], gameDeps = deps()): ReduceResult {
  let result: ReduceResult = { state, events: [] };
  for (const action of actions) result = reduce(result.state, action, gameDeps);
  return result;
}

function inTossUp(state: GameState): TossUpState {
  if (state.phase !== 'tossUp') throw new Error(`Expected tossUp, got ${state.phase}`);
  return state;
}

function startGame(teamCount = 3): TossUpState {
  const teamNames = Array.from({ length: teamCount }, () => '');
  return inTossUp(reduce({ phase: 'setup' }, { type: 'startGame', teamNames }, deps()).state);
}

const rejection = (reason: string) => [{ type: 'actionRejected', reason }];
const wrongAnswer = (team: number): GameAction[] => [
  { type: 'buzz', team },
  { type: 'submitSolution', answer: 'Le mont Blanc' },
];

describe('hiddenLetters', () => {
  it('lists the letters to guess in reading order, without punctuation', () => {
    expect(hiddenLetters("L'île d'Oléron")).toEqual(Array.from('LILEDOLERON'));
  });
});

describe('shuffle', () => {
  it('keeps every item exactly once', () => {
    const items = [0, 1, 2, 3, 4];
    expect(shuffle(() => 0.42, items).sort()).toEqual(items);
  });
});

describe('toss-up', () => {
  it('opens every game, before the wheel', () => {
    const state = startGame();
    expect(state.roundNumber).toBe(1);
    expect(state.tossUp.phrase).toEqual(TOSS_UP);
    expect(state.tossUp.revealedCount).toBe(0);
    expect(state.tossUp.revealOrder.slice().sort((a, b) => a - b)).toEqual(
      hiddenLetters(TOSS_UP.text).map((_, i) => i),
    );
  });

  it('reveals one tile at a time, in the drawn order', () => {
    const state = startGame();
    const result = reduce(state, { type: 'revealTossUpLetter' }, deps());
    expect(inTossUp(result.state).tossUp.revealedCount).toBe(1);
    expect(result.events).toEqual([
      { type: 'tossUpLetterRevealed', tileIndex: state.tossUp.revealOrder[0] },
    ]);
  });

  it('stops revealing once every tile is shown, but still accepts a buzz', () => {
    const count = hiddenLetters(TOSS_UP.text).length;
    const reveals: GameAction[] = Array.from({ length: count }, () => ({
      type: 'revealTossUpLetter',
    }));
    const full = apply(startGame(), reveals).state;
    expect(reduce(full, { type: 'revealTossUpLetter' }, deps()).events).toEqual(
      rejection('wrongPhase'),
    );
    expect(reduce(full, { type: 'buzz', team: 1 }, deps()).events).toEqual([
      { type: 'buzzed', team: 1 },
    ]);
  });

  it('pauses the letters while a team answers', () => {
    const buzzed = apply(startGame(), [{ type: 'buzz', team: 2 }]).state;
    expect(inTossUp(buzzed).tossUp.buzzer).toBe(2);
    expect(reduce(buzzed, { type: 'revealTossUpLetter' }, deps()).events).toEqual(
      rejection('wrongPhase'),
    );
    expect(reduce(buzzed, { type: 'buzz', team: 1 }, deps()).events).toEqual(
      rejection('wrongPhase'),
    );
  });

  it.each([-1, 3, 1.5])('refuses a buzz from team %d', (team) => {
    expect(reduce(startGame(), { type: 'buzz', team }, deps()).events).toEqual(
      rejection('invalidTeam'),
    );
  });

  it('a right answer gives the team the first turn of the round', () => {
    const result = apply(startGame(), [
      { type: 'buzz', team: 2 },
      { type: 'submitSolution', answer: "l'ile d'oleron" },
    ]);
    expect(result.state.phase).toBe('playing');
    expect(result.state.phase === 'playing' && result.state.round.activeTeam).toBe(2);
    expect(result.events).toEqual([
      { type: 'tossUpWon', team: 2 },
      { type: 'roundStarted', roundNumber: 1 },
    ]);
  });

  it('a right answer gives no money', () => {
    const { state } = apply(startGame(), [
      { type: 'buzz', team: 0 },
      { type: 'submitSolution', answer: TOSS_UP.text },
    ]);
    expect(
      state.phase === 'playing' && state.teams.every((t) => t.roundScore + t.totalScore === 0),
    ).toBe(true);
  });

  it('a wrong answer eliminates the team and the letters go on', () => {
    const result = apply(startGame(), wrongAnswer(1));
    const state = inTossUp(result.state);
    expect(state.tossUp.buzzer).toBeNull();
    expect(state.tossUp.eliminated).toEqual([1]);
    expect(result.events).toEqual([{ type: 'tossUpWrong', team: 1, answer: 'Le mont Blanc' }]);
    expect(reduce(state, { type: 'buzz', team: 1 }, deps()).events).toEqual(
      rejection('teamEliminated'),
    );
    expect(reduce(state, { type: 'revealTossUpLetter' }, deps()).events).toHaveLength(1);
  });

  it('when every team is wrong, the round starts with the team in rotation', () => {
    const result = apply(startGame(2), [...wrongAnswer(0), ...wrongAnswer(1)]);
    expect(result.state.phase === 'playing' && result.state.round.activeTeam).toBe(0);
    expect(result.events).toEqual([
      { type: 'tossUpWrong', team: 1, answer: 'Le mont Blanc' },
      { type: 'tossUpFailed', team: 0 },
      { type: 'roundStarted', roundNumber: 1 },
    ]);
  });

  it('the rotation team changes every round', () => {
    const toRound2 = apply(startGame(3), [
      ...wrongAnswer(0),
      ...wrongAnswer(1),
      ...wrongAnswer(2),
      { type: 'startSolving' },
      { type: 'submitSolution', answer: ROUND_PHRASE.text },
      { type: 'nextRound' },
      ...wrongAnswer(0),
      ...wrongAnswer(1),
      ...wrongAnswer(2),
    ]);
    expect(toRound2.state.phase === 'playing' && toRound2.state.round.activeTeam).toBe(1);
  });

  it('refuses an answer before a buzz, and an empty answer', () => {
    expect(
      reduce(startGame(), { type: 'submitSolution', answer: TOSS_UP.text }, deps()).events,
    ).toEqual(rejection('wrongPhase'));
    const buzzed = apply(startGame(), [{ type: 'buzz', team: 0 }]).state;
    expect(reduce(buzzed, { type: 'submitSolution', answer: ' ' }, deps()).events).toEqual(
      rejection('invalidAnswer'),
    );
  });

  it('refuses the wheel during the toss-up', () => {
    expect(reduce(startGame(), { type: 'spin' }, deps()).events).toEqual(rejection('wrongPhase'));
  });

  it('can be abandoned', () => {
    expect(reduce(startGame(), { type: 'abandonGame' }, deps()).state.phase).toBe('gameOver');
  });

  it('never repeats a toss-up phrase until the list is exhausted', () => {
    const winRound: GameAction[] = [
      { type: 'buzz', team: 0 },
      { type: 'submitSolution', answer: TOSS_UP.text },
      { type: 'startSolving' },
      { type: 'submitSolution', answer: ROUND_PHRASE.text },
      { type: 'nextRound' },
    ];
    const round2 = inTossUp(apply(startGame(), winRound).state);
    expect(round2.tossUp.phrase.text).toBe('Un parapluie');
  });
});
