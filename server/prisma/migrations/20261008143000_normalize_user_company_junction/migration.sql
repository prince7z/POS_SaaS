-- CreateTable
CREATE TABLE "CompanyUser" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "accesses" "Access"[] NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CompanyUser_pkey" PRIMARY KEY ("id")
);

-- Backfill data from User into CompanyUser
INSERT INTO "CompanyUser" ("id", "companyId", "userId", "roleName", "accesses", "isActive", "createdAt", "updatedAt", "deletedAt")
SELECT gen_random_uuid()::text, "companyId", "id", "roleName", "accesses", "isActive", "createdAt", "updatedAt", "deletedAt"
FROM "User";

-- CreateIndex
CREATE UNIQUE INDEX "CompanyUser_companyId_userId_key" ON "CompanyUser"("companyId", "userId");
CREATE INDEX "CompanyUser_companyId_isActive_idx" ON "CompanyUser"("companyId", "isActive");
CREATE INDEX "CompanyUser_userId_idx" ON "CompanyUser"("userId");
CREATE INDEX "CompanyUser_deletedAt_idx" ON "CompanyUser"("deletedAt");

-- AddForeignKey
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyUser" ADD CONSTRAINT "CompanyUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old constraints and indexes from User
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_companyId_fkey";
DROP INDEX IF EXISTS "User_companyId_email_key";
DROP INDEX IF EXISTS "User_companyId_isActive_idx";

-- Drop old columns from User
ALTER TABLE "User" DROP COLUMN "companyId";
ALTER TABLE "User" DROP COLUMN "roleName";
ALTER TABLE "User" DROP COLUMN "accesses";
ALTER TABLE "User" DROP COLUMN "isActive";

-- Create unique index on User.email
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

