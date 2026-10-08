import type { ConnectionStatus } from '../net/connection-status';

export const PHONE_TEXTS = {
  title: 'Manette',
  codeLabel: 'Code affiché sur la TV',
  codePlaceholder: 'ABCD',
  connect: 'Se connecter',
  invalidCode: 'Code invalide : 4 lettres, comme sur la TV.',
  room: (code: string) => `Salle ${code}`,
  ping: 'Ping',
  changeCode: 'Changer de code',
  pongs: (count: number) => `Pongs reçus : ${String(count)}`,
  latency: (ms: number) => `Latence : ${String(Math.round(ms))} ms`,
} as const;

const ERROR_LABELS: Record<string, string> = {
  'peer-unavailable': 'TV introuvable, nouvel essai…',
  timeout: 'connexion directe impossible (même Wi-Fi ? Wi-Fi invité ?)',
  network: 'serveur PeerJS injoignable',
  'server-error': 'serveur PeerJS injoignable',
  'socket-error': 'connexion au serveur PeerJS perdue',
  'socket-closed': 'connexion au serveur PeerJS perdue',
  'browser-incompatible': 'navigateur incompatible avec WebRTC',
};

export function statusLabel(status: ConnectionStatus): string {
  switch (status.kind) {
    case 'waiting':
      return 'Connexion en cours…';
    case 'connected':
      return 'Connecté à la TV';
    case 'disconnected':
      return 'Déconnecté, nouvel essai…';
    case 'error':
      return `Erreur : ${ERROR_LABELS[status.reason] ?? status.reason}`;
  }
}
