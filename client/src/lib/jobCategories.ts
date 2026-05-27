const ILLUSTRATION_BASE = "/Illustration/Experience";

/** Job category codes (1–22) — aliniat cu server JobCategory enum și onboarding. */
export const JOB_CATEGORY_LABEL_KEYS: Record<number, string> = {
  1: "dashboard.jobCategoryBarback",
  2: "dashboard.jobTitleBarista",
  3: "dashboard.jobTitleBartender",
  4: "dashboard.jobCategoryCashier",
  5: "dashboard.jobTitleChef",
  6: "dashboard.jobCategoryChefHead",
  7: "dashboard.jobCategoryChefPastry",
  8: "dashboard.jobCategoryChefSous",
  9: "dashboard.jobCategoryChefSushi",
  10: "dashboard.jobTitleCleaner",
  11: "dashboard.jobCategoryCocktailBartender",
  12: "dashboard.jobTitleDishwasher",
  13: "dashboard.jobTitleEventCrew",
  14: "dashboard.jobTitleGrocery",
  15: "dashboard.jobCategoryHeadWaiter",
  16: "dashboard.jobCategoryHousekeeper",
  17: "dashboard.jobTitleMaintenance",
  18: "dashboard.jobCategoryPizzaiolo",
  19: "dashboard.jobTitleReceptionist",
  20: "dashboard.jobCategorySommelier",
  21: "dashboard.jobCategoryAppTester",
  22: "dashboard.jobTitleWaiter",
};

/**
 * Legacy Lucide icon ids for JobTitleIcon (job lists, applications).
 * Nu folosi pentru experiențe — acolo e CategoryIllustration + JOB_CATEGORY_IMAGE.
 */
export const JOB_CATEGORY_ICON_ID: Record<number, string> = {
  1: "waiter",
  2: "barista",
  3: "bartender",
  4: "grocery",
  5: "chef",
  6: "chef",
  7: "chef",
  8: "chef",
  9: "chef",
  10: "cleaner",
  11: "bartender",
  12: "dishwasher",
  13: "eventcrew",
  14: "grocery",
  15: "waiter",
  16: "cleaner",
  17: "maintenance",
  18: "chef",
  19: "receptionist",
  20: "bartender",
  21: "trainingevent",
  22: "waiter",
};

export function jobCategoryLabelKey(code: number): string | undefined {
  return JOB_CATEGORY_LABEL_KEYS[code];
}

export function jobCategoryIconId(code: number): string {
  return JOB_CATEGORY_ICON_ID[code] ?? "chef";
}

/** PNG illustrations in client/public/Illustration/Experience/ */
export const JOB_CATEGORY_IMAGE: Record<number, string> = {
  1: `${ILLUSTRATION_BASE}/barback.png`,
  2: `${ILLUSTRATION_BASE}/barista.png`,
  3: `${ILLUSTRATION_BASE}/bartender.png`,
  4: `${ILLUSTRATION_BASE}/cashier.png`,
  5: `${ILLUSTRATION_BASE}/chef.png`,
  6: `${ILLUSTRATION_BASE}/chef-head.png`,
  7: `${ILLUSTRATION_BASE}/chef-pastry.png`,
  8: `${ILLUSTRATION_BASE}/chef-sous.png`,
  9: `${ILLUSTRATION_BASE}/chef-sushi.png`,
  10: `${ILLUSTRATION_BASE}/cleaner.png`,
  11: `${ILLUSTRATION_BASE}/cocktail-bartender.png`,
  12: `${ILLUSTRATION_BASE}/dishwasher.png`,
  13: `${ILLUSTRATION_BASE}/event-crew.png`,
  14: `${ILLUSTRATION_BASE}/grocery-store-worker.png`,
  15: `${ILLUSTRATION_BASE}/head-waiter.png`,
  16: `${ILLUSTRATION_BASE}/housekeeper.png`,
  17: `${ILLUSTRATION_BASE}/maintenance.png`,
  18: `${ILLUSTRATION_BASE}/pizzaiolo.png`,
  19: `${ILLUSTRATION_BASE}/receptionist.png`,
  20: `${ILLUSTRATION_BASE}/sommelier.png`,
  21: `${ILLUSTRATION_BASE}/app-tester.png`,
  22: `${ILLUSTRATION_BASE}/waiter.png`,
};

export function jobCategoryImagePath(code: number): string {
  return JOB_CATEGORY_IMAGE[code] ?? `${ILLUSTRATION_BASE}/chef.png`;
}
