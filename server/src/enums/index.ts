/**
 * Enum definitions matching .NET architecture
 * All enums are stored as INT in the database
 */

export enum ApplicationStatus {
  Open = 1,
  Pending = 2,
  Accepted = 3,
  Rejected = 4,
}

export enum CompanyCategory {
  Cantina = 1,
  Catering = 2,
  Cafe = 3,
  Restaurant = 4,
  Nightclub = 5,
  Hotel = 6,
  Bar = 7,
}

export enum ExperienceDuration {
  NoExperience = 1,
  LessThanOneYear = 2,
  OneToFiveYears = 3,
  MoreThanFiveYears = 4,
}

export enum JobCategory {
  Barback = 9,
  Cashier = 10,
  ChefHead = 11,
  ChefPastry = 12,
  ChefSous = 13,
  ChefSushi = 14,
  CocktailBartender = 15,
  EventCrew = 16,
  GroceryStoreWorker = 17,
  HeadWaiter = 18,
  Housekeeper = 19,
  Maintenance = 20,
  Pizzaiolo = 21,
  Sommelier = 22,
  T2SAppTester = 23,

}

export enum UserRole {
  Employee = 1,
  Business = 2,
  Admin = 3,
}

export enum VacancyStatus {
  Open = 1,
  InDuration = 2,
  Closed = 3,
}

/**
 * Mapping functions for backward compatibility with string-based status fields
 */

/**
 * Maps legacy string status to ApplicationStatus enum
 * 'pending' -> Pending, 'accepted' -> Accepted, 'refused'/'rejected' -> Rejected
 */
export function stringToApplicationStatus(status: string): ApplicationStatus {
  const s = status.toLowerCase().trim();
  if (s === "pending") return ApplicationStatus.Pending;
  if (s === "accepted") return ApplicationStatus.Accepted;
  if (s === "refused" || s === "rejected") return ApplicationStatus.Rejected;
  return ApplicationStatus.Pending; // default
}

/**
 * Maps ApplicationStatus enum to legacy string status
 */
export function applicationStatusToString(status: ApplicationStatus): string {
  switch (status) {
    case ApplicationStatus.Pending:
      return "pending";
    case ApplicationStatus.Accepted:
      return "accepted";
    case ApplicationStatus.Rejected:
      return "refused";
    default:
      return "pending";
  }
}

/**
 * Maps legacy string role to UserRole enum
 * 'staff'/'user' -> Employee, 'customer' -> Business, 'admin' -> Admin
 */
export function stringToUserRole(role: string): UserRole {
  const r = role.toLowerCase().trim();
  if (r === "admin") return UserRole.Admin;
  if (r === "customer") return UserRole.Business;
  return UserRole.Employee; // 'staff', 'user', or default
}

/**
 * Maps UserRole enum to legacy string role
 */
export function userRoleToString(role: UserRole): string {
  switch (role) {
    case UserRole.Admin:
      return "admin";
    case UserRole.Business:
      return "customer";
    case UserRole.Employee:
      return "staff";
    default:
      return "staff";
  }
}

/**
 * Maps legacy string status to VacancyStatus enum
 * 'Draft'/'Open' -> Open, 'InDuration' -> InDuration, 'Closed' -> Closed
 */
export function stringToVacancyStatus(status: string): VacancyStatus {
  const s = status.toLowerCase().trim();
  if (s === "closed") return VacancyStatus.Closed;
  if (s === "induration" || s === "in duration") return VacancyStatus.InDuration;
  return VacancyStatus.Open; // 'draft', 'open', or default
}

/**
 * Maps VacancyStatus enum to legacy string status
 */
export function vacancyStatusToString(status: VacancyStatus): string {
  switch (status) {
    case VacancyStatus.Open:
      return "Draft";
    case VacancyStatus.InDuration:
      return "InDuration";
    case VacancyStatus.Closed:
      return "Closed";
    default:
      return "Draft";
  }
}

/**
 * Gets status class CSS for legacy UI compatibility
 */
export function getStatusClass(status: VacancyStatus): string {
  switch (status) {
    case VacancyStatus.Open:
      return "bg-gray-100 text-gray-700";
    case VacancyStatus.InDuration:
      return "bg-blue-100 text-blue-700";
    case VacancyStatus.Closed:
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

