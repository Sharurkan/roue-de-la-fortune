import type { MysteryEffect, Prize, WheelSegment } from '../game/config';
import type { SlotPart } from '../game/state';
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
  offline: 'Pas de connexion Internet : vérifie le Wi-Fi du téléphone.',
  euros,
  setupTitle: 'Nouvelle partie',
  teamCount: "Nombre d'équipes",
  teamPlaceholder: (index: number) => `Équipe ${String(index + 1)}`,
  start: 'Commencer',
  firstRound: 'Mode test : manche de départ',
  forcedSpin: 'Mode test : case forcée',
  randomSpin: 'Au hasard',
  segmentLabel: (segment: WheelSegment, part: SlotPart): string => {
    switch (segment.kind) {
      case 'value':
        return euros(segment.amount);
      case 'jackpot':
        return part === 'middle' ? euros(segment.amount) : 'Banqueroute (bord du 5 000)';
      case 'bankrupt':
        return 'Banqueroute';
      case 'pass':
        return 'Passe';
      case 'pocket':
        return 'La Bonne Poche';
      case 'mystery':
        return 'Mystère';
    }
  },
  firstRoundChoice: (round: number, isFinal: boolean) => (isFinal ? 'Finale' : String(round)),
  round: (roundNumber: number) => `Manche ${String(roundNumber)}`,
  tossUp: 'Énigme rapide',
  whoBuzzed: 'Qui a buzzé en premier ?',
  buzzHint: 'Criez « Buzz ! », puis touchez votre équipe',
  tossUpAnswer: (name: string) => `${name} : ta réponse`,
  activeTeam: (name: string, score: number) => `${name} : ${euros(score)}`,
  spin: 'Tourner la roue',
  buyVowel: (cost: number) => `Acheter une voyelle (${euros(cost)})`,
  solve: 'Proposer la solution',
  noMoreConsonants: "Il n'y a plus de consonnes",
  noMoreVowels: "Il n'y a plus de voyelles",
  spinning: 'La roue tourne…',
  chooseConsonant: (value: number) => `Pour ${euros(value)} : choisis une consonne`,
  chooseVowel: 'Choisis une voyelle',
  choosePocket: 'La Bonne Poche : quelle enveloppe ?',
  redPocket: 'Enveloppe rouge',
  bluePocket: 'Enveloppe bleue',
  solutionLabel: 'Ta réponse',
  validate: 'Valider',
  cancel: 'Annuler',
  roundWinner: (name: string) => `${name} gagne la manche !`,
  nextRound: 'Manche suivante',
  toFinal: 'Passer à la finale',
  final: (name: string) => `Finale · ${name}`,
  spinPrizeWheel: 'Tourner la roue des enveloppes',
  prizeSpinning: 'La roue des enveloppes tourne…',
  finalPicks: (consonants: number, vowels: number) => {
    const parts = [
      consonants > 0 ? `${String(consonants)} consonne${consonants > 1 ? 's' : ''}` : '',
      vowels > 0 ? `${String(vowels)} voyelle` : '',
    ].filter((part) => part !== '');
    return `Choisis encore ${parts.join(' et ')}`;
  },
  finalAnswer: 'Une seule chance : ta réponse',
  finalWon: (name: string, prize: string) => `${name} gagne l'enveloppe : ${prize} !`,
  finalLost: (name: string, prize: string) => `Perdu ! L'enveloppe de ${name} contenait : ${prize}`,
  abandonGame: 'Abandonner la partie',
  confirmAbandonGame: 'Confirmer : abandonner la partie',
  finalRanking: 'Classement final',
  rank: (rank: number) => (rank === 1 ? '1er' : `${String(rank)}e`),
  newGame: 'Nouvelle partie',
  chooseMode: 'Comment jouez-vous ?',
  singleMode: 'Un seul téléphone',
  singleModeHint: "On passe le téléphone à l'équipe dont c'est le tour.",
  multiMode: 'Un téléphone par équipe',
  multiModeHint: 'Chaque équipe scanne le QR code de la TV avec son téléphone.',
  masterChoosesMode: 'Le premier téléphone connecté choisit le mode de jeu.',
  toMultiMode: 'Passer à un téléphone par équipe',
  toSingleMode: 'Passer à un seul téléphone',
  ownTeamName: 'Nom de ton équipe',
  joinTeam: 'Rejoindre la partie',
  renameTeam: 'Renommer',
  teamsFull: 'Toutes les places sont prises.',
  joinedTeams: 'Équipes inscrites',
  noTeamYet: "Aucune équipe pour l'instant.",
  you: '(toi)',
  disconnected: 'déconnecté',
  removeTeam: 'Retirer',
  needTeams: (count: number) => `Il faut au moins ${String(count)} équipes.`,
  masterMustJoin: 'Rejoins la partie avec ton équipe pour pouvoir la lancer.',
  masterStarts: 'Le premier téléphone connecté lancera la partie.',
  masterMovesOn: "C'est le premier téléphone connecté qui lance la suite.",
  yourTeam: (name: string) => `Ton équipe : ${name}`,
  notYourTurn: (name: string) => `Ce n'est pas ton tour : c'est à ${name}`,
  teamDisconnected: (name: string) => `Le téléphone de ${name} est déconnecté.`,
  standIn: (name: string) => `Jouer à la place de ${name}`,
  buzz: 'BUZZ !',
  eliminated: 'Ton équipe a déjà répondu à cette énigme.',
  noTeamWatching: "Tu n'as pas d'équipe dans cette partie.",
  replaced: 'Un autre téléphone a pris la main.',
  takeOver: 'Reprendre la main',
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

