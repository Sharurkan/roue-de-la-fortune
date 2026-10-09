# Spécification

## But

Ébauche jouable de « La Roue de la Fortune » pour des repas de famille.
On teste en vrai, puis on améliore. Priorité : simple, fiable, code propre.

## Matériel et usage

- La TV affiche le jeu via le navigateur Silk du Fire TV Stick, en plein écran 16:9.
- Deux modes, choisis au début de chaque partie (voir « Modes de jeu ») :
  - un seul téléphone sert de manette, on le passe à l'équipe dont c'est le tour ;
  - un téléphone par équipe.
- La TV et les téléphones sont sur le même Wi-Fi.
- Sur la TV, la seule interaction est un appui sur OK pour activer le son.

## Connexion

1. La TV ouvre `?mode=tv`. Elle génère un code de 4 lettres (sans lettres ambiguës comme I ou O).
2. Elle affiche ce code en grand, plus un QR code vers `?mode=manette&code=XXXX`.
3. Le téléphone scanne le QR code et se connecte tout seul.
4. Secours : ouvrir `?mode=manette` et taper le code.
5. Le téléphone garde le code et un identifiant aléatoire en mémoire. Il se reconnecte seul après une coupure et retrouve son équipe.
6. La TV garde le code et la partie en mémoire. Un rechargement ne perd rien.
7. Si le code est déjà pris sur le serveur PeerJS, réessayer puis générer un nouveau code.
8. États de connexion visibles des deux côtés : en attente, connecté, déconnecté, erreur.

Note : la mise en relation passe par le serveur public gratuit de PeerJS. Ensuite, les échanges sont directs.

## Modes de jeu

- Le premier téléphone connecté est le **maître**. Il choisit le mode, et peut en changer entre deux parties.
- Un seul téléphone : une nouvelle connexion remplace l'ancienne. Le téléphone remplacé affiche « Un autre téléphone a pris la main » et ne se reconnecte plus seul (bouton « Reprendre la main »).
- Un téléphone par équipe (4 au plus) :
  - Chaque téléphone scanne le QR code et tape le nom de son équipe. Ordre de jeu : ordre d'arrivée.
  - La TV liste les équipes inscrites et leur état (connecté, déconnecté).
  - Le maître joue aussi pour son équipe. Il peut retirer une équipe inscrite par erreur, puis lance la partie (2 équipes au moins, dont la sienne).
  - Seule l'équipe dont c'est le tour peut jouer. Les autres téléphones voient « Ce n'est pas ton tour : c'est à X », boutons grisés.
  - Énigme rapide : chaque téléphone a son bouton « BUZZ ! ». Le premier buzz reçu par la TV gagne.
  - Finale : seul le finaliste joue.
  - Manche suivante, abandon, nouvelle partie : maître uniquement.
  - Téléphone de l'équipe active déconnecté : la TV l'indique, on attend sa reconnexion. Le maître peut aussi « Jouer à la place de X » pour ce tour (jamais buzzer à sa place).
- La TV garde le mode, le maître et les équipes. Un rechargement ne perd rien.

## Règles du jeu

Équipes

- 2 à 4 équipes, noms saisis sur le téléphone (noms par défaut : « Équipe 1 », …).
- Chaque équipe a un score de manche et un total.

Roues (une par manche, 24 cases chacune, dans `game/config.ts`, comme à la TV)

