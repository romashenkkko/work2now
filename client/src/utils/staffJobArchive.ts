/** Joburi finalizate (după check-out) mutate în arhivă de staff – persistă local per utilizator */

export type StaffArchivedJobEntry = {
  applicationId: string;
  jobId: string;
  jobTitle?: string;
  jobLocation?: string;
  customerName?: string;
  checkedOutAt?: string;
  archivedAt: string;
};

function storageKey(userId: string) {
  return `work2now_staff_archived_jobs_${String(userId).trim()}`;
}

export function loadStaffArchivedJobs(userId: string): StaffArchivedJobEntry[] {
  if (!userId?.trim() || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { entries?: StaffArchivedJobEntry[] };
    const list = parsed?.entries;
    return Array.isArray(list) ? list.filter((e) => e?.applicationId && e?.jobId) : [];
  } catch {
    return [];
  }
}

export function getArchivedApplicationIds(userId: string): Set<string> {
  return new Set(loadStaffArchivedJobs(userId).map((e) => e.applicationId));
}

export function addStaffArchivedJob(
  userId: string,
  partial: Omit<StaffArchivedJobEntry, "archivedAt">
): StaffArchivedJobEntry[] {
  if (!userId?.trim() || typeof window === "undefined") return [];
  const prev = loadStaffArchivedJobs(userId);
  if (prev.some((e) => e.applicationId === partial.applicationId)) return prev;
  const entry: StaffArchivedJobEntry = {
    ...partial,
    archivedAt: new Date().toISOString(),
  };
  const next = [entry, ...prev];
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ entries: next }));
  } catch {
    /* ignore */
  }
  return next;
}

export function removeStaffArchivedJob(userId: string, applicationId: string): StaffArchivedJobEntry[] {
  if (!userId?.trim() || typeof window === "undefined") return [];
  const next = loadStaffArchivedJobs(userId).filter((e) => e.applicationId !== applicationId);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ entries: next }));
  } catch {
    /* ignore */
  }
  return next;
}
