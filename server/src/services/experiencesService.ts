import { randomUUID } from "crypto";
import { prisma } from "../prismaClient";
import { ExperienceDuration, JobCategory } from "../enums";
import { ServiceError } from "./ServiceError";

/** La onboarding nu permitem „Fără experiență”; descrierea e obligatorie. */
const EXPERIENCE_DESCRIPTION_MIN_LENGTH = 50;
const ONBOARDING_ALLOWED_DURATIONS: number[] = [
  ExperienceDuration.LessThanOneYear,
  ExperienceDuration.OneToFiveYears,
  ExperienceDuration.MoreThanFiveYears,
];

type ExperienceRow = { Id: string; JobCategory: number; Duration: number; Description: string };

type ExperienceDto = {
  id: string;
  jobCategory: number;
  duration: number;
  description: string;
};

type ExperiencePayload = {
  jobCategory?: unknown;
  duration?: unknown;
  description?: unknown;
};

function requireUserId(userId?: string): string {
  if (!userId) throw new ServiceError("Unauthorized", 401);
  return userId;
}

async function getEmployeeProfileId(userId: string): Promise<string | null> {
  const employeeProfile = await prisma.employee_profiles.findUnique({
    where: { UserId: userId },
    select: { Id: true },
  });
  return employeeProfile?.Id ?? null;
}

function assertOptionalDescriptionLength(desc: string): void {
  const t = desc.trim();
  if (t.length > 0 && t.length < EXPERIENCE_DESCRIPTION_MIN_LENGTH) {
    throw new ServiceError(
      `Descrierea trebuie să aibă cel puțin ${EXPERIENCE_DESCRIPTION_MIN_LENGTH} de caractere sau lasă câmpul gol.`,
      400
    );
  }
}

function mapExperience(exp: ExperienceRow): ExperienceDto {
  return {
    id: exp.Id,
    jobCategory: exp.JobCategory,
    duration: exp.Duration,
    description: exp.Description || "",
  };
}

export async function checkNeedsOnboarding(userId?: string): Promise<{ needsOnboarding: boolean }> {
  const resolvedUserId = requireUserId(userId);
  const employeeProfileId = await getEmployeeProfileId(resolvedUserId);
  if (!employeeProfileId) {
    return { needsOnboarding: false };
  }

  const experience = await prisma.experiences.findFirst({
    where: { EmployeeProfileId: employeeProfileId },
    select: { Id: true },
  });
  const hasExperiences = !!experience;
  return { needsOnboarding: !hasExperiences };
}

export async function saveOnboardingExperiences(userId?: string, payload?: { experiences?: unknown }): Promise<{ ok: true; message: string }> {
  const resolvedUserId = requireUserId(userId);
  const experiences = payload?.experiences;

  if (!Array.isArray(experiences) || experiences.length === 0) {
    throw new ServiceError("Trebuie să selectați cel puțin o categorie de job.", 400);
  }

  for (const exp of experiences) {
    const item = exp as { jobCategory?: unknown; duration?: unknown; description?: unknown };
    if (typeof item.jobCategory !== "number" || !Object.values(JobCategory).includes(item.jobCategory)) {
      throw new ServiceError("Categoria de job invalidă.", 400);
    }
    if (typeof item.duration !== "number" || !ONBOARDING_ALLOWED_DURATIONS.includes(item.duration)) {
      throw new ServiceError("Selectează o durată a experienței (fără opțiunea «Fără experiență»).", 400);
    }
    const desc = typeof item.description === "string" ? item.description.trim() : "";
    if (desc.length < EXPERIENCE_DESCRIPTION_MIN_LENGTH) {
      throw new ServiceError(
        `Descrierea experienței trebuie să aibă cel puțin ${EXPERIENCE_DESCRIPTION_MIN_LENGTH} de caractere pentru fiecare categorie.`,
        400
      );
    }
  }

  const employeeProfileId = await getEmployeeProfileId(resolvedUserId);
  if (!employeeProfileId) {
    throw new ServiceError("Nu aveți profil de angajat. Doar angajații pot completa onboarding-ul.", 403);
  }

  await prisma.$transaction(
    (experiences as Array<{ jobCategory: number; duration: number; description?: string }>).map((exp) => {
      const desc = String(exp.description ?? "").trim();
      return prisma.experiences.create({
        data: {
          Id: randomUUID(),
          EmployeeProfileId: employeeProfileId,
          JobCategory: exp.jobCategory,
          Duration: exp.duration,
          Description: desc,
        },
      });
    })
  );
  return { ok: true, message: "Experiențele au fost salvate cu succes." };
}

