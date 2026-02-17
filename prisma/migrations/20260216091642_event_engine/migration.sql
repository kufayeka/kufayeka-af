-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "parentEventId" UUID,
    "eventCode" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "startTimestamp" TIMESTAMPTZ(6) NOT NULL,
    "endTimestamp" TIMESTAMPTZ(6),
    "durationSeconds" INTEGER,
    "context" JSONB,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_assetId_startTimestamp_idx" ON "events"("assetId", "startTimestamp");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_eventCode_idx" ON "events"("eventCode");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_parentEventId_fkey" FOREIGN KEY ("parentEventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
