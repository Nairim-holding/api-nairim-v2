/*
  Warnings:

  - You are about to drop the column `allowed_from` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `allowed_to` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "allowed_from",
DROP COLUMN "allowed_to";

-- CreateTable
CREATE TABLE "UserAccessSchedule" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccessSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAccessSchedule_user_id_day_of_week_idx" ON "UserAccessSchedule"("user_id", "day_of_week");

-- CreateIndex
CREATE INDEX "UserAccessSchedule_company_id_idx" ON "UserAccessSchedule"("company_id");

-- AddForeignKey
ALTER TABLE "UserAccessSchedule" ADD CONSTRAINT "UserAccessSchedule_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessSchedule" ADD CONSTRAINT "UserAccessSchedule_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
