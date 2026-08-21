-- CreateTable
CREATE TABLE "sop_template" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sop_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sop_task" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sop_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sop_task_completion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "karyawanId" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sop_task_completion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sop_task_templateId_order_idx" ON "sop_task"("templateId", "order");

-- CreateIndex
CREATE INDEX "sop_task_completion_karyawanId_tanggal_idx" ON "sop_task_completion"("karyawanId", "tanggal");

-- CreateIndex
CREATE UNIQUE INDEX "sop_task_completion_taskId_karyawanId_tanggal_key" ON "sop_task_completion"("taskId", "karyawanId", "tanggal");

-- AddForeignKey
ALTER TABLE "sop_template" ADD CONSTRAINT "sop_template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sop_task" ADD CONSTRAINT "sop_task_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "sop_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sop_task_completion" ADD CONSTRAINT "sop_task_completion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "sop_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sop_task_completion" ADD CONSTRAINT "sop_task_completion_karyawanId_fkey" FOREIGN KEY ("karyawanId") REFERENCES "karyawan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
