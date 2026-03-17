import type { jobsModel } from "../generated/prisma/models/jobs";
import { prisma } from "../prismaClient";

/**
 * Domain model for a Job.
 */
export type JobProps = jobsModel;

export class Job {
  constructor(public readonly props: JobProps) {}

  get id(): number {
    return this.props.id;
  }

  get title(): string {
    return this.props.Title;
  }

  get location(): string | null {
    return this.props.location ?? null;
  }

  get status(): string {
    return this.props.status;
  }

  get isPromoted(): boolean {
    return this.props.is_promoted;
  }

  get date(): string {
    return this.props.date;
  }

  /**
   * Salary that staff sees on the card (base, without taxes).
   * You can evolve this to return a Money value-object later.
   */
  get hourlyRateBase() {
    return this.props.hourly_rate_base ?? null;
  }

  /**
   * Hydrate from a raw Prisma record.
   */
  static fromPrisma(record: jobsModel): Job {
    return new Job(record);
  }

  /**
   * Find a single job by id.
   */
  static async findById(id: number): Promise<Job | null> {
    const dbJob = await prisma.jobs.findUnique({
      where: { id },
    });
    return dbJob ? new Job(dbJob) : null;
  }

  /**
   * Jobs posted by a specific customer/business.
   */
  static async findByUser(userId: string): Promise<Job[]> {
    const list = await prisma.jobs.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
    return list.map((j) => new Job(j));
  }

  /**
   * Public jobs for staff (similar to the dashboard staff list),
   * filtered so that only jobs which are not full are returned.
   *
   * This is intentionally simple; you can extend it with additional
   * filters (search, category, location, profession) later.
   */
  static async findOpenForStaff(): Promise<Job[]> {
    const list = await prisma.jobs.findMany({
      where: {
        // equivalent of "not full": applications_count < people_needed OR applications_count = 0
        OR: [
          { applications_count: { equals: 0 } },
          // people_needed is stored as string, so we skip that logic here;
          // more complex slot logic can be implemented at the service layer.
        ],
      },
      orderBy: { created_at: "desc" },
    });
    return list.map((j) => new Job(j));
  }
}

