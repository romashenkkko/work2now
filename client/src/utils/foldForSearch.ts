/**
 * Normalize text for search: diacriticele nu sunt obligatorii (Chișinău ≈ chisinau).
 * Cratima și apostroful sunt ignorate la potrivire (Ceadîr-Lunga ≈ ceadir lunga).
 * Păstrează în sync cu server/src/utils/foldForSearch.ts
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
    .replace(/[\-\u2010-\u2015\u2212\uFF0D]/g, " ")
    .replace(/['\u2019\u02BC\u0060\u00B4]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
