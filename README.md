# La Roue de la Fortune

Jeu familial inspiré de « La Roue de la Fortune ». La TV affiche le jeu, un téléphone sert de manette.

## Jouer

1. Sur la TV (navigateur Silk du Fire TV Stick), ouvrir :
   https://sharurkan.github.io/roue-de-la-fortune/?mode=tv
2. Appuyer sur **OK** avec la télécommande pour activer le son.
3. Sur le téléphone, scanner le QR code affiché sur la TV.
   Sinon, ouvrir https://sharurkan.github.io/roue-de-la-fortune/?mode=manette et taper le code de 4 lettres.
4. Sur le téléphone : choisir le nombre d'équipes, taper les noms, puis « Commencer ».
5. Passer le téléphone à l'équipe dont c'est le tour.

Les deux appareils doivent être sur le même Wi-Fi. Évitez le Wi-Fi « invité » : il bloque souvent la connexion directe.

## Règles en bref

- Tourner la roue, puis proposer une consonne : on gagne la valeur de la case pour chaque lettre trouvée.
- Acheter une voyelle coûte 250 €, même si elle est absente.
- Lettre absente, BANQUEROUTE ou PASSE : la main passe à l'équipe suivante. BANQUEROUTE remet aussi le score de la manche à 0.
- Proposer la solution : la bonne réponse fait gagner la manche, et seule l'équipe gagnante garde son score de manche.
- Fin de manche : « Manche suivante » ou « Terminer la partie ». « Abandonner la partie » marche à tout moment.

Règles complètes : [docs/SPEC.md](docs/SPEC.md).

## En cas de souci

- **La TV ne fait pas de bruit** : appuyer sur OK avec la télécommande.
- **Le téléphone ne se connecte pas** : vérifier le Wi-Fi des deux appareils, puis recharger la page du téléphone.
- **La page a été rechargée** : la partie reprend toute seule, sur la TV comme sur le téléphone.
- **« Mets à jour la page »** : recharger la page sur les deux appareils.

## Pages de test

Pour vérifier qu'un appareil est compatible (connexion, son, diagnostic) :

- TV : `?mode=test-tv`
- Téléphone : `?mode=test-manette`

## Développement

Node.js 22 ou plus.

```bash
npm install
npm run dev
```

- `npm run check` : types, lint et tests (avant chaque commit)
- `npm run build` : version de production
- Chaque push sur `main` est vérifié puis déployé sur GitHub Pages.

Règles du projet pour le code : [CLAUDE.md](CLAUDE.md).
