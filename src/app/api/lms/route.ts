import { apiHandler } from "@/lib/api-handler";
import {
  createCourse,
  listCourses,
  upsertModule,
  upsertLesson,
  addQuestion,
  submitAnswer,
  gradeEssay,
  enroll,
  enrollCohort,
  computeProgress,
  listEnrollments,
  issueCertificate,
  revokeCertificate,
} from "@/lib/services/lms";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "courses";
  const courseId = url.searchParams.get("courseId") ?? undefined;
  if (view === "enrollments") return listEnrollments(courseId);
  return listCourses();
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const action = body.action as string | undefined;

  if (action === "course") return createCourse(body.course ?? body);
  if (action === "module") return upsertModule(body);
  if (action === "lesson") return upsertLesson(body);
  if (action === "question") return addQuestion(body.question ?? body);
  if (action === "answer") return submitAnswer(body.enrollmentId, body.questionId, body.answerText);
  if (action === "grade") return gradeEssay(body.attemptId, body.score);
  if (action === "enroll") return enroll(body.karyawanId, body.courseId, body.dueDate);
  if (action === "enroll-cohort") return enrollCohort(body.courseId, body.karyawanIds, body.dueDate);
  if (action === "progress") return computeProgress(body.enrollmentId);
  if (action === "certificate") return issueCertificate(body.enrollmentId);
  if (action === "revoke-cert") return revokeCertificate(body.id);
  throw new Error("unknown lms action");
});