-- CreateEnum
CREATE TYPE "AnalysisTriggerType" AS ENUM ('ON_REQUEST', 'SCHEDULED');

-- AlterTable
ALTER TABLE "analysis_script_templates"
ADD COLUMN "triggerType" "AnalysisTriggerType" NOT NULL DEFAULT 'ON_REQUEST';

-- CreateTable
CREATE TABLE "analysis_crons" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "intervalSecond" INTEGER NOT NULL DEFAULT 60,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_crons_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "analysis_scripts"
ADD COLUMN "cronId" UUID,
ADD COLUMN "triggerType" "AnalysisTriggerType" NOT NULL DEFAULT 'ON_REQUEST';

-- AddForeignKey
ALTER TABLE "analysis_scripts"
ADD CONSTRAINT "analysis_scripts_cronId_fkey" FOREIGN KEY ("cronId") REFERENCES "analysis_crons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
