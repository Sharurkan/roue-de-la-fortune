import { pickIndex, updateTeam, type GameDeps, type ReduceResult } from './common';
import { POCKET_AMOUNTS } from './config';
import type { GameEvent } from './events';
import { passTurn } from './round';
import type { PlayingState, PocketColor } from './state';

/** Hides the money in one of the two envelopes, at random each time. */
export function offerPocket(state: PlayingState, deps: GameDeps): ReduceResult {
  const winning: PocketColor = deps.random() < 0.5 ? 'red' : 'blue';
  const amount = POCKET_AMOUNTS[pickIndex(deps.random, POCKET_AMOUNTS.length)] ?? 0;
  return {
    state: { ...state, step: { kind: 'choosingPocket', winning, amount } },
    events: [{ type: 'pocketOffered', team: state.round.activeTeam }],
  };
}

/** The right envelope adds its amount to the round score and the team plays again. */
export function openPocket(
  state: PlayingState,
  step: { winning: PocketColor; amount: number },
  chosen: PocketColor,
): ReduceResult {
  const team = state.round.activeTeam;
  const { winning, amount } = step;
  const opened: GameEvent = { type: 'pocketOpened', team, chosen, winning, amount };
  if (chosen !== winning) return passTurn(state, [opened]);
  const teams = updateTeam(state.teams, team, (t) => ({
    ...t,
    roundScore: t.roundScore + amount,
  }));
  return { state: { ...state, teams, step: { kind: 'choosing' } }, events: [opened] };
}
