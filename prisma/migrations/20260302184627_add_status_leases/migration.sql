-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('EXPIRED', 'EXPIRING', 'ACTIVE', 'CANCELED');

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "canceled_at" TIMESTAMP(3),
ADD COLUMN     "cancellation_justification" TEXT,
ADD COLUMN     "cancellation_penalty" DECIMAL(20,2),
ADD COLUMN     "other_cancellation_amounts" DECIMAL(20,2),
ADD COLUMN     "status" "LeaseStatus" NOT NULL DEFAULT 'ACTIVE';
