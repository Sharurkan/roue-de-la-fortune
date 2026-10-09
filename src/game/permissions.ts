import type { GameAction, GameState } from './state';

/**
 * With one phone per team: who may send an action. Null when no phone may,
 * either because the TV sends it or because nobody can act at this moment.
 */
export type ActionOwner = { kind: 'master' } | { kind: 'team'; team: number };

export interface Actor {
  team: number;
  /** The first phone connected: it runs the game and plays for its own team. */
  isMaster: boolean;
}

/** Team whose turn it is, or null when no team is playing. */
export function turnTeam(state: GameState): number | null {
  switch (state.phase) {
    case 'playing':
      return state.round.activeTeam;
    case 'tossUp':
      return state.tossUp.buzzer;
    case 'final':
      return state.finalist;
    case 'setup':
    case 'roundOver':
    case 'gameOver':
      return null;
  }
}

export function actionOwner(state: GameState, action: GameAction): ActionOwner | null {
  switch (action.type) {
    case 'startGame':
    case 'nextRound':
    case 'abandonGame':
    case 'newGame':
      return { kind: 'master' };
    case 'buzz':
      return { kind: 'team', team: action.team };
    case 'revealTossUpLetter':
    case 'spinEnded':
      return null;
    case 'spin':
    case 'guessConsonant':
    case 'choosePocket':
    case 'buyVowel':
    case 'guessVowel':
    case 'startSolving':
    case 'submitSolution':
    case 'cancel': {
      const team = turnTeam(state);
      return team === null ? null : { kind: 'team', team };
    }
  }
}

/**
 * The master may play the turn of a team whose phone is disconnected, so that
 * the game is never stuck. It may not buzz for another team.
 */
export function canAct(
  state: GameState,
  action: GameAction,
  actor: Actor,
  isTeamConnected: (team: number) => boolean,
): boolean {
  const owner = actionOwner(state, action);
  if (owner === null) return false;
  if (owner.kind === 'master') return actor.isMaster;
  if (owner.team === actor.team) return true;
  return actor.isMaster && action.type !== 'buzz' && !isTeamConnected(owner.team);
}