const MYSTERY_TEXTS: Record<MysteryEffect | 'money', string> = {
  money: 'Mystère : 500 € par lettre',
  bonus: 'Mystère : +1 000 € !',
  double: 'Mystère : score doublé !',
  bankrupt: 'Mystère : banqueroute !',
  half: 'Mystère : moitié perdue',
};

const REJECTIONS: Record<RejectionReason, string> = {
  wrongPhase: "Ce n'est pas possible maintenant",
  invalidTeamCount: 'Il faut 2 à 4 équipes',
  invalidLetter: 'Lettre non valable',
  letterAlreadyGuessed: 'Lettre déjà proposée',
  notEnoughMoney: 'Pas assez d’argent pour une voyelle',
  noConsonantsLeft: "Il n'y a plus de consonnes",
  noVowelsLeft: "Il n'y a plus de voyelles",
  invalidAnswer: 'Réponse vide ou trop longue',
  noPicksLeft: 'Tu as déjà choisi toutes les lettres de ce type',
  invalidTeam: 'Équipe inconnue',
  invalidRound: 'Manche inconnue',
  invalidPocket: 'Enveloppe inconnue',
  invalidSegment: 'Case inconnue',
  teamEliminated: 'Cette équipe a déjà répondu',
};

function eventMessage(event: GameEvent, teamName: (team: number) => string): string | null {
  switch (event.type) {
    case 'tossUpStarted':
      return 'Énigme rapide : buzzez dès que vous savez !';
    case 'buzzed':
      return `${teamName(event.team)} a buzzé`;
    case 'tossUpWrong':
      return `Raté pour ${teamName(event.team)}`;
    case 'tossUpWon':
      return `${teamName(event.team)} commence la manche !`;
    case 'tossUpFailed':
      return `Personne n'a trouvé : ${teamName(event.team)} commence`;
    case 'bankrupt':
      return `Banqueroute : ${teamName(event.team)} perd tout son argent !`;
    case 'mysteryRevealed':
      return MYSTERY_TEXTS[event.outcome];
    case 'pocketOffered':
      return 'La Bonne Poche !';
    case 'pocketOpened':
      return event.chosen === event.winning
        ? `Bonne poche : +${euros(event.amount)}`
        : 'Enveloppe vide';
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
    case 'finalStarted':
      return `${teamName(event.finalist)} va en finale !`;
    case 'finalLettersGiven':
      return `${event.letters.join(' ')} offertes`;
    case 'finalLetterPicked':
      return `${event.letter} choisie`;
    case 'finalLettersRevealed':
      return `${event.letters.join(' ')} révélées`;
    case 'finalLost':
      return 'Mauvaise réponse';
    case 'roundStarted':
    case 'tossUpLetterRevealed':
    case 'wheelSpun':
    case 'vowelBought':
    case 'prizeWheelSpun':
    case 'finalWon':
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

export function prizeLabel(prize: Prize): string {
  return prize.kind === 'money' ? euros(prize.amount) : prize.label;
}
