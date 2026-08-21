-- AlterTable
ALTER TABLE "course_lesson" ADD COLUMN     "videoDuration" INTEGER,
ADD COLUMN     "videoId" TEXT;

-- AlterTable
ALTER TABLE "quiz_question" ADD COLUMN     "eventTime" INTEGER,
ADD COLUMN     "isNote" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "video_watch" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "watchSeconds" INTEGER NOT NULL DEFAULT 0,
    "watchPct" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_watch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_watch_enrollmentId_lessonId_key" ON "video_watch"("enrollmentId", "lessonId");

-- AddForeignKey
ALTER TABLE "video_watch" ADD CONSTRAINT "video_watch_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_watch" ADD CONSTRAINT "video_watch_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "course_lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
