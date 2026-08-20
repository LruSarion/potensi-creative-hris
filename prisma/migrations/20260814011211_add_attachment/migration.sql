-- CreateTable
CREATE TABLE "attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "kind" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "url" TEXT,
    "mime" TEXT,
    "size" INTEGER,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachment_tenantId_entityType_entityId_idx" ON "attachment"("tenantId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
