CREATE TYPE "MemoryItemType" AS ENUM ('TEXT', 'VOICE', 'PHOTO', 'DOCUMENT', 'LINK');

CREATE TYPE "AssetType" AS ENUM ('VOICE', 'PHOTO', 'DOCUMENT', 'LINK');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "telegramId" TEXT NOT NULL,
  "username" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "languageCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LifeEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LifeEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MemoryItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lifeEventId" TEXT NOT NULL,
  "type" "MemoryItemType" NOT NULL,
  "content" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'telegram',
  "telegramMessageId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MemoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Asset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "memoryItemId" TEXT,
  "type" "AssetType" NOT NULL,
  "telegramFileId" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "url" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

CREATE INDEX "LifeEvent_userId_idx" ON "LifeEvent"("userId");

CREATE UNIQUE INDEX "LifeEvent_userId_name_key" ON "LifeEvent"("userId", "name");

CREATE INDEX "MemoryItem_userId_createdAt_idx" ON "MemoryItem"("userId", "createdAt");

CREATE INDEX "MemoryItem_lifeEventId_createdAt_idx" ON "MemoryItem"("lifeEventId", "createdAt");

CREATE INDEX "Asset_userId_createdAt_idx" ON "Asset"("userId", "createdAt");

CREATE INDEX "Asset_memoryItemId_idx" ON "Asset"("memoryItemId");

ALTER TABLE "LifeEvent"
  ADD CONSTRAINT "LifeEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryItem"
  ADD CONSTRAINT "MemoryItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemoryItem"
  ADD CONSTRAINT "MemoryItem_lifeEventId_fkey"
  FOREIGN KEY ("lifeEventId") REFERENCES "LifeEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_memoryItemId_fkey"
  FOREIGN KEY ("memoryItemId") REFERENCES "MemoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
