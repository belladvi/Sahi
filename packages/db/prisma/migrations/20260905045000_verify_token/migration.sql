-- Add public buyer-verify token (ticket 22), unique.
-- Nullable column; safe unique index (all values null on creation).
ALTER TABLE "Application" ADD COLUMN     "verifyToken" TEXT;

CREATE UNIQUE INDEX "Application_verifyToken_key" ON "Application"("verifyToken");
