import type { GameEvent } from '../game/events';
import type { ConnectionStatus } from '../net/connection-status';

const euros = (amount: number): string => `${amount.toLocaleString('fr-FR')} €`;

export const TV_TEXTS = {
  title: 'La Roue de la Fortune',
  roomCode: (code: string) => `Salle ${code}`,
  scanToPlay: 'Scanne le QR code avec le téléphone',
  orOpen: 'ou ouvre :',
  configureOnPhone: 'Configure les équipes sur le téléphone',
  soundButton: 'Appuie sur OK pour activer le son',
  soundHint: 'Son coupé : appuie sur OK',
  soundOn: 'Son activé',
  storageFailed: 'Sauvegarde impossible : le code changera au rechargement',
  consonantFor: (amount: number) => `${euros(amount)} : propose une consonne`,
  round: (roundNumber: number) => `Manche ${String(roundNumber)}`,
  usedLetters: 'Lettres proposées',
  noUsedLetters: 'aucune',
  euros,
  total: (amount: number) => `Total : ${euros(amount)}`,
  waitingForNextRound: 'Sur le téléphone : manche suivante ou fin de partie',
  finalRanking: 'Classement final',
  rank: (rank: number) => (rank === 1 ? '1er' : `${String(rank)}e`),
  newGameOnPhone: 'Nouvelle partie depuis le téléphone',
  updateController: 'Manette pas à jour : recharge la page sur le téléphone',
  wheel: { bankrupt: 'BANQUEROUTE', pass: 'PASSE' },
} as const;

const STATUS_LABELS: Record<ConnectionStatus['kind'], string> = {
  waiting: 'En attente de la manette',
  connected: 'Manette connectée',
  disconnected: 'Manette déconnectée',
  error: 'Erreur de connexion',
};

export function statusLabel(status: ConnectionStatus): string {
  return STATUS_LABELS[status.kind];
}

/** Banner message for an event, or null when the event is not worth a message. */
export function eventMessage(event: GameEvent, teamName: (team: number) => string): string | null {
  switch (event.type) {
    case 'roundStarted':
      return `Manche ${String(event.roundNumber)} : c'est parti !`;
    case 'bankrupt':
      return `BANQUEROUTE ! ${teamName(event.team)} perd son score de manche`;
    case 'landedOnPass':
      return `PASSE ! ${teamName(event.team)} passe son tour`;
    case 'letterFound':
      return event.count === 1
        ? `Il y a un ${event.letter} !`
        : `Il y a ${String(event.count)} ${event.letter} !`;
    case 'letterAbsent':
      return `Pas de ${event.letter}…`;
    case 'turnPassed':
      return `À ${teamName(event.team)} de jouer`;
    case 'noMoreConsonants':
      return "Il n'y a plus de consonnes";
    case 'noMoreVowels':
      return "Il n'y a plus de voyelles";
    case 'wrongSolution':
      return `« ${event.answer} » : mauvaise réponse`;
    case 'roundWon':
      return `${teamName(event.team)} gagne la manche et ${euros(event.amount)} !`;
    case 'gameOver':
      return 'Fin de la partie !';
    case 'wheelSpun':
    case 'vowelBought':
    case 'actionRejected':
      return null;
  }
}
