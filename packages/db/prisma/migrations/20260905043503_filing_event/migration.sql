-- CreateTable
CREATE TABLE "FilingEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FilingEvent_applicationId_idx" ON "FilingEvent"("applicationId");

-- AddForeignKey
ALTER TABLE "FilingEvent" ADD CONSTRAINT "FilingEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
