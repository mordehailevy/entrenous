/**
 * Normalise une chaîne pour une comparaison de recherche insensible à la
 * casse et aux accents (ex : "deborah" doit trouver "Déborah").
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase()
    .trim();
}
