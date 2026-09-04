import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireRole, tenantWhere, requirePortal } from "@/lib/auth-helpers";
import type { Role } from "@/generated/prisma/enums";

const TRAINER_ROLES: Role[] = ["TRAINER", "SUPER_ADMIN", "ADMIN_OPERASIONAL"];

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
  const tenantId = user.tenantId || (await db.tenant.findFirst({ where: { type: "AGENCY" } }))?.id || undefined;
  return db.course.create({
    data: {
      title: parsed.title,
      description: parsed.description ?? null,
      coverDriveId: parsed.coverDriveId ?? null,
      isCertification: parsed.isCertification ?? false,
      tenantId: tenantId ?? undefined,
      status: parsed.status ?? "ACTIVE",
      clientId: parsed.clientId ? parsed.clientId : null,
    },
  });
}

export async function listCourses() {
  const user = await requireRole();
  const where = user.role === "SUPER_ADMIN" ? {} : user.tenantId ? { OR: [{ tenantId: user.tenantId }, { tenantId: null }] } : {};
  return db.course.findMany({
    where,
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

export async function upsertLesson(input: { moduleId: string; id?: string; title: string; order?: number; content?: string; attachmentDriveId?: string; videoId?: string; videoDuration?: number }) {
  await requireRole(...TRAINER_ROLES);
  const data = {
    title: input.title,
    order: input.order ?? 1,
    content: input.content ?? null,
    attachmentDriveId: input.attachmentDriveId ?? null,
    videoId: input.videoId ?? null,
    videoDuration: input.videoDuration ?? null,
  };
  if (input.id) {
    return db.lesson.update({ where: { id: input.id }, data });
  }
  return db.lesson.create({ data: { moduleId: input.moduleId, ...data } });
}

export async function deleteLesson(id: string) {
  await requireRole(...TRAINER_ROLES);
  const lesson = await db.lesson.findUnique({ where: { id } });
  if (!lesson) throw AppError.notFound("Lesson tidak ditemukan");
  return db.lesson.delete({ where: { id } });
}

export async function deleteQuestion(id: string) {
  await requireRole(...TRAINER_ROLES);
  const q = await db.quizQuestion.findUnique({ where: { id } });
  if (!q) throw AppError.notFound("Pertanyaan tidak ditemukan");
  return db.quizQuestion.delete({ where: { id } });
}

export async function deleteModule(id: string) {
  await requireRole(...TRAINER_ROLES);
  const mod = await db.module.findUnique({ where: { id } });
  if (!mod) throw AppError.notFound("Modul tidak ditemukan");
  return db.module.delete({ where: { id } });
}

export async function deleteCourse(id: string) {
  await requireRole(...TRAINER_ROLES);
  const c = await db.course.findUnique({ where: { id } });
  if (!c) throw AppError.notFound("Kursus tidak ditemukan");
  return db.course.delete({ where: { id } });
}

// ---------- T18: Quiz engine ----------

const questionSchema = z.object({
  moduleId: z.string().min(1),
  lessonId: z.string().optional().nullable(),
  type: z.enum(["MCQ", "ESSAY", "AUDIO"]),
  question: z.string().min(1),
  options: z.array(z.string()).optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  eventTime: z.coerce.number().int().optional().nullable(),
  isNote: z.coerce.boolean().optional().default(false),
  // When false, a timed question shows without pausing the video (flexible pause).
  pauseVideo: z.coerce.boolean().optional().default(true),
});

export async function addQuestion(input: z.infer<typeof questionSchema> & { id?: string }) {
  await requireRole(...TRAINER_ROLES);
  const parsed = questionSchema.parse(input);
  const data = {
    lessonId: parsed.lessonId ?? null,
    type: parsed.type,
    question: parsed.question,
    options: parsed.options && parsed.options.length > 0 ? parsed.options : undefined,
    correctAnswer: parsed.correctAnswer ?? null,
    eventTime: parsed.eventTime ?? null,
    isNote: parsed.isNote ?? false,
    pauseVideo: parsed.pauseVideo ?? true,
  };
  if (input.id) {
    return db.quizQuestion.update({ where: { id: input.id }, data });
  }
  return db.quizQuestion.create({
    data: { moduleId: parsed.moduleId, ...data },
  });
}

export function checkAnswerMatch(
  userAnswer: string | null | undefined,
  correctAnswer: string | null | undefined,
  options?: any
): boolean {
  if (!userAnswer || !correctAnswer) return false;
  const cleanUser = userAnswer.trim().toLowerCase();
  const cleanCorrect = correctAnswer.trim().toLowerCase();

  // 1. Direct exact match
  if (cleanUser === cleanCorrect) return true;

  // 2. Map letter / index (A=0, B=1, C=2, D=3, E=4, etc.)
  const parseIdxOrLetter = (val: string): { letter: string | null; idx: number | null } => {
    const v = val.trim().toUpperCase();
    if (/^[0-9]+$/.test(v)) {
      const idx = parseInt(v, 10);
      return { letter: String.fromCharCode(65 + idx), idx };
    }
    if (/^[A-Z]$/.test(v)) {
      const idx = v.charCodeAt(0) - 65;
      return { letter: v, idx };
    }
    const match = v.match(/^([A-Z])[\.\)\-\:\s]/);
    if (match) {
      const letter = match[1];
      return { letter, idx: letter.charCodeAt(0) - 65 };
    }
    return { letter: null, idx: null };
  };

  const pUser = parseIdxOrLetter(userAnswer);
  const pCorrect = parseIdxOrLetter(correctAnswer);

  if (pUser.idx !== null && pCorrect.idx !== null && pUser.idx === pCorrect.idx) {
    return true;
  }
  if (pUser.letter !== null && pCorrect.letter !== null && pUser.letter === pCorrect.letter) {
    return true;
  }

  // 3. Match against options list if available
  let optsList: string[] = [];
  if (Array.isArray(options)) {
    optsList = options;
  } else if (typeof options === "string") {
    try {
      optsList = JSON.parse(options);
    } catch {
      optsList = [];
    }
  }

  if (optsList.length > 0) {
    let userOptIdx: number | null = pUser.idx;
    if (userOptIdx === null || userOptIdx < 0 || userOptIdx >= optsList.length) {
      const uIdx = optsList.findIndex((opt) => {
        const oClean = opt.trim().toLowerCase();
        return (
          oClean === cleanUser ||
          oClean.replace(/^[a-z0-9][\.\)\-\:\s]\s*/i, "") === cleanUser.replace(/^[a-z0-9][\.\)\-\:\s]\s*/i, "")
        );
      });
      if (uIdx !== -1) userOptIdx = uIdx;
    }

    let correctOptIdx: number | null = pCorrect.idx;
    if (correctOptIdx === null || correctOptIdx < 0 || correctOptIdx >= optsList.length) {
      const cIdx = optsList.findIndex((opt) => {
        const oClean = opt.trim().toLowerCase();
        return (
          oClean === cleanCorrect ||
          oClean.replace(/^[a-z0-9][\.\)\-\:\s]\s*/i, "") === cleanCorrect.replace(/^[a-z0-9][\.\)\-\:\s]\s*/i, "")
        );
      });
      if (cIdx !== -1) correctOptIdx = cIdx;
    }

    if (userOptIdx !== null && correctOptIdx !== null && userOptIdx === correctOptIdx) {
      return true;
    }
  }

  // 4. Text comparison without prefix
  const stripPrefix = (str: string) => str.replace(/^[a-z0-9][\.\)\-\:\s]\s*/i, "").trim().toLowerCase();
  if (stripPrefix(userAnswer) === stripPrefix(correctAnswer)) return true;

  return false;
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
    score = checkAnswerMatch(answerText, q.correctAnswer, q.options) ? 100 : 0;
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
  const enroll = await db.enrollment.findFirst({
    where: { id: enrollmentId, ...(user.karyawanId ? { karyawanId: user.karyawanId } : {}) },
    include: { course: true },
  });
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
  const isCompleted = completed && progressPct >= 100;

  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { progressPct, status: isCompleted ? "COMPLETED" : progressPct > 0 ? "IN_PROGRESS" : "ASSIGNED", completedAt: isCompleted ? new Date() : undefined },
  });

  // Auto-issue certificate for certification courses upon completion.
  if (isCompleted && enroll.course.isCertification) {
    await ensureCertificate(enrollmentId);
  }

  return { progressPct, answered, totalQuestions, completed: isCompleted };
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

