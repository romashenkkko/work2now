/** Lungime minimă pentru descrierea experienței (onboarding + salvare în setări dacă completezi câmpul). */
export const MIN_EXPERIENCE_DESCRIPTION_LENGTH = 50;

export const LEGACY_ONBOARDING_DESCRIPTION = "added during onboarding";

/** Pentru editare: placeholder-ul vechi din DB se tratează ca gol ca utilizatorul să poată introduce text real. */
export function descriptionForEditing(raw: string | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  if (s.toLowerCase() === LEGACY_ONBOARDING_DESCRIPTION) return "";
  return s;
}
