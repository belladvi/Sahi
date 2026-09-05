-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "certificateKey" TEXT,
ADD COLUMN     "filedAt" TIMESTAMP(3),
ADD COLUMN     "fssaiNumber" TEXT;
