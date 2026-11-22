-- Emails that did not reach someone: refused by Resend when sent, or
-- reported back later as bounced, complained about, failed or suppressed.
CREATE TABLE "EmailProblem" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT,
    "subject" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailProblem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailProblem_email_idx" ON "EmailProblem"("email");
CREATE INDEX "EmailProblem_createdAt_idx" ON "EmailProblem"("createdAt");