/** Internal: create certificate for a completed enrollment (idempotent). No role check — callers enforce. */
async function ensureCertificate(enrollmentId: string, opts?: { validTo?: string }) {
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

export async function issueCertificate(enrollmentId: string, opts?: { validTo?: string }) {
  await requireRole(...TRAINER_ROLES);
  return ensureCertificate(enrollmentId, opts);
}

/** Fetch one certificate by its public code (for the certificate view/print page). */
export async function getCertificateByCode(code: string) {
  const cert = await db.certificate.findUnique({
    where: { code },
    include: {
      course: { select: { id: true, title: true, description: true, isCertification: true } },
      streamer: { select: { id: true, namaLengkap: true, idKaryawan: true } },
      client: { select: { id: true, namaClient: true } },
    },
  });
  if (!cert) throw AppError.notFound("Sertifikat tidak ditemukan");
  if (cert.revokedAt) throw AppError.conflict("Sertifikat telah dicabut");
  return cert;
}

export async function revokeCertificate(id: string) {
  await requireRole(...TRAINER_ROLES);
  return db.certificate.update({ where: { id }, data: { revokedAt: new Date() } });
}

// ---------- T22: Interactive video lessons (port from fork, DB-backed) ----------

/** Streamer reports watch progress on a video lesson. Idempotent upsert. */
export async function updateVideoWatch(input: { enrollmentId: string; lessonId: string; watchSeconds: number; completed?: boolean }) {
  const user = await requirePortal("streamer");
  const enroll = await db.enrollment.findFirst({ where: { id: input.enrollmentId, karyawanId: user.karyawanId ?? undefined } });
  if (!enroll) throw AppError.forbidden("Enrollment tidak ditemukan");

  const lesson = await db.lesson.findUnique({ where: { id: input.lessonId }, include: { module: true } });
  if (!lesson) throw AppError.notFound("Lesson tidak ditemukan");
  // videoDuration may be null if trainer didn't set it; fall back to reported watchSeconds
  const effectiveDuration = lesson.videoDuration ?? input.watchSeconds;

  const watchSeconds = Math.min(Math.max(0, Math.round(input.watchSeconds)), effectiveDuration || input.watchSeconds);
  const watchPct = effectiveDuration > 0 ? Math.round((watchSeconds / effectiveDuration) * 100) : 0;
  const completed = input.completed === true || watchPct >= 100;

  const existing = await db.videoWatch.findUnique({
    where: { enrollmentId_lessonId: { enrollmentId: input.enrollmentId, lessonId: input.lessonId } },
  });

  if (existing) {
    const merged = Math.max(existing.watchSeconds, watchSeconds);
    const mergedPct = effectiveDuration > 0 ? Math.round((merged / effectiveDuration) * 100) : 0;
    return db.videoWatch.update({
      where: { id: existing.id },
      data: {
        watchSeconds: merged,
        watchPct: mergedPct,
        completed: existing.completed || completed,
        submittedAt: existing.submittedAt ?? (completed ? new Date() : undefined),
      },
    });
  }
  return db.videoWatch.create({
    data: {
      enrollmentId: input.enrollmentId,
      lessonId: input.lessonId,
      watchSeconds,
      watchPct,
      completed,
      submittedAt: completed ? new Date() : undefined,
    },
  });
}

/** Streamer submits all answers for a video lesson's timed questions. Marks the watch as submitted. */
export async function submitVideoLesson(input: { enrollmentId: string; lessonId: string; answers: { questionId: string; answerText: string }[] }) {
  const user = await requirePortal("streamer");
  const enroll = await db.enrollment.findFirst({ where: { id: input.enrollmentId, karyawanId: user.karyawanId ?? undefined } });
  if (!enroll) throw AppError.forbidden("Enrollment tidak ditemukan");

  const lesson = await db.lesson.findUnique({ where: { id: input.lessonId }, include: { module: true } });
  if (!lesson) throw AppError.notFound("Lesson tidak ditemukan");

  const questions = await db.quizQuestion.findMany({
    where: { moduleId: lesson.moduleId, isNote: false, eventTime: { not: null }, lessonId: input.lessonId },
  });

  let totalCorrect = 0;
  for (const a of input.answers) {
    const q = questions.find((x) => x.id === a.questionId);
    if (!q) continue;
    let score: number | null = null;
    if (q.type === "MCQ" && q.correctAnswer != null) {
      score = checkAnswerMatch(a.answerText, q.correctAnswer, q.options) ? 100 : 0;
      if (score === 100) totalCorrect += 1;
    }
    await db.quizAttempt.create({
      data: {
        enrollmentId: input.enrollmentId,
        moduleId: q.moduleId,
        questionId: q.id,
        answerText: a.answerText ?? null,
        score,
        gradedAt: score != null ? new Date() : undefined,
      },
    });
  }

  const gradedQuestions = questions.filter((q) => q.correctAnswer != null);
  const scorePct = gradedQuestions.length > 0 ? Math.round((totalCorrect / gradedQuestions.length) * 100) : 0;

  await db.videoWatch.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: input.enrollmentId, lessonId: input.lessonId } },
    create: { enrollmentId: input.enrollmentId, lessonId: input.lessonId, submittedAt: new Date() },
    update: { submittedAt: new Date() },
  });

  return { scorePct, totalCorrect, totalQuestions: gradedQuestions.length };
}

