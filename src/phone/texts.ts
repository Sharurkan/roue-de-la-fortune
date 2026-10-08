import type { GameEvent, RejectionReason } from '../game/events';
import type { ConnectionStatus } from '../net/connection-status';

const euros = (amount: number): string => `${amount.toLocaleString('fr-FR')} €`;

export const PHONE_TEXTS = {
  title: 'Manette',
  codeLabel: 'Code affiché sur la TV',
  codePlaceholder: 'ABCD',
  connect: 'Se connecter',
  invalidCode: 'Code invalide : 4 lettres, comme sur la TV.',
  room: (code: string) => `Salle ${code}`,
  changeCode: 'Changer de code',
  codeNotRemembered: 'Code non mémorisé sur ce téléphone : garde le lien ou le QR code.',
  updatePage: 'La TV a une autre version : mets à jour la page.',
  euros,
  setupTitle: 'Nouvelle partie',
  teamCount: "Nombre d'équipes",
  teamPlaceholder: (index: number) => `Équipe ${String(index + 1)}`,
  start: 'Commencer',
  round: (roundNumber: number) => `Manche ${String(roundNumber)}`,
  activeTeam: (name: string, score: number) => `${name} : ${euros(score)}`,
  spin: 'Tourner la roue',
  buyVowel: (cost: number) => `Acheter une voyelle (${euros(cost)})`,
  solve: 'Proposer la solution',
  noMoreConsonants: "Il n'y a plus de consonnes",
  noMoreVowels: "Il n'y a plus de voyelles",
  spinning: 'La roue tourne…',
  chooseConsonant: (value: number) => `Pour ${euros(value)} : choisis une consonne`,
  chooseVowel: 'Choisis une voyelle',
  solutionLabel: 'Ta réponse',
  validate: 'Valider',
  cancel: 'Annuler',
  roundWinner: (name: string) => `${name} gagne la manche !`,
  nextRound: 'Manche suivante',
  endGame: 'Terminer la partie',
  confirmEndGame: 'Confirmer : terminer la partie',
  abandonGame: 'Abandonner la partie',
  confirmAbandonGame: 'Confirmer : abandonner la partie',
  finalRanking: 'Classement final',
  rank: (rank: number) => (rank === 1 ? '1er' : `${String(rank)}e`),
  newGame: 'Nouvelle partie',
} as const;

const STATUS_LABELS: Record<ConnectionStatus['kind'], string> = {
  waiting: 'Connexion en cours…',
  connected: 'Connecté à la TV',
  disconnected: 'Déconnecté, nouvel essai…',
  error: 'Erreur de connexion, nouvel essai…',
};

const ERROR_DETAILS: Record<string, string> = {
  'peer-unavailable': 'TV introuvable',
  timeout: 'connexion directe impossible (même Wi-Fi ?)',
  network: 'serveur PeerJS injoignable',
  'server-error': 'serveur PeerJS injoignable',
};

export function statusLabel(status: ConnectionStatus): string {
  const detail = status.kind === 'error' ? ERROR_DETAILS[status.reason] : undefined;
  return detail === undefined
    ? STATUS_LABELS[status.kind]
    : `${STATUS_LABELS[status.kind]} (${detail})`;
}

const REJECTIONS: Record<RejectionReason, string> = {
  wrongPhase: "Ce n'est pas possible maintenant",
  invalidTeamCount: 'Il faut 2 à 4 équipes',
  invalidLetter: 'Lettre non valable',
  letterAlreadyGuessed: 'Lettre déjà proposée',
  notEnoughMoney: 'Pas assez d’argent pour une voyelle',
  noConsonantsLeft: "Il n'y a plus de consonnes",
  noVowelsLeft: "Il n'y a plus de voyelles",
  invalidAnswer: 'Réponse vide ou trop longue',
};

function eventMessage(event: GameEvent, teamName: (team: number) => string): string | null {
  switch (event.type) {
    case 'bankrupt':
      return `Banqueroute pour ${teamName(event.team)} !`;
    case 'landedOnPass':
      return `Passe : ${teamName(event.team)} passe son tour`;
    case 'letterFound':
      return event.gain > 0
        ? `${String(event.count)} × ${event.letter} : +${euros(event.gain)}`
        : `${String(event.count)} × ${event.letter}`;
    case 'letterAbsent':
      return `Pas de ${event.letter}`;
    case 'turnPassed':
      return `${teamName(event.team)} prend la main`;
    case 'noMoreConsonants':
      return "Il n'y a plus de consonnes";
    case 'noMoreVowels':
      return "Il n'y a plus de voyelles";
    case 'wrongSolution':
      return 'Mauvaise réponse';
    case 'roundWon':
      return `${teamName(event.team)} gagne ${euros(event.amount)}`;
    case 'actionRejected':
      return REJECTIONS[event.reason];
    case 'roundStarted':
    case 'wheelSpun':
    case 'vowelBought':
    case 'gameOver':
      return null;
  }
}

export interface BannerMessage {
  text: string;
  isError: boolean;
}

/** One line summing up what the last action did, or null if there is nothing to say. */
export function messageFor(
  events: readonly GameEvent[],
  teamName: (team: number) => string,
): BannerMessage | null {
  const texts = events
    .map((event) => eventMessage(event, teamName))
    .filter((text): text is string => text !== null);
  if (texts.length === 0) return null;
  return { text: texts.join(' · '), isError: events.some((e) => e.type === 'actionRejected') };
}
