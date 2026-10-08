-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('INR', 'USD', 'ZAR', 'EUR', 'GBP', 'CAD', 'AUD', 'AED', 'SGD', 'JPY');

-- CreateEnum
CREATE TYPE "CountryCode" AS ENUM ('IN', 'US', 'ZA', 'GB', 'AE', 'CA', 'AU', 'SG', 'JP', 'DE', 'FR');

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "countryCode" DROP DEFAULT;
ALTER TABLE "Company" ALTER COLUMN "countryCode" TYPE "CountryCode" USING ("countryCode"::"CountryCode");
ALTER TABLE "Company" ALTER COLUMN "countryCode" SET DEFAULT 'ZA'::"CountryCode";

ALTER TABLE "Company" ALTER COLUMN "currencyCode" DROP DEFAULT;
ALTER TABLE "Company" ALTER COLUMN "currencyCode" TYPE "CurrencyCode" USING ("currencyCode"::"CurrencyCode");
ALTER TABLE "Company" ALTER COLUMN "currencyCode" SET DEFAULT 'ZAR'::"CurrencyCode";

