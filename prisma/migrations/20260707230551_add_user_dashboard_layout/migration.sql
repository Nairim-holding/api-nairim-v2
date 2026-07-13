-- CreateTable
CREATE TABLE "UserDashboardLayout" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDashboardLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserDashboardLayout_user_id_idx" ON "UserDashboardLayout"("user_id");

-- CreateIndex
CREATE INDEX "UserDashboardLayout_resource_idx" ON "UserDashboardLayout"("resource");

-- CreateIndex
CREATE INDEX "UserDashboardLayout_company_id_idx" ON "UserDashboardLayout"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserDashboardLayout_user_id_resource_key" ON "UserDashboardLayout"("user_id", "resource");

-- AddForeignKey
ALTER TABLE "UserDashboardLayout" ADD CONSTRAINT "UserDashboardLayout_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDashboardLayout" ADD CONSTRAINT "UserDashboardLayout_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
