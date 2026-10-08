import type { ConnectionStatus } from '../net/connection-status';

export const TV_TEXTS = {
  title: 'Roue de la Fortune',
  subtitle: 'Test du Fire TV Stick',
  roomCodeLabel: 'Code de la salle',
  controllerUrlLabel: 'Sur le téléphone, ouvre :',
  soundButton: 'Appuie sur OK pour activer le son',
  soundOn: 'Son activé',
  soundFailed: 'Impossible d’activer le son',
  soundUnavailable: 'Son non disponible sur ce navigateur',
  pingsReceived: (count: number) => `Pings reçus : ${String(count)}`,
  storageFailed: 'Sauvegarde impossible : le code changera au rechargement.',
  diagnosticsTitle: 'Diagnostic',
  yes: 'oui',
  no: 'non',
  diagnostics: {
    browser: 'Navigateur',
    userAgent: 'User agent',
    webRtc: 'WebRTC (canal de données)',
    webAudio: 'Web Audio',
    wakeLock: 'Écran maintenu allumé (Wake Lock)',
    storage: 'Sauvegarde locale',
    screen: 'Écran',
  },
  errorsTitle: 'Erreurs',
} as const;

const ERROR_LABELS: Record<string, string> = {
  'unavailable-id': 'code déjà pris, nouvel essai',
  network: 'serveur PeerJS injoignable',
  'server-error': 'serveur PeerJS injoignable',
  'socket-error': 'connexion au serveur PeerJS perdue',
  'socket-closed': 'connexion au serveur PeerJS perdue',
  'browser-incompatible': 'navigateur incompatible avec WebRTC',
};

export function statusLabel(status: ConnectionStatus): string {
  switch (status.kind) {
    case 'waiting':
      return 'En attente de la manette';
    case 'connected':
      return 'Manette connectée';
    case 'disconnected':
      return 'Manette déconnectée';
    case 'error':
      return `Erreur : ${ERROR_LABELS[status.reason] ?? status.reason}`;
  }
}
