-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telegramBindExpires" TIMESTAMP(3),
ADD COLUMN     "telegramBindToken" TEXT,
ADD COLUMN     "telegramBoundAt" TIMESTAMP(3),
ADD COLUMN     "telegramChatId" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "users_telegramChatId_key" ON "users"("telegramChatId");