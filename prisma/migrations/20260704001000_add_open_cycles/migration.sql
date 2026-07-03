CREATE TYPE "OpenCycleType" AS ENUM ('TASK', 'THOUGHT', 'PURCHASE', 'IDEA', 'PROMISE', 'NOTE', 'OTHER');

CREATE TABLE "OpenCycle" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "memoryItemId" TEXT,
  "type" "OpenCycleType" NOT NULL,
  "title" TEXT NOT NULL,
  "context" TEXT,
  "area" TEXT,
  "urgency" INTEGER,
  "importance" INTEGER,
  "energy" INTEGER,
  "estimatedMinutes" INTEGER,
  "dueDate" TIMESTAMP(3),
  "reason" TEXT,
  "source" TEXT NOT NULL DEFAULT 'llm',
  "rawInput" TEXT,
  "rawOutput" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OpenCycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpenCycle_memoryItemId_key" ON "OpenCycle"("memoryItemId");

CREATE INDEX "OpenCycle_userId_createdAt_idx" ON "OpenCycle"("userId", "createdAt");

CREATE INDEX "OpenCycle_type_idx" ON "OpenCycle"("type");

CREATE INDEX "OpenCycle_dueDate_idx" ON "OpenCycle"("dueDate");

ALTER TABLE "OpenCycle"
  ADD CONSTRAINT "OpenCycle_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OpenCycle"
  ADD CONSTRAINT "OpenCycle_memoryItemId_fkey"
  FOREIGN KEY ("memoryItemId") REFERENCES "MemoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;