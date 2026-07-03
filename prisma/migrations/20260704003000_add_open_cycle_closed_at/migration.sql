ALTER TABLE "OpenCycle" ADD COLUMN "closedAt" TIMESTAMP(3);

CREATE INDEX "OpenCycle_userId_closedAt_createdAt_idx" ON "OpenCycle"("userId", "closedAt", "createdAt");