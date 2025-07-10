-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "phone" TEXT NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);
