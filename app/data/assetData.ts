export type AssetNode = {
  id: string;
  name: string;
  nodeType: "asset" | "attribute";
  children?: AssetNode[];
};

export type AssetAttributeDataType =
  | "STRING"
  | "NUMBER"
  | "BOOLEAN"
  | "JSON"
  | "ARRAY"
  | "OBJECT";

export type TemplateItem = {
  id: string;
  name: string;
  dataType: AssetAttributeDataType;
  unit: string;
  description: string;
  defaultValue?: unknown | null;
};

export type TemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  items: TemplateItem[];
};

export type AssetSummary = {
  id: string;
  name: string;
  description: string | null;
  parentAssetId: string | null;
  assetAttributeTemplateId: string | null;
};

export type AssetAttributeValue = {
  id: string;
  templateItemId: string;
  value: unknown | null;
  templateItem: TemplateItem;
};

export type AssetAttributeInput = {
  id?: string;
  templateItemId: string;
  value: string;
  templateItem: TemplateItem;
};

export type AssetListItem = AssetSummary & {
  attributes?: AssetAttributeValue[];
};

export type AssetDetail = AssetSummary & {
  assetAttributeTemplate: TemplateSummary | null;
  attributes: AssetAttributeValue[];
};
