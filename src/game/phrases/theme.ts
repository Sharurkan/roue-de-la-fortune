export const THEMES = [
  'Expression',
  'Proverbe',
  'Film',
  'Cuisine',
  'Lieu',
  'Objet',
  'Chanson',
  'Animal',
  'Personnage',
  'Musique',
  'Sport',
  'Métier',
  'Pays',
  'Dessin animé',
  'Série TV',
  'Jeu vidéo',
  'Personnage historique',
  'Ville',
  'Monument',
  'Fruit et légume',
  'Instrument',
  'Vêtement',
  'Dans la maison',
  'Nature',
  'Véhicule',
  'Jeu de société',
  'Fête',
  'Super-héros',
  'Livre',
  'Corps humain',
  'Boisson',
] as const;

export type Theme = (typeof THEMES)[number];

export interface Phrase {
  text: string;
  theme: Theme;
}

/** Writes the lists compactly: one theme, many texts. */
export function group(theme: Theme, texts: readonly string[]): Phrase[] {
  return texts.map((text) => ({ theme, text }));
}
