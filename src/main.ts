import './style.css';
import { startTestPhone } from './diagnostic/test-phone';
import { startTestTv } from './diagnostic/test-tv';
import { startPhone } from './phone/phone-app';
import { parseMode } from './shared/mode';
import { startTv } from './tv/tv-app';

const NO_MODE_TEXT = 'Ajoute ?mode=tv ou ?mode=manette à l’adresse.';

const root = document.getElementById('app');
if (root) {
  switch (parseMode(window.location.search)) {
    case 'tv':
      startTv(root);
      break;
    case 'manette':
      startPhone(root);
      break;
    case 'test-tv':
      startTestTv(root);
      break;
    case 'test-manette':
      startTestPhone(root);
      break;
    case null:
      root.textContent = NO_MODE_TEXT;
  }
}
