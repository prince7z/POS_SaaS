CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" JSONB NOT NULL,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Integration" (
    "id", "companyId", "type", "name", "credentials", "configuration", "isActive", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    "id",
    'TAKEALOT',
    'Takealot',
    jsonb_build_object('apiKey', "takealotApiKey"),
    CASE
        WHEN "takealotSellerId" IS NULL THEN '{}'::jsonb
        ELSE jsonb_build_object('sellerId', "takealotSellerId")
    END,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Company"
WHERE "takealotApiKey" IS NOT NULL AND btrim("takealotApiKey") <> '';

ALTER TABLE "TakealotInventorySnapshot" ADD COLUMN "integrationId" TEXT;
UPDATE "TakealotInventorySnapshot" AS snapshot
SET "integrationId" = integration."id"
FROM "Integration" AS integration
WHERE integration."companyId" = snapshot."companyId" AND integration."type" = 'TAKEALOT';

CREATE TABLE "TakealotOffer" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "tsinId" TEXT,
    "sku" TEXT,
    "title" TEXT,
    "imageUrl" TEXT,
    "offerUrl" TEXT,
    "status" TEXT,
    "sellingPrice" DECIMAL(12,2),
    "rrp" DECIMAL(12,2),
    "costPrice" DECIMAL(12,2),
    "stockCpt" DECIMAL(12,3),
    "stockJhb" DECIMAL(12,3),
    "stockDbn" DECIMAL(12,3),
    "stockOnWayCpt" DECIMAL(12,3),
    "stockOnWayJhb" DECIMAL(12,3),
    "stockOnWayDbn" DECIMAL(12,3),
    "salesUnitsCpt" DECIMAL(12,3),
    "salesUnitsJhb" DECIMAL(12,3),
    "salesUnitsDbn" DECIMAL(12,3),
    "stockCoverCpt" DECIMAL(12,3),
    "stockCoverJhb" DECIMAL(12,3),
    "stockCoverDbn" DECIMAL(12,3),
    "stockCoverCptRaw" TEXT,
    "stockCoverJhbRaw" TEXT,
    "stockCoverDbnRaw" TEXT,
    "totalExcessStock" DECIMAL(12,3),
    "catalogueQualityScore" DECIMAL(8,3),
    "storageFeeEligible" BOOLEAN,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TakealotOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TakealotOfferStage" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TakealotOfferStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TakealotSyncState" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "jobId" TEXT,
    "currentRunId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "offersProcessed" INTEGER NOT NULL DEFAULT 0,
    "missingCostCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TakealotSyncState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TakealotSyncState_integrationId_key" ON "TakealotSyncState"("integrationId");
CREATE UNIQUE INDEX "TakealotOffer_integrationId_offerId_key" ON "TakealotOffer"("integrationId", "offerId");
CREATE INDEX "TakealotOffer_integrationId_sku_idx" ON "TakealotOffer"("integrationId", "sku");
CREATE INDEX "TakealotOffer_integrationId_status_idx" ON "TakealotOffer"("integrationId", "status");
CREATE UNIQUE INDEX "TakealotOfferStage_integrationId_syncRunId_offerId_key" ON "TakealotOfferStage"("integrationId", "syncRunId", "offerId");
CREATE INDEX "TakealotOfferStage_integrationId_syncRunId_idx" ON "TakealotOfferStage"("integrationId", "syncRunId");
CREATE INDEX "Integration_companyId_type_isActive_idx" ON "Integration"("companyId", "type", "isActive");
CREATE INDEX "TakealotInventorySnapshot_integrationId_capturedAt_idx" ON "TakealotInventorySnapshot"("integrationId", "capturedAt");

ALTER TABLE "Integration" ADD CONSTRAINT "Integration_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakealotOffer" ADD CONSTRAINT "TakealotOffer_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakealotOfferStage" ADD CONSTRAINT "TakealotOfferStage_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakealotSyncState" ADD CONSTRAINT "TakealotSyncState_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TakealotInventorySnapshot" ADD CONSTRAINT "TakealotInventorySnapshot_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Company" DROP COLUMN "takealotApiKey";
ALTER TABLE "Company" DROP COLUMN "takealotSellerId";
