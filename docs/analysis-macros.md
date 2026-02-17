# Analysis Script Macros

Macros ini tersedia di dalam sandbox script analysis. Semua fungsi bersifat **read** kecuali `Attribute.set`/`Attribute.setMany` yang akan **update nilai attribute** (tidak menulis historian).

## Asset
### `Asset.get(path)`
Ambil data asset berdasarkan path.

**Contoh:**
```js
const pump = Asset.get("Plant A.Pump-01");
return { name: pump?.name };
```

### `Asset.getById(id)`
Ambil data asset berdasarkan id.

**Contoh:**
```js
const asset = Asset.getById("uuid-here");
return { name: asset?.name };
```

### `Asset.list()`
Ambil semua asset (flat list).

**Contoh:**
```js
const assets = Asset.list();
return { count: assets.length };
```

### `Asset.query(pattern)`
Cari asset dengan wildcard `*` dan `?`.

**Contoh:**
```js
const pumps = Asset.query("Plant A.Pump-*");
return { pumps: pumps.map((p) => p.name) };
```

### `Asset.getHierarchy(path)`
Ambil parent chain dari root ke asset target.

**Contoh:**
```js
const chain = Asset.getHierarchy("Plant A.Pump-01");
return { chain };
```

## Attribute
### `Attribute.get(path)`
Ambil attribute berdasarkan path.

**Contoh:**
```js
const pressure = Attribute.get("Plant A.Pump-01.pressure");
return { value: pressure?.value, unit: pressure?.unit };
```

### `Attribute.list(assetPath)`
Ambil semua attribute untuk asset tertentu.

**Contoh:**
```js
const attrs = Attribute.list("Plant A.Pump-01");
return { names: attrs.map((a) => a.name) };
```

### `Attribute.getMany(paths)`
Ambil banyak attribute sekaligus.

**Contoh:**
```js
const rows = Attribute.getMany([
  "Plant A.Pump-01.pressure",
  "Plant A.Pump-01.temperature"
]);
return { rows };
```

### `Attribute.set(path, value)`
Update nilai attribute (latest value).

**Contoh:**
```js
Attribute.set("Plant A.Pump-01.pressure", 7.2);
return { ok: true };
```

### `Attribute.setMany(items)`
Update banyak attribute sekaligus.

**Contoh:**
```js
Attribute.setMany([
  { path: "Plant A.Pump-01.pressure", value: 7.1 },
  { path: "Plant A.Pump-01.temperature", value: 81 }
]);
return { ok: true };
```

## Historian
### `Historian.insertMany(items)`
Tulis data historian (timeseries) untuk banyak tag. Sekaligus update nilai latest pada attribute.

**Items:**
- `path` (required)
- `value` (required)
- `ts` (optional, default now, ISO string atau Date)

**Contoh:**
```js
Historian.insertMany([
  { path: "Plant A.Pump-01.pressure", value: 7.25, ts: "2026-02-12T08:00:00Z" },
  { path: "Plant A.Pump-01.temperature", value: 82 }
]);
return { ok: true };
```

### `Historian.getMany(paths, start, end, bucket, options)`
Ambil historian untuk banyak tag sekaligus. Saat dipanggil, response API run akan berisi data historian (bukan `result` dari script).

**Params:**
- `paths` (required array)
- `start` (required, ISO string)
- `end` (required, ISO string)
- `bucket` (optional, contoh: `"1 hour"`)
- `options` (optional): `{ format: "iso" }` atau `{ iso: true }`

**Contoh:**
```js
Historian.getMany(
  ["Plant A.Pump-01.pressure", "Plant A.Pump-01.temperature"],
  "2026-02-12T00:00:00Z",
  "2026-02-12T06:00:00Z",
  "1 hour",
  { format: "iso" }
);
```

## Notes
- Path format: `Root.Child.Asset.Attribute`
- `Attribute.set` **tidak** menulis ke historian.
- Error tipe value akan memunculkan response error dari API run.

## Event
### `Event.get(id)`
Ambil event berdasarkan id.

Catatan: data event diambil dari cache macro saat script dijalankan.

**Contoh:**
```js
const evt = Event.get(activeEventId);
return { status: evt?.status };
```

### `Event.generate(payload)`
Buat event baru. Jika `payload.id` kosong, sistem akan membuat UUID.

**Payload:**
- `id` (optional)
- `timestamp` (optional, default now)
- `parentEventId` (optional)
- `asset` (path asset, object asset, atau `assetVar.value` dari binding)
- `eventCode` (optional, default: `PRODUCTION`)
- `status` (optional, default: `open`)
- `context` (optional JSON)

**Contoh:**
```js
const eventId = Event.generate({
  timestamp: new Date().toISOString(),
  asset: "Jasuindo.OffsetPrinter.Taiyo1",
  eventCode: "PRODUCTION",
  context: { shift: "A" }
});
```

### `Event.end(payload)`
Tutup event dan hitung durasi.

**Payload:**
- `id` (required)
- `timestamp` (optional, default now)

**Contoh:**
```js
Event.end({ id: eventId, timestamp: new Date().toISOString() });
```

## Binding Types
- `attribute`: nilai attribute
- `constant`: nilai konstan
- `query`: dari HTTP query string
- `body`: dari request body JSON
- `asset`: object asset (path + id)
