import './style.css';
import { startPhone } from './phone/phone-app';
import { parseMode } from './shared/mode';
import { startTv } from './tv/tv-app';

const NO_MODE_TEXT = 'Ajoute ?mode=tv ou ?mode=manette à l’adresse.';

const root = document.getElementById('app');
if (root) {
  const mode = parseMode(window.location.search);
  if (mode === 'tv') startTv(root);
  else if (mode === 'manette') startPhone(root);
  else root.textContent = NO_MODE_TEXT;
}
