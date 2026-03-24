/**
 * Normalize text for search: diacriticele nu sunt obligatorii (Chișinău ≈ chisinau).
 * Păstrează în sync cu client/src/utils/foldForSearch.ts
 */
export function foldForSearch(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ă/gi, "a")
    .replace(/â/gi, "a")
    .replace(/î/gi, "i")
    .replace(/ș|ş/gi, "s")
    .replace(/ț|ţ/gi, "t")
    .toLowerCase()
    .trim();
}
