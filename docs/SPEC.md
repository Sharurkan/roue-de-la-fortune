# Spécification

## But

Ébauche jouable de « La Roue de la Fortune » pour des repas de famille.
On teste en vrai, puis on améliore. Priorité : simple, fiable, code propre.

## Matériel et usage

- La TV affiche le jeu via le navigateur Silk du Fire TV Stick, en plein écran 16:9.
- Un seul téléphone sert de manette. On le passe à l'équipe dont c'est le tour.
- Les deux appareils sont sur le même Wi-Fi.
- Sur la TV, la seule interaction est un appui sur OK pour activer le son.

## Connexion

1. La TV ouvre `?mode=tv`. Elle génère un code de 4 lettres (sans lettres ambiguës comme I ou O).
2. Elle affiche ce code en grand, plus un QR code vers `?mode=manette&code=XXXX`.
3. Le téléphone scanne le QR code et se connecte tout seul.
4. Secours : ouvrir `?mode=manette` et taper le code.
5. Le téléphone garde le code en mémoire et se reconnecte seul après une coupure.
6. La TV garde le code et la partie en mémoire. Un rechargement ne perd rien.
7. Si le code est déjà pris sur le serveur PeerJS, réessayer puis générer un nouveau code.
8. États de connexion visibles des deux côtés : en attente, connecté, déconnecté, erreur.

Note : la mise en relation passe par le serveur public gratuit de PeerJS. Ensuite, les échanges sont directs.

## Règles du jeu

Équipes

- 2 à 4 équipes, noms saisis sur le téléphone (noms par défaut : « Équipe 1 », …).
- Chaque équipe a un score de manche et un total.

Roue (24 cases, dans `game/config.ts`)

- `300, 500, BANQUEROUTE, 200, 800, 400, 600, PASSE, 250, 700, 350, 900, BANQUEROUTE, 150, 450, 550, 200, 1000, 300, PASSE, 650, 400, 500, 750`

Tour de jeu, l'équipe active peut :

- Tourner la roue, puis proposer une consonne.
- Acheter une voyelle (250 €), si son score de manche le permet.
- Proposer la solution.

Consonne

- Consonnes : B C D F G H J K L M N P Q R S T V W X Z.
- Présente : gain = valeur de la case × nombre d'occurrences. L'équipe rejoue.
- Absente : la main passe à l'équipe suivante.

Voyelle

- Voyelles : A E I O U Y. Coût : 250 €, payé même si la voyelle est absente.
- Présente : l'équipe rejoue. Absente : la main passe.

Cases spéciales

- BANQUEROUTE : score de manche de l'équipe à 0, la main passe.
- PASSE : la main passe.

Lettres

- Une lettre déjà proposée ne peut plus l'être (grisée sur le téléphone).
- Plus aucune consonne cachée dans la phrase : message « Il n'y a plus de consonnes » sur la TV et le téléphone, bouton de la roue grisé.
- Plus aucune voyelle cachée : message « Il n'y a plus de voyelles » sur la TV et le téléphone, bouton d'achat grisé.

Solution

- Tapée sur le téléphone.
- Comparaison sans accents, sans casse, sans espaces ni ponctuation.
- Bonne réponse : phrase révélée, l'équipe gagne la manche.
- Mauvaise réponse : la réponse proposée s'affiche sur la TV, la main passe.

Fin de manche

- Seule l'équipe gagnante ajoute son score de manche à son total.
- Les scores de manche repartent à 0.
- La manche suivante commence par une énigme rapide.

Énigme rapide (avant chaque manche normale)

- Énigme tirée d'une liste à part, un peu plus longue que celles de la finale.
- Une case au hasard se dévoile toutes les 1,5 s (`game/config.ts`), jusqu'à un buzz.
- Un seul téléphone : les joueurs crient « Buzz ! », celui qui tient le téléphone touche l'équipe la plus rapide.
- Au buzz, les lettres s'arrêtent. L'équipe a un seul essai, sans minuteur ni annulation.
- Bonne réponse : l'équipe commence la manche. Aucun gain.
- Mauvaise réponse : l'équipe est éliminée de cette énigme, les lettres reprennent.
- Panneau complet sans buzz : on attend quand même un buzz.
- Toutes les équipes éliminées : la manche commence avec l'équipe de la rotation (équipe 1, puis 2…).

Déroulé d'une partie

- 4 manches normales, puis la finale.
- « Abandonner la partie » sur le téléphone, à tout moment, avec confirmation : classement direct, les scores de la manche en cours sont perdus.
- Classement final sur la TV, avec le résultat de la finale. Bouton « Nouvelle partie » sur le téléphone.

