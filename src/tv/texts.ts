import { FINAL_PRIZES, type Prize } from '../game/config';
import type { GameEvent } from '../game/events';
import type { ConnectionStatus } from '../net/connection-status';

const euros = (amount: number): string => `${amount.toLocaleString('fr-FR')} €`;

export function prizeLabel(prize: Prize): string {
  return prize.kind === 'money' ? euros(prize.amount) : prize.label;
}

function prizeAt(prizeIndex: number): string {
  const prize = FINAL_PRIZES[prizeIndex];
  return prize === undefined ? '' : prizeLabel(prize);
}

export const TV_TEXTS = {
  title: 'La Roue de la Fortune',
  finalTitle: 'Finale',
  finalHint: 'Sur le téléphone : 3 consonnes et 1 voyelle',
  pickedLetters: 'Lettres choisies',
  finalWon: (name: string, prize: string) => `${name} remporte l'enveloppe : ${prize} !`,
  finalLost: (name: string, prize: string) => `L'enveloppe de ${name} contenait : ${prize}`,
  roomCode: (code: string) => `Salle ${code}`,
  scanToPlay: 'Scanne le QR code avec le téléphone',
  orOpen: 'ou ouvre :',
  configureOnPhone: 'Configure les équipes sur le téléphone',
  soundButton: 'Appuie sur OK pour activer le son',
  soundHint: 'Son coupé : appuie sur OK',
  soundOn: 'Son activé',
  storageFailed: 'Sauvegarde impossible : le code changera au rechargement',
  saveFailed: 'Sauvegarde de la partie impossible',
  saveUnreadable: 'Partie précédente illisible : nouvelle partie',
  gameResumed: 'Partie reprise',
  offline: 'Pas de connexion Internet',
  consonantFor: (amount: number) => `${euros(amount)} : propose une consonne`,
  round: (roundNumber: number) => `Manche ${String(roundNumber)}`,
  tossUp: (roundNumber: number) => `Manche ${String(roundNumber)} · Énigme rapide`,
  tossUpHint: 'Criez « Buzz ! » et touchez votre équipe sur le téléphone',
  usedLetters: 'Lettres proposées',
  noUsedLetters: 'aucune',
  euros,
  total: (amount: number) => `Total : ${euros(amount)}`,
  waitingForNextRound: 'Sur le téléphone : manche suivante ou fin de partie',
  finalRanking: 'Classement final',
  rank: (rank: number) => (rank === 1 ? '1er' : `${String(rank)}e`),
  newGameOnPhone: 'Nouvelle partie depuis le téléphone',
  updateController: 'Manette pas à jour : recharge la page sur le téléphone',
  wheel: { bankrupt: 'BANQUEROUTE', pass: 'PASSE', pocketCaption: 'LA BONNE', pocket: 'POCHE' },
  pocketHint: 'Sur le téléphone : enveloppe rouge ou bleue ?',
  pocketRed: 'Rouge',
  pocketBlue: 'Bleue',
  pocketEmpty: 'Rien',
} as const;

const STATUS_LABELS: Record<ConnectionStatus['kind'], string> = {
  waiting: 'En attente de la manette',
  connected: 'Manette connectée',
  disconnected: 'Manette déconnectée',
  error: 'Erreur de connexion',
};

const ERROR_DETAILS: Record<string, string> = {
  network: 'serveur PeerJS injoignable',
  'server-error': 'serveur PeerJS injoignable',
  'socket-error': 'connexion au serveur PeerJS perdue',
  'socket-closed': 'connexion au serveur PeerJS perdue',
  'unavailable-id': 'code déjà pris, nouvel essai',
  'browser-incompatible': 'navigateur incompatible avec WebRTC',
};

export function statusLabel(status: ConnectionStatus): string {
  const detail = status.kind === 'error' ? ERROR_DETAILS[status.reason] : undefined;
  return detail === undefined
    ? STATUS_LABELS[status.kind]
    : `${STATUS_LABELS[status.kind]} : ${detail}`;
}

/** Banner message for an event, or null when the event is not worth a message. */
export function eventMessage(event: GameEvent, teamName: (team: number) => string): string | null {
  switch (event.type) {
    case 'tossUpStarted':
      return 'Énigme rapide : le premier qui buzze commence la manche !';
    case 'buzzed':
      return `${teamName(event.team)} a buzzé !`;
    case 'tossUpWrong':
      return `« ${event.answer} » : raté pour ${teamName(event.team)}`;
    case 'tossUpWon':
      return `Bravo ! ${teamName(event.team)} commence la manche`;
    case 'tossUpFailed':
      return `Personne n'a trouvé : ${teamName(event.team)} commence`;
    case 'roundStarted':
      return `Manche ${String(event.roundNumber)} : c'est parti !`;
    case 'bankrupt':
      return `BANQUEROUTE ! ${teamName(event.team)} perd son score de manche`;
    case 'pocketOffered':
      return `La Bonne Poche ! ${teamName(event.team)}, rouge ou bleue ?`;
    case 'pocketOpened':
      return event.chosen === event.winning
        ? `Bonne poche ! ${teamName(event.team)} gagne ${euros(event.amount)}`
        : `Raté ! L'argent était dans l'enveloppe ${event.winning === 'red' ? 'rouge' : 'bleue'}`;
    case 'landedOnPass':
      return `PASSE ! ${teamName(event.team)} passe son tour`;
    case 'letterFound':
      return event.count === 1
        ? `Il y a un ${event.letter} !`
        : `Il y a ${String(event.count)} ${event.letter} !`;
    case 'letterAbsent':
      return `Pas de ${event.letter}…`;
    case 'turnPassed':
      return `${teamName(event.team)} prend la main`;
    case 'noMoreConsonants':
      return "Il n'y a plus de consonnes";
    case 'noMoreVowels':
      return "Il n'y a plus de voyelles";
    case 'wrongSolution':
      return `« ${event.answer} » : mauvaise réponse`;
    case 'roundWon':
      return `${teamName(event.team)} gagne la manche et ${euros(event.amount)} !`;
    case 'finalStarted':
      return `${teamName(event.finalist)} va en finale !`;
    case 'finalLettersGiven':
      return `On vous offre ${event.letters.join(' ')}`;
    case 'finalLetterPicked':
      return `${event.letter} choisie`;
    case 'finalLettersRevealed':
      return `Voyons ${event.letters.join(' ')}…`;
    case 'finalWon':
      return `Bravo ! ${teamName(event.finalist)} gagne : ${prizeAt(event.prizeIndex)}`;
    case 'finalLost':
      return `« ${event.answer} »… Perdu ! C'était : ${prizeAt(event.prizeIndex)}`;
    case 'gameOver':
      return 'Fin de la partie !';
    case 'tossUpLetterRevealed':
    case 'prizeWheelSpun':
    case 'wheelSpun':
    case 'vowelBought':
    case 'actionRejected':
      return null;
  }
}
