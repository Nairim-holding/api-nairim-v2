-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "new_values" JSONB,
ADD COLUMN     "old_values" JSONB;