Finale

- Finaliste : l'équipe au plus gros total après 4 manches. Égalité : l'équipe ex æquo qui a gagné la 4e manche, sinon la première dans l'ordre.
- Il tourne une petite roue de 8 enveloppes : 500 €, 1 000 €, 1 500 €, 2 000 €, 3 000 €, 5 000 €, Voyage, Bisou (dans `game/config.ts`). Le contenu reste caché jusqu'à la fin.
- Énigme courte (objet, lieu, chanson, film, animal, personnage), tirée d'une liste à part : jamais d'expression ni de proverbe.
- R S T L N E sont révélées d'office (case bleue, puis lettre).
- Le finaliste choisit 3 consonnes et 1 voyelle, gratuitement. Elles sont révélées ensemble une fois toutes choisies.
- Une seule tentative de réponse, sans minuteur.
- Gagné : une somme s'ajoute au total, un cadeau (Voyage, Bisou) est simplement gagné. Gagné ou perdu, l'enveloppe est dévoilée.

Phrases

- Liste intégrée d'environ 40 phrases en français, chacune avec un thème (Expression, Proverbe, Film, Cuisine, Lieu, Objet…).
- Pas de répétition dans une partie (ni pour les énigmes rapides). Si la liste est épuisée, on repart de zéro.
- Normalisation : majuscules, accents retirés (É → E), ligatures dépliées (Œ → OE).
- Apostrophes, tirets et ponctuation sont affichés d'office, jamais cachés.

## Écran TV

- Panneau de lettres façon jeu télé : 14 cases par ligne, retour à la ligne par mot.
- Thème au-dessus du panneau.
- Roue animée (environ 5 s), avec un pointeur fixe en haut et un « tic » à chaque case.
- Scores des équipes, équipe active mise en avant.
- Bandeau de message (lettre trouvée, banqueroute, plus de consonnes…).
- Lettres déjà proposées visibles.
- Révélation des lettres une par une, avec un son.
- Sons simples générés en Web Audio (pas de fichiers audio).
- Lisible de loin : grands caractères, forts contrastes.

## Manette (téléphone)

- Affiche : manche, équipe active, son score, message en cours.
- Configuration : nombre d'équipes, noms, bouton « Commencer ».
- Énigme rapide : un gros bouton par équipe (équipes éliminées grisées), puis saisie de la réponse.
- Tour : boutons « Tourner la roue », « Acheter une voyelle (250 €) », « Proposer la solution ».
- Clavier de consonnes ou de voyelles selon l'étape, lettres utilisées grisées.
- Saisie de la solution avec « Valider » et « Annuler ».
- Fin de manche : « Manche suivante » (« Passer à la finale » après la 4e manche).
- Finale : « Tourner la roue des enveloppes », clavier de 3 consonnes et 1 voyelle, une seule réponse.
- Boutons grisés pendant que la roue tourne.
- Gros boutons, utilisable d'une main.

## Protocole

- Version actuelle du protocole : 3.
- Téléphone → TV : `{ v, type: "action", action }`.
- TV → téléphone : `{ v, type: "state", view }`. La `view` ne contient jamais la solution, ni l'enveloppe de la finale avant la fin.
- Dans les deux sens : `{ v, type: "heartbeat" }` toutes les 5 s. Sans aucun message pendant 15 s, la connexion est considérée comme perdue.
- Tous les messages sont validés avec zod à la réception.
- Version différente : message ignoré et erreur affichée (« Mets à jour la page »).

## Hors périmètre (pour l'instant)

- Plusieurs téléphones en même temps
- Phrases personnalisées
- Cases spéciales avancées, minuteur
- Mode hors ligne sans serveur PeerJS

## Phases

0. Mise en place : Vite + TypeScript strict, ESLint, Prettier, Vitest, scripts npm, `git init`.
1. Test du Fire TV Stick (prioritaire) : page minimale TV + manette avec PeerJS, un ping-pong de messages et un son. Workflow GitHub Actions vers GitHub Pages. L'utilisateur teste sur le vrai Fire Stick. On ne continue pas tant que ce n'est pas validé.
2. Cœur du jeu : `game/` (config, phrases, reducer, events) et `shared/` (normalisation), avec tests.
3. Protocole et réseau : `protocol/` (schémas zod, tests) et `net/` (code de salle, reconnexion).
4. Vue TV.
5. Vue manette.
6. Sauvegarde et reprise (TV et téléphone).
7. Finitions : sons, animations, messages d'erreur, CI complète (check + audit avant déploiement).

Chaque phase se termine par `npm run check` au vert, un résumé, la validation de l'utilisateur, puis un commit.
