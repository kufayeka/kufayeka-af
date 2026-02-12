# Asset Attribute Historian API Test Links

Base URL (local dev): http://localhost:3000

## Get historian (single)
GET http://localhost:3000/api/asset-attribute-historian?path=Plant%20A.Pump-01.pressure&start=2026-02-12T00:00:00Z&end=2026-02-12T12:00:00Z
GET http://localhost:3000/api/asset-attribute-historian?attributeId=<assetAttributeId>&start=2026-02-12T00:00:00Z&end=2026-02-12T12:00:00Z
GET http://localhost:3000/api/asset-attribute-historian?path=Plant%20A.Pump-01.pressure&start=2026-02-12T00:00:00Z&end=2026-02-12T12:00:00Z&bucket=1%20hour

## Insert historian (single)
POST http://localhost:3000/api/asset-attribute-historian
Body (JSON):
{
  "path": "Plant A.Pump-01.pressure",
  "ts": "2026-02-12T10:00:00Z",
  "value": 7.1
}

POST http://localhost:3000/api/asset-attribute-historian
Body (JSON):
{
  "attributeId": "<assetAttributeId>",
  "ts": "2026-02-12T10:00:00Z",
  "value": 7.1
}

## Get historian (batch)
POST http://localhost:3000/api/asset-attribute-historian/batch
Body (JSON):
{
  "paths": [
    "Plant A.Pump-01.pressure",
    "Plant A.Pump-01.temperature"
  ],
  "start": "2026-02-12T00:00:00Z",
  "end": "2026-02-12T12:00:00Z",
  "bucket": "1 hour"
}

## Aggregate historian
GET http://localhost:3000/api/asset-attribute-historian/aggregate?path=Plant%20A.Pump-01.pressure&start=2026-02-12T00:00:00Z&end=2026-02-12T12:00:00Z&agg=avg
GET http://localhost:3000/api/asset-attribute-historian/aggregate?path=Plant%20A.Pump-01.pressure&start=2026-02-12T00:00:00Z&end=2026-02-12T12:00:00Z&agg=last
