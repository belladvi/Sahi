-- Ticket 26A: licence-ready notification (DEMO). Additive + reversible.
-- Down = DROP TABLE "Notification". No changes to existing tables or statuses.

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "kind" TEXT NOT NULL DEFAULT 'licence_ready',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "providerRef" TEXT,
    "failureReason" TEXT,
    "fssaiNumber" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Notification_idempotencyKey_key" ON "Notification"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Notification_applicationId_idx" ON "Notification"("applicationId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
