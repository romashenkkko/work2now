export type PayoutFieldErrors = {
  beneficiaryName?: string;
  iban?: string;
  bankName?: string;
};

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function formatIbanDisplay(raw: string): string {
  const compact = normalizeIban(raw);
  if (!compact) return "";
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

/** Mod-97 IBAN check (ISO 13616). */
function ibanChecksumValid(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = "";
  for (const ch of rearranged) {
    const token = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    remainder += token;
    if (remainder.length > 9) {
      remainder = String(Number(remainder) % 97);
    }
  }
  return Number(remainder) % 97 === 1;
}

export function validatePayoutIbanForm(
  beneficiaryName: string,
  ibanRaw: string,
  bankName: string,
  messages: {
    beneficiaryRequired: string;
    beneficiaryTooShort: string;
    beneficiaryInvalid: string;
    ibanRequired: string;
    ibanInvalid: string;
    bankTooLong: string;
  }
): PayoutFieldErrors {
  const errors: PayoutFieldErrors = {};
  const name = beneficiaryName.trim();

  if (name.length < 2) {
    errors.beneficiaryName = name.length === 0 ? messages.beneficiaryRequired : messages.beneficiaryTooShort;
  } else if (!/^[\p{L}\s.'-]{2,200}$/u.test(name)) {
    errors.beneficiaryName = messages.beneficiaryInvalid;
  }

  const iban = normalizeIban(ibanRaw);
  if (!iban) {
    errors.iban = messages.ibanRequired;
  } else if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) {
    errors.iban = messages.ibanInvalid;
  } else if (iban.startsWith("MD") && iban.length !== 24) {
    errors.iban = messages.ibanInvalid;
  } else if (!ibanChecksumValid(iban)) {
    errors.iban = messages.ibanInvalid;
  }

  const bank = bankName.trim();
  if (bank.length > 200) {
    errors.bankName = messages.bankTooLong;
  }

  return errors;
}
