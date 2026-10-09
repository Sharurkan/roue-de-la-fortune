import { reject, updateTeam, type ReduceResult } from './common';
import type { TeamEffect } from './config';
import type { PlayingState } from './state';

/** Landing on swap or divide: the team must first find a consonant, worth nothing. */
export function offerTeamEffect(state: PlayingState, effect: TeamEffect): ReduceResult {
  return {
    state: {
      ...state,
      step: { kind: 'guessingConsonant', amount: 0, perLetter: false, effect },
    },
    events: [{ type: 'effectLanded', team: state.round.activeTeam, effect }],
  };
}

/** The team picks another team to swap with or to divide, then plays again. */
export function applyTeamEffect(state: PlayingState, target: number): ReduceResult {
  if (state.step.kind !== 'choosingTeam') return reject(state, 'wrongPhase');
  const team = state.round.activeTeam;
  if (!Number.isInteger(target) || state.teams[target] === undefined || target === team) {
    return reject(state, 'invalidTeam');
  }
  const { effect } = state.step;
  return {
    state: {
      ...state,
      teams: affectTeams(state, team, target, effect),
      step: { kind: 'choosing' },
    },
    events: [{ type: 'effectApplied', team, target, effect }],
  };
}

function affectTeams(state: PlayingState, team: number, target: number, effect: TeamEffect) {
  const own = state.teams[team]?.roundScore ?? 0;
  const theirs = state.teams[target]?.roundScore ?? 0;
  if (effect === 'divide') {
    return updateTeam(state.teams, target, (t) => ({ ...t, roundScore: Math.floor(theirs / 2) }));
  }
  const swapped = updateTeam(state.teams, team, (t) => ({ ...t, roundScore: theirs }));
  return updateTeam(swapped, target, (t) => ({ ...t, roundScore: own }));
}
