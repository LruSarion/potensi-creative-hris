import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere, requirePortal } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const TRAINER_ROLES: Role[] = ["TRAINER", "SUPER_ADMIN"];

// ---------- T17: Course authoring ----------

const courseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  coverDriveId: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  isCertification: z.coerce.boolean().optional().default(false),
  clientId: z.string().optional().nullable(),
});

export type CourseInput = z.infer<typeof courseSchema>;

export async function createCourse(input: CourseInput) {
  const user = await requireRole(...TRAINER_ROLES);
  const parsed = courseSchema.parse(input);
  return db.course.create({
    data: {
      ...parsed,
      tenantId: user.tenantId || undefined,
      status: parsed.status ?? "ACTIVE",
      clientId: parsed.clientId ?? null,
    },
  });
}

export async function listCourses() {
  const user = await requireRole();
  return db.course.findMany({
    where: tenantWhere(user),
    include: { modules: { orderBy: { order: "asc" }, include: { lessons: true, questions: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertModule(input: { courseId: string; id?: string; title: string; order?: number; passingScore?: number }) {
  const user = await requireRole(...TRAINER_ROLES);
  const course = await db.course.findFirst({ where: { id: input.courseId, ...tenantWhere(user) } });
  if (!course) throw AppError.notFound("Course tidak ditemukan");
  if (input.id) {
    return db.module.update({ where: { id: input.id }, data: { title: input.title, order: input.order ?? 1, passingScore: input.passingScore ?? 70 } });
  }
  return db.module.create({ data: { courseId: input.courseId, title: input.title, order: input.order ?? 1, passingScore: input.passingScore ?? 70 } });
}

export async function upsertLesson(input: { moduleId: string; id?: string; title: string; order?: number; content?: string; attachmentDriveId?: string }) {
  await requireRole(...TRAINER_ROLES);
  if (input.id) {
    return db.lesson.update({ where: { id: input.id }, data: { title: input.title, order: input.order ?? 1, content: input.content ?? null, attachmentDriveId: input.attachmentDriveId ?? null } });
  }
  return db.lesson.create({ data: { moduleId: input.moduleId, title: input.title, order: input.order ?? 1, content: input.content ?? null, attachmentDriveId: input.attachmentDriveId ?? null } });
}

// ---------- T18: Quiz engine ----------

const questionSchema = z.object({
  moduleId: z.string().min(1),
  type: z.enum(["MCQ", "ESSAY"]),
  question: z.string().min(1),
  options: z.array(z.string()).optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
});

export async function addQuestion(input: z.infer<typeof questionSchema>) {
  await requireRole(...TRAINER_ROLES);
  const parsed = questionSchema.parse(input);
  return db.quizQuestion.create({
    data: { ...parsed, options: parsed.options && parsed.options.length > 0 ? parsed.options : undefined, correctAnswer: parsed.correctAnswer ?? null },
  });
}

/** Auto-grade an MCQ attempt; essay returns null (manual grading). */
export async function submitAnswer(enrollmentId: string, questionId: string, answerText: string) {
  const user = await requirePortal("streamer");
  const enroll = await db.enrollment.findFirst({
    where: { id: enrollmentId, karyawanId: user.karyawanId ?? undefined },
  });
  if (!enroll) throw AppError.forbidden("Enrollment tidak ditemukan");

  const q = await db.quizQuestion.findUnique({ where: { id: questionId } });
  if (!q) throw AppError.notFound("Pertanyaan tidak ditemukan");

  let score: number | null = null;
  if (q.type === "MCQ" && q.correctAnswer != null) {
    score = answerText.trim() === q.correctAnswer.trim() ? 100 : 0;
  }
  return db.quizAttempt.create({
    data: { enrollmentId, moduleId: q.moduleId, questionId, answerText, score, gradedAt: score != null ? new Date() : undefined },
  });
}

export async function gradeEssay(attemptId: string, score: number) {
  const user = await requireRole(...TRAINER_ROLES);
  const attempt = await db.quizAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw AppError.notFound("Attempt tidak ditemukan");
  return db.quizAttempt.update({
    where: { id: attemptId },
    data: { score, gradedById: user.id, gradedAt: new Date() },
  });
}

// ---------- T19: Enrollment + cohorts ----------

export async function enroll(karyawanId: string, courseId: string, dueDate?: string) {
  const user = await requireRole(...TRAINER_ROLES);
  const course = await db.course.findFirst({ where: { id: courseId, ...tenantWhere(user) } });
  if (!course) throw AppError.notFound("Course tidak ditemukan");
  const existing = await db.enrollment.findFirst({ where: { courseId, karyawanId } });
  if (existing) throw AppError.conflict("Streamer sudah di-enroll");
  return db.enrollment.create({
    data: { courseId, karyawanId, dueDate: dueDate ? new Date(dueDate) : undefined },
  });
}

/** Cohort: enroll many karyawan into one course (transactional). */
export async function enrollCohort(courseId: string, karyawanIds: string[], dueDate?: string) {
  const user = await requireRole(...TRAINER_ROLES);
  const course = await db.course.findFirst({ where: { id: courseId, ...tenantWhere(user) } });
  if (!course) throw AppError.notFound("Course tidak ditemukan");
  return db.$transaction(async (tx) => {
    const created = [];
    for (const k of karyawanIds) {
      const exists = await tx.enrollment.findFirst({ where: { courseId, karyawanId: k } });
      if (!exists) {
        created.push(await tx.enrollment.create({ data: { courseId, karyawanId: k, dueDate: dueDate ? new Date(dueDate) : undefined } }));
      }
    }
    return created;
  });
}

// ---------- T20: Progress ----------

export async function computeProgress(enrollmentId: string) {
  const user = await requireRole();
  const enroll = await db.enrollment.findFirst({ where: { id: enrollmentId, ...(user.karyawanId ? { karyawanId: user.karyawanId } : {}) } });
  if (!enroll) throw AppError.notFound("Enrollment tidak ditemukan");
  const modules = await db.module.findMany({ where: { courseId: enroll.courseId }, include: { questions: true } });
  const attempts = await db.quizAttempt.findMany({ where: { enrollmentId } });

  let answered = 0;
  const totalQuestions = modules.reduce((s, m) => s + m.questions.length, 0);
  const answeredModules = new Set(attempts.map((a) => a.moduleId));
  answered = attempts.length;

  const lessons = await db.lesson.count({ where: { moduleId: { in: modules.map((m) => m.id) } } });
  const progressPct = totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : lessons > 0 ? 50 : 0;
  const completed = !answeredModules.size || Array.from(answeredModules).length === modules.filter((m) => m.questions.length > 0).length;

  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { progressPct, status: completed && progressPct >= 100 ? "COMPLETED" : progressPct > 0 ? "IN_PROGRESS" : "ASSIGNED", completedAt: completed && progressPct >= 100 ? new Date() : undefined },
  });
  return { progressPct, answered, totalQuestions, completed: completed && progressPct >= 100 };
}

export async function listEnrollments(courseId?: string) {
  const user = await requireRole();
  const karyawanId = user.karyawanId;

  // If user is a streamer and has a karyawan record, auto-enroll in any active courses if not yet enrolled
  if (karyawanId) {
    const activeCourses = await db.course.findMany({
      where: { ...tenantWhere(user), status: "ACTIVE" },
      select: { id: true },
    });
    for (const c of activeCourses) {
      const exists = await db.enrollment.findFirst({ where: { courseId: c.id, karyawanId } });
      if (!exists) {
        await db.enrollment.create({
          data: { courseId: c.id, karyawanId, status: "ASSIGNED", progressPct: 0 },
        });
      }
    }
  }

  // Enrollment has no tenantId column — scope via the related Course's tenantId.
  const tenantFilter = user.role === "SUPER_ADMIN" ? {} : { course: { tenantId: user.tenantId } };
  return db.enrollment.findMany({
    where: {
      ...(courseId ? { courseId } : {}),
      ...(user.role === "STREAMER" && karyawanId ? { karyawanId } : {}),
      ...tenantFilter,
    },
    include: {
      course: {
        include: {
          modules: {
            orderBy: { order: "asc" },
            include: { lessons: { orderBy: { order: "asc" } }, questions: true },
          },
        },
      },
      karyawan: true,
      certificates: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

// ---------- T21: Certificates ----------

export async function issueCertificate(enrollmentId: string, opts?: { validTo?: string }) {
  const user = await requireRole(...TRAINER_ROLES);
  const enroll = await db.enrollment.findUnique({ where: { id: enrollmentId }, include: { course: true } });
  if (!enroll) throw AppError.notFound("Enrollment tidak ditemukan");
  if (enroll.status !== "COMPLETED") throw AppError.conflict("Course belum selesai");
  const existing = await db.certificate.findFirst({ where: { enrollmentId } });
  if (existing) return existing;
  const code = `CERT-${Date.now().toString(36).toUpperCase()}`;
  return db.certificate.create({
    data: {
      code,
      enrollmentId,
      courseId: enroll.courseId,
      clientId: enroll.course.clientId,
      streamerKaryawanId: enroll.karyawanId,
      validTo: opts?.validTo ? new Date(opts.validTo) : undefined,
    },
  });
}

export async function revokeCertificate(id: string) {
  await requireRole(...TRAINER_ROLES);
  return db.certificate.update({ where: { id }, data: { revokedAt: new Date() } });
}