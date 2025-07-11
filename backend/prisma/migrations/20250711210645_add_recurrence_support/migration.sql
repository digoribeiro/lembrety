-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('DAILY', 'WEEKLY', 'SPECIFIC_DAYS', 'MONTHLY');

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "recurrencePattern" TEXT,
ADD COLUMN     "recurrenceType" "RecurrenceType",
ADD COLUMN     "seriesId" TEXT;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Reminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