/** Trainer reviews streamer submissions for video lessons and module quizzes. */
export async function listVideoSubmissions(input: { courseId?: string; lessonId?: string }) {
  await requireRole(...TRAINER_ROLES);

  // 1. Fetch VideoWatch submissions
  const watches = await db.videoWatch.findMany({
    where: {
      ...(input.lessonId ? { lessonId: input.lessonId } : {}),
      ...(input.courseId ? { enrollment: { courseId: input.courseId } } : {}),
    },
    include: {
      lesson: { include: { module: true } },
      enrollment: { include: { karyawan: { select: { id: true, namaLengkap: true, idKaryawan: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const results: any[] = [];
  const processedKeys = new Set<string>();

  for (const w of watches) {
    if (!w.enrollment?.karyawan) continue;
    const key = `${w.enrollmentId}_${w.lesson.moduleId}`;
    processedKeys.add(key);

    const questions = await db.quizQuestion.findMany({
      where: { moduleId: w.lesson.moduleId, isNote: false },
    });
    const attempts = await db.quizAttempt.findMany({ where: { enrollmentId: w.enrollmentId, moduleId: w.lesson.moduleId } });
    let correctCount = 0;
    const gradedQuestions = questions.filter((q) => q.correctAnswer != null);
    for (const q of gradedQuestions) {
      const a = attempts.find((x) => x.questionId === q.id);
      if (a && (a.score === 100 || checkAnswerMatch(a.answerText, q.correctAnswer, q.options))) {
        correctCount += 1;
      }
    }
    const scorePercent = gradedQuestions.length > 0 ? Math.round((correctCount / gradedQuestions.length) * 100) : 100;
    // Manual questions (ESSAY/AUDIO) answered but not yet scored by a trainer.
    const pendingGradingCount = questions.filter(
      (q) => q.correctAnswer == null && attempts.some((x) => x.questionId === q.id && x.score == null)
    ).length;
    results.push({
      id: w.id,
      lessonId: w.lessonId,
      lessonTitle: w.lesson.title,
      moduleTitle: w.lesson.module.title,
      courseId: w.lesson.module.courseId,
      studentId: w.enrollment.karyawan.id,
      studentName: w.enrollment.karyawan.namaLengkap,
      submittedAt: w.submittedAt ?? w.createdAt,
      watchPercentage: w.watchPct,
      totalQuestions: gradedQuestions.length,
      correctCount,
      scorePercent,
      pendingGradingCount,
      status: scorePercent >= (w.lesson.module.passingScore ?? 70) ? "PASSED" : "FAILED",
    });
  }

  // 2. Fetch QuizAttempt submissions that don't have a VideoWatch entry
  const attempts = await db.quizAttempt.findMany({
    where: {
      ...(input.courseId ? { enrollment: { courseId: input.courseId } } : {}),
    },
    include: {
      enrollment: {
        include: {
          karyawan: { select: { id: true, namaLengkap: true, idKaryawan: true } },
          course: { include: { modules: { include: { lessons: true, questions: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group attempts by enrollmentId + moduleId
  const groupedAttempts = new Map<string, { enrollment: any; moduleId: string; createdAt: Date; attempts: any[] }>();
  for (const a of attempts) {
    if (!a.enrollment?.karyawan) continue;
    const key = `${a.enrollmentId}_${a.moduleId}`;
    if (processedKeys.has(key)) continue;

    if (!groupedAttempts.has(key)) {
      groupedAttempts.set(key, {
        enrollment: a.enrollment,
        moduleId: a.moduleId,
        createdAt: a.createdAt,
        attempts: [a],
      });
    } else {
      groupedAttempts.get(key)!.attempts.push(a);
    }
  }

  for (const [key, group] of Array.from(groupedAttempts.entries())) {
    const mod = group.enrollment.course.modules.find((m: any) => m.id === group.moduleId);
    if (!mod) continue;
    if (input.lessonId && !mod.lessons.some((l: any) => l.id === input.lessonId)) continue;

    const questions = mod.questions.filter((q: any) => !q.isNote);
    const gradedQuestions = questions.filter((q: any) => q.correctAnswer != null);
    let correctCount = 0;
    for (const q of gradedQuestions) {
      const a = group.attempts.find((x: any) => x.questionId === q.id);
      if (a && (a.score === 100 || checkAnswerMatch(a.answerText, q.correctAnswer, q.options))) {
        correctCount += 1;
      }
    }
    const scorePercent = gradedQuestions.length > 0 ? Math.round((correctCount / gradedQuestions.length) * 100) : 100;
    const firstLesson = mod.lessons[0];
    const pendingGradingCount = questions.filter(
      (q: any) => q.correctAnswer == null && group.attempts.some((x: any) => x.questionId === q.id && x.score == null)
    ).length;

    results.push({
      id: `quiz_${group.enrollment.id}_${mod.id}`,
      lessonId: firstLesson?.id ?? mod.id,
      lessonTitle: firstLesson?.title ?? mod.title,
      moduleTitle: mod.title,
      courseId: group.enrollment.courseId,
      studentId: group.enrollment.karyawan.id,
      studentName: group.enrollment.karyawan.namaLengkap,
      submittedAt: group.createdAt,
      watchPercentage: 100,
      totalQuestions: gradedQuestions.length,
      correctCount,
      scorePercent,
      pendingGradingCount,
      status: scorePercent >= (mod.passingScore ?? 70) ? "PASSED" : "FAILED",
    });
  }

  return results;
}

/** Trainer fetches the detailed per-question answer breakdown for a submission. */
export async function getVideoSubmissionDetail(watchId: string) {
  await requireRole(...TRAINER_ROLES);

  if (watchId.startsWith("quiz_")) {
    const parts = watchId.split("_");
    const enrollmentId = parts[1];
    const moduleId = parts[2];

    const enroll = await db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { karyawan: true, course: { include: { modules: true } } },
    });
    if (!enroll) throw AppError.notFound("Enrollment tidak ditemukan");

    const mod = await db.module.findUnique({ where: { id: moduleId }, include: { lessons: true } });
    if (!mod) throw AppError.notFound("Modul tidak ditemukan");

    const questions = await db.quizQuestion.findMany({
      where: { moduleId: mod.id, isNote: false },
      orderBy: { eventTime: "asc" },
    });
    const attempts = await db.quizAttempt.findMany({ where: { enrollmentId, moduleId: mod.id } });

    const detailedResults = questions.map((q) => {
      const a = attempts.find((x) => x.questionId === q.id);
      let isCorrect = false;
      if (q.correctAnswer != null && a?.answerText != null) {
        isCorrect = a?.score === 100 || checkAnswerMatch(a.answerText, q.correctAnswer, q.options);
      }
      return {
        attemptId: a?.id ?? null,
        questionId: q.id,
        type: q.type,
        question: q.question,
        eventTime: q.eventTime,
        options: q.options as string[] | null,
        correctAnswer: q.correctAnswer,
        studentAnswer: a?.answerText ?? null,
        score: a?.score ?? null,
        isCorrect,
      };
    });

    // Only auto-gradable questions (MCQ with correctAnswer) count toward the score;
    // ESSAY/AUDIO stay "menunggu penilaian trainer".
    const gradable = detailedResults.filter((d) => d.correctAnswer != null);
    const correctCount = gradable.filter((d) => d.isCorrect).length;
    const scorePercent = gradable.length > 0 ? Math.round((correctCount / gradable.length) * 100) : 0;
    const latestAttempt = attempts[attempts.length - 1];

    return {
      id: watchId,
      lessonId: mod.lessons[0]?.id ?? mod.id,
      lessonTitle: mod.lessons[0]?.title ?? mod.title,
      moduleTitle: mod.title,
      studentId: enroll.karyawan.id,
      studentName: enroll.karyawan.namaLengkap,
      submittedAt: latestAttempt?.createdAt ?? enroll.updatedAt,
      watchPercentage: 100,
      passingScore: mod.passingScore ?? 70,
      scorePercent,
      correctCount,
      totalQuestions: gradable.length,
      pendingGradingCount: detailedResults.length - gradable.length,
      detailedResults,
    };
  }

  const w = await db.videoWatch.findUnique({
    where: { id: watchId },
    include: { lesson: { include: { module: true } }, enrollment: { include: { karyawan: true } } },
  });
  if (!w) throw AppError.notFound("Submission tidak ditemukan");

  const questions = await db.quizQuestion.findMany({
    where: { moduleId: w.lesson.moduleId, isNote: false },
    orderBy: { eventTime: "asc" },
  });
  const attempts = await db.quizAttempt.findMany({ where: { enrollmentId: w.enrollmentId, moduleId: w.lesson.moduleId } });

  const detailedResults = questions.map((q) => {
    const a = attempts.find((x) => x.questionId === q.id);
    let isCorrect = false;
    if (q.correctAnswer != null && a?.answerText != null) {
      isCorrect = a?.score === 100 || checkAnswerMatch(a.answerText, q.correctAnswer, q.options);
    }
    return {
      attemptId: a?.id ?? null,
      questionId: q.id,
      type: q.type,
      question: q.question,
      eventTime: q.eventTime,
      options: q.options as string[] | null,
      correctAnswer: q.correctAnswer,
      studentAnswer: a?.answerText ?? null,
      score: a?.score ?? null,
      isCorrect,
    };
  });
  // Only auto-gradable questions (MCQ with correctAnswer) count toward the score;
  // ESSAY/AUDIO stay "menunggu penilaian trainer".
  const gradable = detailedResults.filter((d) => d.correctAnswer != null);
  const correctCount = gradable.filter((d) => d.isCorrect).length;
  const scorePercent = gradable.length > 0 ? Math.round((correctCount / gradable.length) * 100) : 0;

  return {
    id: w.id,
    lessonId: w.lessonId,
    lessonTitle: w.lesson.title,
    moduleTitle: w.lesson.module.title,
    studentId: w.enrollment.karyawan.id,
    studentName: w.enrollment.karyawan.namaLengkap,
    submittedAt: w.submittedAt ?? w.createdAt,
    watchPercentage: w.watchPct,
    passingScore: w.lesson.module.passingScore ?? 70,
    scorePercent,
    correctCount,
    totalQuestions: gradable.length,
    pendingGradingCount: detailedResults.length - gradable.length,
    detailedResults,
  };
}