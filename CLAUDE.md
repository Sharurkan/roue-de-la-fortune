# Roue de la Fortune (jeu familial)

Jeu inspiré de « La Roue de la Fortune », pour des repas de famille.

- Écran TV : navigateur Silk d'un Amazon Fire TV Stick (`?mode=tv`).
- Manette : navigateur d'un téléphone (`?mode=manette`).
- Connexion directe TV ↔ téléphone via PeerJS (WebRTC). Pas de serveur à nous.
- Site statique hébergé gratuitement sur GitHub Pages.

Spécification complète : @docs/SPEC.md

## Commandes

- `npm run dev` : serveur local
- `npm run build` : build de production
- `npm run typecheck` : vérification TypeScript
- `npm run lint` : ESLint
- `npm run format` : Prettier
- `npm test` : Vitest
- `npm run check` : typecheck + lint + tests (à lancer avant chaque commit)

## Stack

- TypeScript strict, Vite, aucun framework UI
- PeerJS pour la connexion, `zod` pour valider les messages reçus
- Vitest pour les tests, ESLint + Prettier pour le style
- Cible navigateur : ES2020 (le Fire TV Stick n'a pas un navigateur récent)
- Dépendances à versions fixes (pas de `^` ni `~`). Toute nouvelle dépendance doit être justifiée et validée par l'utilisateur.

## Architecture

```
src/
  game/      Règles du jeu pures : état, actions, reducer, config, phrases
  protocol/  Types et schémas zod des messages TV ↔ téléphone (versionnés)
  net/       Connexion PeerJS : code de salle, envoi, réception, reconnexion
  storage/   Sauvegarde locale (localStorage), avec gestion d'erreurs
  tv/        Vue TV : roue, panneau de lettres, scores, sons, QR code
  phone/     Vue manette : boutons, clavier de lettres, saisie de solution
  shared/    Utilitaires communs (normalisation de texte, DOM sûr)
  main.ts    Choix du mode selon l'URL
```

Règles de dépendance (à respecter strictement) :

- `game/` ne dépend de rien d'autre : ni DOM, ni réseau, ni `localStorage`, ni `Math.random`.
- `protocol/` dépend seulement de `game/` (types) et de `zod`.
- `net/` ne connaît pas les règles du jeu. Il transporte des messages déjà typés.
- `tv/` et `phone/` assemblent le tout. Ils ne contiennent aucune règle du jeu.

Principes :

- Le reducer est la seule source de vérité : `reduce(state, action, deps) → { state, events }`.
- Les `events` (lettre trouvée, banqueroute, manche gagnée…) pilotent sons et animations.
- Le hasard et l'horloge sont injectés via `deps`, pour des tests reproductibles.
- La TV détient l'état. Le téléphone envoie des actions et reçoit une vue publique.
- Valeurs de jeu (cases de la roue, prix des voyelles, limites) dans `game/config.ts`, jamais en dur ailleurs.

## Règles de code

- `strict: true`, pas de `any`, pas de `as` sauf justification en commentaire
- Fonctions courtes, une responsabilité, noms explicites en anglais
- Langue : code, commentaires, noms de tests, messages de lint et commits en anglais
- Textes affichés (interface, phrases, thèmes) en français, centralisés dans un fichier par vue
- Pas de code mort, pas de `console.log` laissé dans le code livré
- Commentaires seulement pour expliquer un « pourquoi » non évident
- Unions discriminées pour les actions, les phases et les messages
- Toute erreur réseau ou de stockage est gérée et affichée simplement à l'écran

## Sécurité

- Tout message reçu est non fiable : validé avec zod, sinon ignoré
- Le reducer refuse toute action invalide pour la phase en cours
- Jamais d'`innerHTML` avec du texte variable. Utiliser `textContent` ou les helpers de `shared/`
- La solution n'est jamais envoyée au téléphone
- Une seule manette connectée à la fois : une nouvelle connexion remplace l'ancienne
- Pas de données personnelles, pas de secrets dans le code
- `npm audit` sans vulnérabilité haute ou critique

## Tests

- `game/` : couverture élevée, chaque règle de docs/SPEC.md a au moins un test
- `protocol/` : tests des schémas (messages valides et invalides)
- `shared/` : tests de la normalisation de texte
- Écrire le test avant ou avec le code, jamais après coup « pour la forme »

## Workflow

- Avancer phase par phase (voir docs/SPEC.md, section « Phases »)
- Avant chaque phase : proposer un plan court et attendre la validation
- Après chaque phase : lancer `npm run check`, résumer, attendre la validation, puis commit
- Commits courts au format Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`…)
- Ne jamais `git push`, créer de dépôt ou modifier les réglages GitHub sans accord explicite
- En cas de doute sur une règle du jeu : demander, ne pas inventer
- Signaler clairement tout ce qui n'a pas pu être vérifié (en particulier sur le Fire TV Stick)

## Style de réponse

- Répondre en français, court et simple
- Dire ce qui est fait, ce qui reste, et ce qui a échoué
