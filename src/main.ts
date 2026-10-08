import { parseMode, type AppMode } from './shared/mode';

const TEXTS: Record<AppMode | 'none', string> = {
  tv: 'Mode TV',
  manette: 'Mode manette',
  none: 'Ajoute ?mode=tv ou ?mode=manette à l’adresse.',
};

const root = document.getElementById('app');
if (root) {
  root.textContent = TEXTS[parseMode(window.location.search) ?? 'none'];
}
