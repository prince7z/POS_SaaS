DROP INDEX IF EXISTS "Category_companyId_name_key";

CREATE UNIQUE INDEX "Category_companyId_parentId_name_key"
ON "Category" ("companyId", "parentId", "name");
