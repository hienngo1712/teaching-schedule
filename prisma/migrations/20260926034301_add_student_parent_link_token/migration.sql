-- AlterTable
ALTER TABLE "students" ADD COLUMN     "parent_link_token" VARCHAR(43);

-- CreateIndex
CREATE UNIQUE INDEX "students_parent_link_token_key" ON "students"("parent_link_token");