export async function listCurrentUserExperiences(userId?: string): Promise<{ experiences: ExperienceDto[] }> {
  const resolvedUserId = requireUserId(userId);
  const employeeProfileId = await getEmployeeProfileId(resolvedUserId);
  if (!employeeProfileId) {
    return { experiences: [] };
  }

  const experiences = await prisma.experiences.findMany({
    where: { EmployeeProfileId: employeeProfileId },
    orderBy: [{ JobCategory: "asc" }, { Duration: "asc" }],
    select: {
      Id: true,
      JobCategory: true,
      Duration: true,
      Description: true,
    },
  });

  return { experiences: experiences.map(mapExperience) };
}

export async function listUserExperiences(userId?: string): Promise<{ experiences: ExperienceDto[] }> {
  if (!userId) throw new ServiceError("userId lipsă.", 400);
  const employeeProfileId = await getEmployeeProfileId(userId);
  if (!employeeProfileId) {
    return { experiences: [] };
  }

  const experiences = await prisma.experiences.findMany({
    where: { EmployeeProfileId: employeeProfileId },
    orderBy: [{ JobCategory: "asc" }, { Duration: "asc" }],
    select: {
      Id: true,
      JobCategory: true,
      Duration: true,
      Description: true,
    },
  });

  return { experiences: experiences.map(mapExperience) };
}

export async function createExperience(userId: string | undefined, payload: ExperiencePayload = {}): Promise<ExperienceDto> {
  const resolvedUserId = requireUserId(userId);
  const { jobCategory, duration, description } = payload;

  if (typeof jobCategory !== "number" || !Object.values(JobCategory).includes(jobCategory)) {
    throw new ServiceError("Categoria de job invalidă.", 400);
  }
  if (typeof duration !== "number" || !Object.values(ExperienceDuration).includes(duration)) {
    throw new ServiceError("Durata experienței invalidă.", 400);
  }

  const employeeProfileId = await getEmployeeProfileId(resolvedUserId);
  if (!employeeProfileId) {
    throw new ServiceError("Nu aveți profil de angajat.", 403);
  }

  const existing = await prisma.experiences.findFirst({
    where: {
      EmployeeProfileId: employeeProfileId,
      JobCategory: jobCategory,
    },
    select: { Id: true },
  });

  if (existing) {
    throw new ServiceError("Aveți deja experiență pentru această categorie. Actualizați experiența existentă.", 400);
  }

  const experienceId = randomUUID();
  const normalizedDescription = String(description || "").trim() || "";
  assertOptionalDescriptionLength(normalizedDescription);
  await prisma.experiences.create({
    data: {
      Id: experienceId,
      EmployeeProfileId: employeeProfileId,
      JobCategory: jobCategory,
      Duration: duration,
      Description: normalizedDescription,
    },
  });

  return { id: experienceId, jobCategory, duration, description: normalizedDescription };
}

export async function updateExperience(userId: string | undefined, id: string, payload: ExperiencePayload = {}): Promise<{ ok: true; message: string }> {
  const resolvedUserId = requireUserId(userId);
  const { duration, description } = payload;

  if (duration !== undefined && (typeof duration !== "number" || !Object.values(ExperienceDuration).includes(duration))) {
    throw new ServiceError("Durata experienței invalidă.", 400);
  }

  const employeeProfileId = await getEmployeeProfileId(resolvedUserId);
  if (!employeeProfileId) {
    throw new ServiceError("Nu aveți profil de angajat.", 403);
  }

  const experience = await prisma.experiences.findFirst({
    where: {
      Id: id,
      EmployeeProfileId: employeeProfileId,
    },
    select: { Id: true },
  });

  if (!experience) {
    throw new ServiceError("Experiența nu a fost găsită.", 404);
  }

  const data: {
    Duration?: number;
    Description?: string;
  } = {};
  if (duration !== undefined) {
    data.Duration = duration;
  }
  if (description !== undefined) {
    const nextDesc = String(description).trim();
    assertOptionalDescriptionLength(nextDesc);
    data.Description = nextDesc;
  }
  if (Object.keys(data).length === 0) {
    throw new ServiceError("Nu s-a specificat niciun câmp de actualizat.", 400);
  }

  await prisma.experiences.update({
    where: { Id: id },
    data,
  });
  return { ok: true, message: "Experiența a fost actualizată cu succes." };
}

export async function deleteExperience(userId: string | undefined, id: string): Promise<{ ok: true; message: string }> {
  const resolvedUserId = requireUserId(userId);
  const employeeProfileId = await getEmployeeProfileId(resolvedUserId);
  if (!employeeProfileId) {
    throw new ServiceError("Nu aveți profil de angajat.", 403);
  }

  const experience = await prisma.experiences.findFirst({
    where: {
      Id: id,
      EmployeeProfileId: employeeProfileId,
    },
    select: { Id: true },
  });

  if (!experience) {
    throw new ServiceError("Experiența nu a fost găsită.", 404);
  }

  await prisma.experiences.delete({ where: { Id: id } });
  return { ok: true, message: "Experiența a fost ștearsă cu succes." };
}

