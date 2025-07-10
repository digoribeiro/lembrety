-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "retryCount" INTEGER DEFAULT 0,
ADD COLUMN     "sentAt" TIMESTAMP(3);
