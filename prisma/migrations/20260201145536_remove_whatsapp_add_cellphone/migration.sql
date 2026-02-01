/*
  Warnings:

  - You are about to drop the column `whatsapp` on the `Contact` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Contact" DROP COLUMN "whatsapp",
ADD COLUMN     "cellphone" TEXT;
