# Asset & Attribute API Docs

Base URL (local dev): http://localhost:3000

## Assets
### List assets
GET http://localhost:3000/api/assets

### Create asset
POST http://localhost:3000/api/assets
Body (JSON):
{
  "name": "Pump-02",
  "description": "Pump cadangan",
  "parentAssetId": null,
  "assetAttributeTemplateId": "<templateId>"
}

### Get asset detail
GET http://localhost:3000/api/assets/<assetId>

### Update asset
PUT http://localhost:3000/api/assets/<assetId>
Body (JSON):
{
  "name": "Pump-02A",
  "description": "Update desc",
  "parentAssetId": null,
  "assetAttributeTemplateId": "<templateId>"
}

### Delete asset
DELETE http://localhost:3000/api/assets/<assetId>

### Get asset by path (hierarchy + attributes)
GET http://localhost:3000/api/assets/path?path=Plant%20A.Pump-01

Returns:
- asset: asset detail
- hierarchy: array of asset nodes from root to target

## Asset Attributes
### Bulk upsert attributes for asset
PUT http://localhost:3000/api/asset-attributes
Body (JSON):
{
  "assetId": "<assetId>",
  "attributes": [
    { "templateItemId": "<templateItemId>", "value": "6.5" },
    { "templateItemId": "<templateItemId>", "value": "80" }
  ]
}

### Create/update single attribute
POST http://localhost:3000/api/asset-attributes
Body (JSON):
{
  "assetId": "<assetId>",
  "templateItemId": "<templateItemId>",
  "value": "6.5"
}

### Delete single attribute
DELETE http://localhost:3000/api/asset-attributes
Body (JSON):
{
  "assetId": "<assetId>",
  "templateItemId": "<templateItemId>"
}

### Get attribute value by path
GET http://localhost:3000/api/asset-attributes/value?path=Plant%20A.Pump-01.pressure

### Set attribute value by path
PUT http://localhost:3000/api/asset-attributes/value
Body (JSON):
{
  "path": "Plant A.Pump-01.pressure",
  "value": 7.2
}

Validation:
- Wrong type returns 400 with error message.

## Asset Attribute Historian
See [docs/api-asset-attribute-historian.md](docs/api-asset-attribute-historian.md)
