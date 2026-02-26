/**
 * Salary display by role:
 * - Business: sees base + 24% tax + 10% maintenance (full cost to pay).
 * - Staff: sees base - 9% - 12% (net after deductions).
 */

export const BUSINESS_TAX_RATE = 0.24;
export const BUSINESS_MAINTENANCE_RATE = 0.1;
export const STAFF_DEDUCTION_RATE_1 = 0.09;
export const STAFF_DEDUCTION_RATE_2 = 0.12;

/** Full amount business pays: base + tax + maintenance. */
export function getBusinessTotal(baseTotal: number): number {
  return baseTotal * (1 + BUSINESS_TAX_RATE + BUSINESS_MAINTENANCE_RATE);
}

/** Amount staff sees (net after deductions). */
export function getStaffNet(baseTotal: number): number {
  return baseTotal * (1 - STAFF_DEDUCTION_RATE_1 - STAFF_DEDUCTION_RATE_2);
}

/** Round to 2 decimals for display. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