- Manche 1 : petites sommes, aucun piège.
- Manche 2 : une case PASSE.
- Manche 3 : une BANQUEROUTE, une PASSE, la case « La Bonne Poche » à midi et la case Mystère à 6 h.
- Manche 4 : une case partagée à midi (25 % BANQUEROUTE, 50 % 5 000 € en or, 25 % BANQUEROUTE) et une PASSE à 16 h.
- La Bonne Poche : deux enveloppes, une rouge et une bleue. L'une contient une somme tirée au hasard (500 à 3 000 €), l'autre rien ; l'enveloppe gagnante est tirée à chaque fois. Bonne enveloppe : la somme s'ajoute au score de manche et l'équipe rejoue. Enveloppe vide : la main passe.
- Mystère (case bleue, « ? » doré puis 500 €) : le panneau se retourne. Une fois sur deux, 500 € par consonne comme une case normale. Sinon un effet tiré au hasard : +1 000 € ou score de manche doublé (l'équipe rejoue), banqueroute (comme la case BANQUEROUTE) ou moitié du score de manche perdue (la main passe).
- Case 5 000 € : gain unique de 5 000 €, quel que soit le nombre de lettres trouvées.
- Force du lancer : sur le téléphone, on garde le doigt sur « Tourner la roue », une jauge monte (pleine en 1,5 s), et la roue part quand on lâche. La force décide de la distance : 2 tours, plus jusqu'à 2 tours de plus à pleine force (`game/config.ts`). La roue repart de là où elle s'est arrêtée : même force depuis la même position, même case. Sans force (clavier), la TV la tire au hasard.
- Roue des enveloppes : la force décide de l'enveloppe qui s'arrête sous le pointeur, mais son contenu est tiré au hasard.

Tour de jeu, l'équipe active peut :

- Tourner la roue, puis proposer une consonne.
- Acheter une voyelle (250 €), si son score de manche le permet.
- Proposer la solution.

Consonne

- Consonnes : B C D F G H J K L M N P Q R S T V W X Z.
- Présente : gain = valeur de la case × nombre d'occurrences (sauf case 5 000 €). L'équipe rejoue.
- Absente : la main passe à l'équipe suivante.

Voyelle

- Voyelles : A E I O U Y. Coût : 250 €, payé même si la voyelle est absente.
- Présente : l'équipe rejoue. Absente : la main passe.

Cases spéciales

- BANQUEROUTE : score de manche et total de l'équipe à 0, dans toutes les manches. La main passe.
- PASSE : la main passe.

Lettres

- Manches 1 à 4 : les touches du téléphone restent toutes pareilles, il faut se souvenir des lettres. Une lettre déjà proposée fait perdre la main, comme à la télé : rien n'est gagné pour une consonne, la voyelle est payée quand même.
- Finale : les lettres déjà proposées ou offertes sont barrées et bloquées.
- Plus aucune consonne cachée dans la phrase : message « Il n'y a plus de consonnes » sur la TV et le téléphone, bouton de la roue grisé.
- Plus aucune voyelle cachée : message « Il n'y a plus de voyelles » sur la TV et le téléphone, bouton d'achat grisé.

Solution

- Tapée sur le téléphone.
- Comparaison sans accents, sans casse, sans espaces ni ponctuation.
- Bonne réponse : phrase révélée, l'équipe gagne la manche.
- Mauvaise réponse : la réponse proposée s'affiche sur la TV, la main passe.

Fin de manche

- Seule l'équipe gagnante ajoute son score de manche à son total.
- Manche 4 (`STAKE_ROUND`) : chaque équipe commence avec son total comme score de manche, tout l'argent est en jeu. À la fin, seule l'équipe gagnante garde son argent ; les autres finissent à 0.
- Les scores de manche repartent à 0.
- La manche suivante commence par une énigme rapide.

Énigme rapide (avant chaque manche normale)

- Énigme tirée d'une liste à part, de 3 mots au plus.
- Une case au hasard se dévoile toutes les 1,5 s (`game/config.ts`), jusqu'à un buzz.
- Un seul téléphone : les joueurs crient « Buzz ! », celui qui tient le téléphone touche l'équipe la plus rapide.
- Un téléphone par équipe : chaque équipe buzze sur son téléphone.
- Au buzz, les lettres s'arrêtent. L'équipe a un seul essai, sans minuteur ni annulation.
- Bonne réponse : l'équipe commence la manche. Aucun gain.
- Mauvaise réponse : l'équipe est éliminée de cette énigme, les lettres reprennent.
- Panneau complet sans buzz : on attend quand même un buzz.
- Toutes les équipes éliminées : la manche commence avec l'équipe de la rotation (équipe 1, puis 2…).

Déroulé d'une partie

- 4 manches normales, puis la finale.
- « Abandonner la partie » sur le téléphone, à tout moment, avec confirmation : classement direct, les scores de la manche en cours sont perdus (en manche 4, chaque équipe garde l'argent qu'elle a en jeu).
- Classement final sur la TV, avec le résultat de la finale. Bouton « Nouvelle partie » sur le téléphone.

Finale

- Finaliste : l'équipe au plus gros total après 4 manches. Égalité : l'équipe ex æquo qui a gagné la 4e manche, sinon la première dans l'ordre.
- Il tourne une petite roue de 8 enveloppes : 500 €, 1 000 €, 1 500 €, 2 000 €, 3 000 €, 5 000 €, Voyage, Bisou (dans `game/config.ts`). Le contenu reste caché jusqu'à la fin.
- Énigme courte (objet, lieu, chanson, film, animal, personnage, cuisine), tirée d'une liste à part : jamais d'expression ni de proverbe. R S T L N E n'y font que 5 à 25 % des lettres, pour que la finale reste difficile.
- R S T L N E sont révélées d'office (case bleue, puis lettre).
- Le finaliste choisit 3 consonnes et 1 voyelle, gratuitement. Elles sont révélées ensemble une fois toutes choisies.
- Une seule tentative de réponse, sans minuteur.
- Gagné : une somme s'ajoute au total, un cadeau (Voyage, Bisou) est simplement gagné. Gagné ou perdu, l'enveloppe est dévoilée.

Phrases

- Liste intégrée d'environ 90 phrases en français, chacune avec un thème (Expression, Proverbe, Film, Cuisine, Lieu, Objet, Chanson, Animal, Personnage, Musique, Sport, Métier, Pays, Dessin animé).
- Thème Musique : deux chansons d'un même interprète, séparées par « & ». Le « & » est affiché d'office ; dans la réponse, on peut taper « & » ou « et ».
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

- Affiche : manche, équipe active, son score, message en cours. Avec un téléphone par équipe : « Ton équipe : X ».
- Choix du mode (maître seulement).
- Configuration avec un seul téléphone : nombre d'équipes, noms, bouton « Commencer ».
- Configuration avec un téléphone par équipe : nom de son équipe, liste des équipes inscrites, « Commencer » pour le maître.
- Mode test (`&test` dans l'adresse de la manette) : choix de la manche de départ (1 à 4, ou la finale), et case forcée pour le prochain tour de roue (dont le milieu ou le bord de la case 5 000 €).
- Énigme rapide : un gros bouton par équipe (équipes éliminées grisées), puis saisie de la réponse.
- Tour : boutons « Tourner la roue » (appui long avec jauge de force), « Acheter une voyelle (250 €) », « Proposer la solution ».
- Finale : lettres offertes (R S T L N E) et déjà choisies barrées, bien distinctes des touches grisées pendant une animation.
- « Il n'y a plus de consonnes » / « de voyelles » : encadré doré bien visible, sur le téléphone et en permanence sur la TV.
- Clavier de consonnes ou de voyelles selon l'étape.
- Saisie de la solution avec « Valider » et « Annuler ».
- Fin de manche : « Manche suivante » (« Passer à la finale » après la 4e manche).
- Finale : « Tourner la roue des enveloppes », clavier de 3 consonnes et 1 voyelle, une seule réponse.
- Boutons grisés tant que la TV anime (roue, lettres, révélation de la réponse).
- Gros boutons, utilisable d'une main.

## Protocole

- Version actuelle du protocole : 10.
- Téléphone → TV :
  - `{ v, type: "hello", clientId }` au début de chaque connexion ;
  - `{ v, type: "chooseMode", mode }`, `{ v, type: "joinTeam", name }`, `{ v, type: "removeTeam", team }` avant la partie ;
  - `{ v, type: "action", action }`.
- TV → téléphone :
  - `{ v, type: "state", view, room }`. La `view` ne contient jamais la solution, ni l'enveloppe de la finale avant la fin. `room` est propre à chaque téléphone : mode, maître ou non, son équipe, équipes inscrites ;
  - `{ v, type: "replaced" }` au téléphone remplacé, avec un seul téléphone.
- La TV vérifie qui envoie chaque message (maître, équipe dont c'est le tour) et ignore le reste.
- Dans les deux sens : `{ v, type: "heartbeat" }` toutes les 5 s. Sans aucun message pendant 15 s, la connexion est considérée comme perdue.
- Tous les messages sont validés avec zod à la réception.
- Version différente : message ignoré et erreur affichée (« Mets à jour la page »).

## Hors périmètre (pour l'instant)

- Reprendre la place d'une équipe en pleine partie avec un autre téléphone
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
