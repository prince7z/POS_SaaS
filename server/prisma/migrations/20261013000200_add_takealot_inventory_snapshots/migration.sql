ALTER TYPE "Access" ADD VALUE IF NOT EXISTS 'TAKEALOT';

CREATE TABLE "TakealotInventorySnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stockCounts" JSONB NOT NULL,
    "stockHealth" JSONB NOT NULL,

    CONSTRAINT "TakealotInventorySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TakealotInventorySnapshot_companyId_capturedAt_idx"
ON "TakealotInventorySnapshot"("companyId", "capturedAt");

ALTER TABLE "TakealotInventorySnapshot"
ADD CONSTRAINT "TakealotInventorySnapshot_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
