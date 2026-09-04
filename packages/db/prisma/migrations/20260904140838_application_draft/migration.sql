-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "draftToken" TEXT NOT NULL,
    "bakerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "products" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "premises" TEXT,
    "turnoverBand" TEXT,
    "businessName" TEXT,
    "description" TEXT,
    "kindOfBusiness" TEXT,
    "category" TEXT,
    "subCategory" TEXT,
    "formA" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_draftToken_key" ON "Application"("draftToken");
