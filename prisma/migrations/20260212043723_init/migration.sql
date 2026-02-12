-- CreateEnum
CREATE TYPE "AssetAttributeDataType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'ARRAY', 'OBJECT');

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "parentAssetId" UUID,
    "assetAttributeTemplateId" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_attribute_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "asset_attribute_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_attribute_template_items" (
    "id" UUID NOT NULL,
    "assetAttributeTemplateId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "dataType" "AssetAttributeDataType" NOT NULL,
    "unit" VARCHAR(255),
    "defaultValue" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "asset_attribute_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_attributes" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "templateItemId" UUID NOT NULL,
    "value" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "asset_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_attribute_historian" (
    "assetAttributeId" UUID NOT NULL,
    "ts" TIMESTAMPTZ(6) NOT NULL,
    "value" JSONB,

    CONSTRAINT "asset_attribute_historian_pkey" PRIMARY KEY ("assetAttributeId","ts")
);

-- CreateTable
CREATE TABLE "analysis_scripts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "script" TEXT NOT NULL,
    "inputs" JSONB,
    "templateId" UUID,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "analysis_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_script_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "script" TEXT NOT NULL,
    "inputs" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "analysis_script_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_attributes_assetId_templateItemId_key" ON "asset_attributes"("assetId", "templateItemId");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_parentAssetId_fkey" FOREIGN KEY ("parentAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assetAttributeTemplateId_fkey" FOREIGN KEY ("assetAttributeTemplateId") REFERENCES "asset_attribute_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attribute_template_items" ADD CONSTRAINT "asset_attribute_template_items_assetAttributeTemplateId_fkey" FOREIGN KEY ("assetAttributeTemplateId") REFERENCES "asset_attribute_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attributes" ADD CONSTRAINT "asset_attributes_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attributes" ADD CONSTRAINT "asset_attributes_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "asset_attribute_template_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attribute_historian" ADD CONSTRAINT "asset_attribute_historian_assetAttributeId_fkey" FOREIGN KEY ("assetAttributeId") REFERENCES "asset_attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_scripts" ADD CONSTRAINT "analysis_scripts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "analysis_script_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
