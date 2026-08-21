-- AlterTable
ALTER TABLE "quiz_question" ADD COLUMN     "lessonId" TEXT;

-- AddForeignKey
ALTER TABLE "quiz_question" ADD CONSTRAINT "quiz_question_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "course_lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
