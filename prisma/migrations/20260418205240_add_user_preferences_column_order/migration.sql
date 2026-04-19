-- CreateTable for UserColumnPreference
CREATE TABLE "UserColumnPreference" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "column_order" JSONB NOT NULL DEFAULT '[]',
    "column_widths" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserColumnPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserColumnPreference_user_id_resource_key" ON "UserColumnPreference"("user_id", "resource");

-- CreateIndex
CREATE INDEX "UserColumnPreference_user_id_idx" ON "UserColumnPreference"("user_id");

-- CreateIndex
CREATE INDEX "UserColumnPreference_resource_idx" ON "UserColumnPreference"("resource");

-- AddForeignKey
ALTER TABLE "UserColumnPreference" ADD CONSTRAINT "UserColumnPreference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
