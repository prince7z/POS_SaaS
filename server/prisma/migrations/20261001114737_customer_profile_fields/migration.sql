-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "profileImageKey" TEXT,
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "customerType" DROP NOT NULL;
