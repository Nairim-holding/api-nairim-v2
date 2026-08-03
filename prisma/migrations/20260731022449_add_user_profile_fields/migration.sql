-- AlterTable
ALTER TABLE "User" ADD COLUMN     "allowed_from" TIME,
ADD COLUMN     "allowed_to" TIME,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "has_time_restriction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" VARCHAR(20),
ADD COLUMN     "phone_area_code" VARCHAR(5),
ADD COLUMN     "phone_country_code" VARCHAR(5),
ADD COLUMN     "phone_extension" VARCHAR(10),
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "updated_by" TEXT;

-- CreateIndex
CREATE INDEX "User_is_active_idx" ON "User"("is_active");

-- CreateIndex
CREATE INDEX "User_user_group_id_idx" ON "User"("user_group_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
