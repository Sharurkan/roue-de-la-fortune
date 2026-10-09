import { pickIndex, updateTeam, type GameDeps, type ReduceResult } from './common';
import {
  MYSTERY_BONUS,
  MYSTERY_EFFECT_CHANCE,
  MYSTERY_EFFECTS,
  type MysteryEffect,
} from './config';
import type { GameEvent } from './events';
import { passTurn } from './round';
import type { PlayingState } from './state';

/** Turns the mystery panel over: its amount, or a bonus or a penalty drawn at random. */
export function revealMystery(state: PlayingState, amount: number, deps: GameDeps): ReduceResult {
  const team = state.round.activeTeam;
  if (deps.random() >= MYSTERY_EFFECT_CHANCE) {
    return {
      state: { ...state, step: { kind: 'guessingConsonant', amount, perLetter: true } },
      events: [{ type: 'mysteryRevealed', team, outcome: 'money' }],
    };
  }
  const effect = MYSTERY_EFFECTS[pickIndex(deps.random, MYSTERY_EFFECTS.length)] ?? 'bonus';
  return applyEffect(state, effect);
}

function newRoundScore(score: number, effect: MysteryEffect): number {
  switch (effect) {
    case 'bonus':
      return score + MYSTERY_BONUS;
    case 'double':
      return score * 2;
    case 'bankrupt':
      return 0;
    case 'half':
      return Math.floor(score / 2);
  }
}

/** A bonus lets the team play again; a penalty passes the turn. */
function applyEffect(state: PlayingState, effect: MysteryEffect): ReduceResult {
  const team = state.round.activeTeam;
  const teams = updateTeam(state.teams, team, (t) => ({
    ...t,
    roundScore: newRoundScore(t.roundScore, effect),
  }));
  const revealed: GameEvent = { type: 'mysteryRevealed', team, outcome: effect };
  if (effect === 'bankrupt' || effect === 'half') return passTurn({ ...state, teams }, [revealed]);
  return { state: { ...state, teams, step: { kind: 'choosing' } }, events: [revealed] };
}
