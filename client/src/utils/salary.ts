/**
 * Salary display by role:
 * - Business: sees base + 22.5% government tax + 10% platform fee (full cost to pay).
 * - Staff: sees base - 22.5% (net after government tax; no platform fee).
 */

export const GOV_TAX_RATE = 0.225;
export const PLATFORM_FEE_RATE = 0.1;

/** Full amount business pays: base + tax + platform. */
export function getBusinessTotal(baseTotal: number): number {
  return baseTotal * (1 + GOV_TAX_RATE + PLATFORM_FEE_RATE);
}

/** Amount staff sees (net after tax). */
export function getStaffNet(baseTotal: number): number {
  return baseTotal * (1 - GOV_TAX_RATE);
}

/** Round to 2 decimals for display. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
