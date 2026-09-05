import { apiHandler } from "@/lib/api-handler";
import {
  createCourse,
  listCourses,
  upsertModule,
  upsertLesson,
  deleteLesson,
  deleteModule,
  deleteCourse,
  addQuestion,
  deleteQuestion,
  submitAnswer,
  gradeEssay,
  enroll,
  enrollCohort,
  computeProgress,
  listEnrollments,
  issueCertificate,
  revokeCertificate,
  extendCertificate,
  getCertificateTemplate,
  upsertCertificateTemplate,
  getCertificateByCode,
  getCertificateByCodeWithTemplate,
  updateVideoWatch,
  submitVideoLesson,
  listVideoSubmissions,
  getVideoSubmissionDetail,
} from "@/lib/services/lms";
import { listCertifications } from "@/lib/services/marketplace";

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "courses";
  const courseId = url.searchParams.get("courseId") ?? undefined;
  const lessonId = url.searchParams.get("lessonId") ?? undefined;
  const watchId = url.searchParams.get("watchId") ?? undefined;
  const certCode = url.searchParams.get("code") ?? undefined;
  const compact = url.searchParams.get("compact") === "true";
  if (view === "enrollments") return listEnrollments(courseId, compact);
  if (view === "certifications") return listCertifications();
  if (view === "video-submissions") return listVideoSubmissions({ courseId, lessonId });
  if (view === "video-submission-detail" && watchId) return getVideoSubmissionDetail(watchId);
  if (view === "certificate" && certCode) return getCertificateByCodeWithTemplate(certCode);
  if (view === "certificate-raw" && certCode) return getCertificateByCode(certCode);
  if (view === "cert-template") return getCertificateTemplate();
  return listCourses();
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const action = body.action as string | undefined;

  if (action === "course") return createCourse(body.course ?? body);
  if (action === "course-delete") return deleteCourse(body.id);
  if (action === "module") return upsertModule(body);
  if (action === "module-delete") return deleteModule(body.id);
  if (action === "lesson") return upsertLesson(body);
  if (action === "lesson-delete") return deleteLesson(body.id);
  if (action === "question") return addQuestion(body.question && typeof body.question === "object" ? body.question : body);
  if (action === "question-delete") return deleteQuestion(body.id);
  if (action === "answer") return submitAnswer(body.enrollmentId, body.questionId, body.answerText);
  if (action === "grade") return gradeEssay(body.attemptId, body.score);
  if (action === "enroll") return enroll(body.karyawanId, body.courseId, body.dueDate);
  if (action === "enroll-cohort") return enrollCohort(body.courseId, body.karyawanIds, body.dueDate);
  if (action === "progress") return computeProgress(body.enrollmentId);
  if (action === "certificate") return issueCertificate(body.enrollmentId, body.validTo ? { validTo: body.validTo } : undefined);
  if (action === "revoke-cert") return revokeCertificate(body.id);
  if (action === "extend-cert") return extendCertificate(body.id, body.validTo);
  if (action === "save-cert-template") return upsertCertificateTemplate(body.template ?? body);
  if (action === "video-watch") return updateVideoWatch(body);
  if (action === "video-submit") return submitVideoLesson(body);
  throw new Error("unknown lms action");
});