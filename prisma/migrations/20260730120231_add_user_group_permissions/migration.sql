-- AlterTable
ALTER TABLE "User" ADD COLUMN     "user_group_id" TEXT;

-- CreateTable
CREATE TABLE "UserGroupPermission" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_group_id" TEXT NOT NULL,
    "resource" VARCHAR(60) NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_export" BOOLEAN NOT NULL DEFAULT false,
    "can_custom_field" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGroupPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserGroupPermission_company_id_idx" ON "UserGroupPermission"("company_id");

-- CreateIndex
CREATE INDEX "UserGroupPermission_user_group_id_idx" ON "UserGroupPermission"("user_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserGroupPermission_user_group_id_resource_key" ON "UserGroupPermission"("user_group_id", "resource");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_user_group_id_fkey" FOREIGN KEY ("user_group_id") REFERENCES "UserGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroupPermission" ADD CONSTRAINT "UserGroupPermission_user_group_id_fkey" FOREIGN KEY ("user_group_id") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroupPermission" ADD CONSTRAINT "UserGroupPermission_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
